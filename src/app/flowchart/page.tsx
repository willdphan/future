'use client';

// TODO: we don't need the clow chart to accept user data, get rid of this props in order for being able to render flowchart every time while logged in.

import React, { Suspense, useState } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';

import FlowChart from '../components/FlowChart';

const FlowchartPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (sessionChecked) return; // Skip if we've already checked the session

    const checkUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
        } else {
          router.push('/signup');
        }
      } catch (error) {
        console.error('Error checking user:', error);
        router.push('/signup');
      } finally {
        setIsLoading(false);
        setSessionChecked(true); // Mark that we've checked the session
      }
    };

    checkUser();
  }, [router, supabase, sessionChecked]); // Only run when these dependencies change

  if (isLoading) {
    return (
      <AnimatePresence>
        <motion.div
          className='flex min-h-screen items-center justify-center bg-[#E8E4DB] font-mono text-lg text-black'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          LOADING...
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!user) {
    return null; // This will prevent any flickering while redirecting
  }

  console.log('About to render FlowChart', { user });
  return user ? (
    <FlowChart user={user} />
  ) : (
    <div className='flex min-h-screen items-center justify-center bg-[#E8E4DB] font-mono text-lg text-black'>
      No user found. Please{' '}
      <button onClick={() => router.push('/signup')} className='ml-2 text-blue-500 underline'>
        sign up
      </button>{' '}
      or{' '}
      <button onClick={() => router.push('/login')} className='ml-2 text-blue-500 underline'>
        log in
      </button>
      .
    </div>
  );
};

// Wrap your component in Suspense
const FlowchartWrapper = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <FlowchartPage />
  </Suspense>
);

export default FlowchartWrapper;
