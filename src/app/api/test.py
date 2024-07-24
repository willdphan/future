import modal
import torch
import numpy as np
from PIL import Image
from einops import rearrange
from diffusers import DiffusionPipeline, EulerAncestralDiscreteScheduler
from huggingface_hub import hf_hub_download
from omegaconf import OmegaConf
import os
import tempfile
import imageio
from tqdm import tqdm

# Define the Modal image with necessary dependencies
# Define the Modal image with necessary dependencies
image = (
    modal.Image.from_registry("pytorch/pytorch:2.0.1-cuda11.7-cudnn8-runtime")
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "torch==2.0.1",
        "torchvision==0.15.2",
        "pillow",
        "numpy",
        "einops",
        "diffusers==0.20.2",
        "transformers",
        "huggingface_hub",
        "omegaconf",
        "pytorch-lightning==2.1.2",
        "rembg",
        "imageio[ffmpeg]",
        "PyMCubes",
        "trimesh",
        "bitsandbytes",
        "xatlas",
        "plyfile",
        "jax==0.4.19",
        "jaxlib==0.4.19",
        "ninja",
        "tqdm"
    )
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .run_commands(
        "pip install git+https://github.com/NVlabs/nvdiffrast",
        "pip install --upgrade pip",
    )
)


# Create a Modal Stub
stub = modal.Stub("instant-mesh")

# Define a volume for persistent storage
volume = modal.Volume.from_name("instant-mesh-volume", create_if_missing=True)

@stub.function(image=image, gpu="A100", timeout=1800)
def preprocess(input_image_path, do_remove_background):
    from src.utils.infer_util import remove_background, resize_foreground
    import rembg

    input_image = Image.open(input_image_path)
    rembg_session = rembg.new_session() if do_remove_background else None
    if do_remove_background:
        input_image = remove_background(input_image, rembg_session)
        input_image = resize_foreground(input_image, 0.85)
    return input_image

@stub.function(image=image, gpu="A100", timeout=1800)
def generate_mvs(input_image, sample_steps, sample_seed):
    device = torch.device('cuda')
    pipeline = DiffusionPipeline.from_pretrained("sudo-ai/zero123plus-v1.2", custom_pipeline="zero123plus", torch_dtype=torch.float16)
    pipeline.scheduler = EulerAncestralDiscreteScheduler.from_config(pipeline.scheduler.config, timestep_spacing='trailing')
    unet_ckpt_path = hf_hub_download(repo_id="TencentARC/InstantMesh", filename="diffusion_pytorch_model.bin", repo_type="model")
    state_dict = torch.load(unet_ckpt_path, map_location='cpu')
    pipeline.unet.load_state_dict(state_dict, strict=True)
    pipeline = pipeline.to(device)

    torch.manual_seed(sample_seed)
    generator = torch.Generator(device=device)
    generator.manual_seed(sample_seed)
    z123_image = pipeline(
        input_image, 
        num_inference_steps=sample_steps, 
        generator=generator,
    ).images[0]
    show_image = np.asarray(z123_image, dtype=np.uint8)
    show_image = torch.from_numpy(show_image)
    show_image = rearrange(show_image, '(n h) (m w) c -> (n m) h w c', n=3, m=2)
    show_image = rearrange(show_image, '(n m) h w c -> (n h) (m w) c', n=2, m=3)
    show_image = Image.fromarray(show_image.numpy())
    return z123_image, show_image

@stub.function(image=image, gpu="A100", timeout=3600)
def make3d(images_path):
    from src.utils.train_util import instantiate_from_config
    from src.utils.camera_util import FOV_to_intrinsics, get_zero123plus_input_cameras, get_circular_camera_poses
    from src.utils.mesh_util import save_obj_with_mtl
    from torchvision.transforms import v2

    images = Image.open(images_path)
    images = np.asarray(images, dtype=np.float32) / 255.0
    images = torch.from_numpy(images).permute(2, 0, 1).contiguous().float()
    images = rearrange(images, 'c (n h) (m w) -> (n m) c h w', n=3, m=2)

    config_path = 'configs/instant-mesh-base.yaml'
    config = OmegaConf.load(config_path)
    config_name = os.path.basename(config_path).replace('.yaml', '')
    model_config = config.model_config
    infer_config = config.infer_config
    model_ckpt_path = hf_hub_download(repo_id="TencentARC/InstantMesh", filename="instant_mesh_base.ckpt", repo_type="model")
    model = instantiate_from_config(model_config)
    state_dict = torch.load(model_ckpt_path, map_location='cpu')['state_dict']
    state_dict = {k[14:]: v for k, v in state_dict.items() if k.startswith('lrm_generator.') and 'source_camera' not in k}
    model.load_state_dict(state_dict, strict=True)
    device = torch.device('cuda')
    model = model.to(device)
    IS_FLEXICUBES = True if config_name.startswith('instant-mesh') else False
    if IS_FLEXICUBES:
        model.init_flexicubes_geometry(device, fovy=30.0)
    model = model.eval()

    def images_to_video(images, output_path, fps=30):
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        frames = []
        for i in range(images.shape[0]):
            frame = (images[i].permute(1, 2, 0).cpu().numpy() * 255).astype(np.uint8).clip(0, 255)
            frames.append(frame)
        imageio.mimwrite(output_path, np.stack(frames), fps=fps, codec='h264')

    def get_render_cameras(batch_size=1, M=120, radius=2.5, elevation=10.0, is_flexicubes=False):
        c2ws = get_circular_camera_poses(M=M, radius=radius, elevation=elevation)
        if is_flexicubes:
            cameras = torch.linalg.inv(c2ws)
            cameras = cameras.unsqueeze(0).repeat(batch_size, 1, 1, 1)
        else:
            extrinsics = c2ws.flatten(-2)
            intrinsics = FOV_to_intrinsics(30.0).unsqueeze(0).repeat(M, 1, 1).float().flatten(-2)
            cameras = torch.cat([extrinsics, intrinsics], dim=-1)
            cameras = cameras.unsqueeze(0).repeat(batch_size, 1, 1)
        return cameras

    def make_mesh(mesh_fpath, planes):
        with torch.no_grad():
            mesh_out = model.extract_mesh(planes, use_texture_map=True, **infer_config,)
            vertices, faces, uvs, mesh_tex_idx, tex_map = mesh_out
            save_obj_with_mtl(
                vertices.data.cpu().numpy(),
                uvs.data.cpu().numpy(),
                faces.data.cpu().numpy(),
                mesh_tex_idx.data.cpu().numpy(),
                tex_map.permute(1, 2, 0).data.cpu().numpy(),
                mesh_fpath,
            )
        return mesh_fpath

    input_cameras = get_zero123plus_input_cameras(batch_size=1, radius=4.0).to(device)
    render_cameras = get_render_cameras(
        batch_size=1, radius=4.5, elevation=20.0, is_flexicubes=IS_FLEXICUBES).to(device)
    images = images.unsqueeze(0).to(device)
    images = v2.functional.resize(images, (320, 320), interpolation=3, antialias=True).clamp(0, 1)

    with tempfile.TemporaryDirectory() as tmpdir:
        mesh_fpath = os.path.join(tmpdir, "output_model.obj")
        video_fpath = os.path.join(tmpdir, "output_video.mp4")

        with torch.no_grad():
            planes = model.forward_planes(images, input_cameras)
            chunk_size = 20 if IS_FLEXICUBES else 1
            render_size = 384
            frames = []
            for i in tqdm(range(0, render_cameras.shape[1], chunk_size)):
                if IS_FLEXICUBES:
                    frame = model.forward_geometry(planes, render_cameras[:, i:i+chunk_size], render_size=render_size,)['img']
                else:
                    frame = model.synthesizer(planes, cameras=render_cameras[:, i:i+chunk_size],render_size=render_size,)['images_rgb']
                frames.append(frame)
            frames = torch.cat(frames, dim=1)
            images_to_video(frames[0], video_fpath, fps=30)

        mesh_fpath = make_mesh(mesh_fpath, planes)

        # Copy files to Modal volume
        with volume.mount() as local_storage:
            output_video = os.path.join(local_storage, "output_video.mp4")
            output_model_obj = os.path.join(local_storage, "output_model.obj")
            os.system(f"cp {video_fpath} {output_video}")
            os.system(f"cp {mesh_fpath} {output_model_obj}")

    return output_video, output_model_obj

@stub.local_entrypoint()
def main(input_image_path: str):
    # Preprocess
    processed_image = preprocess.remote(input_image_path, True)
    
    # Generate multi-view images
    mv_images, mv_show_images = generate_mvs.remote(processed_image, 75, 42)
    
    # Save multi-view images to volume
    with volume.get_client() as client:
        mv_image_path = "/mv_images.png"
        with tempfile.NamedTemporaryFile(suffix=".png") as temp_file:
            mv_images.save(temp_file.name)
            client.put(mv_image_path, temp_file.name)
    
    # Generate 3D model and video
    output_video, output_model_obj = make3d.remote(mv_image_path)
    
    # Get the paths of the output files
    with volume.get_client() as client:
        video_path = client.get(output_video)
        model_path = client.get(output_model_obj)
    
    print(f"Video saved to: {video_path}")
    print(f"3D model saved to: {model_path}")

    return video_path, model_path

if __name__ == "__main__":
    stub.run()

if __name__ == "__main__":
    stub.run()


   