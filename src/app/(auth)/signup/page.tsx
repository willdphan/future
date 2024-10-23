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

  return (
    <section className='min-w-screen flex min-h-screen items-center justify-center'>
      <AuthUI mode='signup' signInWithOAuth={signInWithOAuth} signInWithEmail={signInWithEmail} />
    </section>
  );
}
