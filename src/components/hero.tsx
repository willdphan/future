// HERO WORDING

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const testimonials = [
  {
    quote: 'Had no idea what would happen, hopped on and knew the next steps.',
    name: 'Desperate Dave',
  },
  {
    quote: 'This app is a game-changer for decision-making!',
    name: 'Analytical Anna',
  },
  {
    quote: "I've never felt more confident about my choices.",
    name: 'Confident Carl',
  },
];

export function Hero() {
  const [percentage, setPercentage] = useState(70);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    // Percentage animation logic (unchanged)
    const percentageInterval = setInterval(() => {
      setPercentage((prev) => {
        const change = Math.floor(Math.random() * 11) - 5;
        return Math.min(Math.max(prev + change, 0), 100);
      });
    }, 50);

    // Testimonial rotation logic
    const testimonialInterval = setInterval(() => {
      setIsBlurred(true);
      setTimeout(() => {
        setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
        setIsBlurred(false);
      }, 500); // Half of the transition duration
    }, 5000); // Change testimonial every 5 seconds

    return () => {
      clearInterval(percentageInterval);
      clearInterval(testimonialInterval);
    };
  }, []);

  return (
    <div className='min-w-screen z-[99] mt-[30px] flex w-fit flex-col items-center gap-2 '>
      <h1 className='ml-10 font-man text-[2.25em] leading-tight tracking-normal text-black sm:text-6xl'>
        {/* There's a <span className="text-[#00B7FC]">{percentage}%</span> Chance <br/>It'll Play Out, <Link href="/flowchart" className="text-[#00B7FC] underline decoration-4  underline-offset-8">Prolly</Link>. */}
        There&apos;s a{' '}
        <span className='text-[#00B7FC]'>
          <br className='sm:hidden' /> {percentage}%
        </span>{' '}
        Chance <br />
        It&apos;ll Play Out,{' '}
        <Link href='/signup' className='text-[#00B7FC] underline decoration-4  underline-offset-8'>
          Prolly
        </Link>
        .
        <br />
        <div className='flex flex-col gap-1'>
          <span
            className={`overflow-wrap-normal mt-4 inline-block w-[18em] whitespace-normal break-words font-mono text-xs uppercase italic transition-all duration-1000 sm:w-[25em] md:mt-8 md:text-sm ${
              isBlurred ? 'blur-sm' : 'blur-none'
            }`}
          >
            &quot;{testimonials[currentTestimonial].quote}&quot;
          </span>
          <span
            className={`overflow-wrap-normal mt-1 inline-block w-[25em] whitespace-normal break-words font-mono text-xs uppercase transition-all duration-1000 md:text-sm ${
              isBlurred ? 'blur-sm' : 'blur-none'
            }`}
          >
            - {testimonials[currentTestimonial].name}
          </span>
        </div>
      </h1>
    </div>
  );
}
