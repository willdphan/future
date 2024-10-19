// SPLINE ANIMATION
/* Renders Spline animation */

import Spline from '@splinetool/react-spline';

export default function HeroSpline() {
  return (
    <section className='min-w-screen z-[0] mt-[-250px] h-[50em] min-h-screen w-[40em] sm:mt-[-180px] sm:w-full'>
      <Spline scene='https://prod.spline.design/vNfSCmW8CQs2gKH4/scene.splinecode' />
    </section>
  );
}
