# Prolly

This project is an AI-powered application that generates outcomes based on user input. It uses the Groq API for natural language processing and is built with FastAPI and Modal for deployment.

## Project Structure

```
├── README.md
├── src/
│ └── app/
│ └── api/
│ └── prolly.py
```

## File Descriptions

1. `README.md`: This file, containing information about the project, its structure, and how to set it up and use it.

2. `src/app/api/prolly.py`: The main application file containing:

   - Configuration for the Groq API client
   - The `generate_outcomes` function that processes user input and generates outcomes
   - FastAPI app setup with CORS middleware
   - Endpoint definition for the `/generate-outcomes` route

## Setup and Installation

1. Clone the repository:

```
git clone https://github.com/willdphan/future.git
cd <repository-name>
```

2. Install dependencies

For Frontend:

```
npm install
```

For Backend:

Modal will install these packages in the script of prolly.py

```
# install necessary packages
image = (
    Image.debian_slim()
    .pip_install("fastapi", "uvicorn", "groq", "pydantic", "requests")
)
```

## Running the Application

We are using modal labs for deploying and running the FastAPI application. Create an account and create your env variables.
Here's how you can create your secret keys in terminal:

```
modal secret create my-api-keys GROQ_API_KEY={key} EXA_API_KEY={key}
```

## API Usage

The application exposes a single endpoint:

- `POST /generate-outcomes`
  - Accepts JSON payload with a `prompt` field
  - Returns generated outcomes based on the input prompt

Example request:

```
{
"prompt": "What are potential outcomes of climate change?"
}
```

## Deployment

You can deploy this application. This will start the FastAPI server using Modal, making it accessible at `http://localhost:8000` by default.

```
modal deploy src/app/api/prolly.py
```

## TODO

- [ ] More outcomes
- [ ] Longer, detailed node descriptions
- [ ] Better probability weighting
- [ ] Dragable nodes
- [ ] More details about entire generated flowchart

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
