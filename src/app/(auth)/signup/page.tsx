'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import LoadingPage from '@/app/components/Loading';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

import { signInWithEmail, signInWithOAuth } from '../auth-actions';
import { AuthUI } from '../auth-ui';

export default function SignUp() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  // useEffect(() => {
  //   const checkSession = async () => {
  //     try {
  //       const {
  //         data: { session },
  //       } = await supabase.auth.getSession();
  //       if (session) {
  //         console.log('Session found:', session);
  //         setIsAuthenticated(true);
  //       } else {
  //         console.log('No session found');
  //       }
  //     } catch (error) {
  //       console.error('Error checking session:', error);
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };

  //   checkSession();
  // }, [supabase.auth]);

  // useEffect(() => {
  //   if (isAuthenticated) {
  //     console.log('User authenticated, redirecting to /flowchart');
  //     router.push('/flowchart');
  //   }
  // }, [isAuthenticated]);

  // if (isLoading) {
  //   return <LoadingPage />;
  // }

  return (
    <section className='min-w-screen flex min-h-screen items-center justify-center'>
      <AuthUI mode='signup' signInWithOAuth={signInWithOAuth} signInWithEmail={signInWithEmail} />
    </section>
  );
}
