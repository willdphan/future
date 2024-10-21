'use client';

// TODO: we don't need the clow chart to accept user data, get rid of this props in order for being able to render flowchart every time while logged in.

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

import FlowChart from '@/components/FlowChart';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';

export default function FlowchartPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const checkUser = async () => {
      try {
        console.log('Checking user session...');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        console.log('Session:', session);
        if (session && session.user) {
          console.log('User found:', session.user);
          setUser(session.user);

          // Fetch user data
          const { data, error } = await supabase.from('users').select('*').eq('id', session.user.id).single();

          if (error) {
            console.error('Error fetching user data:', error);
          } else {
            console.log('User data fetched:', data);
            setUserData(data);
          }

          setIsLoading(false);
        } else {
          console.log('No user session found, redirecting to signup');
          router.push('/signup');
        }
      } catch (error) {
        console.error('Error checking user:', error);
        router.push('/signup');
      }
    };

    checkUser();
  }, [router, supabase, searchParams]);

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

  console.log('About to render FlowChart', { user, userData });
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
}
