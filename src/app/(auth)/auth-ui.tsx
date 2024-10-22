'use client';

// Renders the authentication user interface, accepting sign-in functions as props to handle user interactions.

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IoLogoGoogle } from 'react-icons/io5';

import { ActionResponse } from '@/types/action-response';
import Spline from '@splinetool/react-spline';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

import { toast } from '../components/ui/use-toast';

export function AuthUI({
  mode,
  signInWithOAuth,
  signInWithEmail,
}: {
  mode: 'login' | 'signup';
  signInWithOAuth: (provider: 'github' | 'google') => Promise<ActionResponse>;
  signInWithEmail: (email: string) => Promise<ActionResponse>;
}) {
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const supabase = createClientComponentClient();

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = event.target as HTMLFormElement;
    const email = form['email'].value;

    let response;
    if (mode === 'signup') {
      // Use signUp for new users
      response = await supabase.auth.signUp({
        email: email,
        password: password, // Ensure you include the password for sign-up
      });
    } else {
      // Use signIn for existing users
      response = await signInWithEmail(email);
    }

    if (response?.error) {
      toast({
        variant: 'destructive',
        description: 'An error occurred while authenticating. Please try again.',
        className: 'font-man', // Ensure consistent font styling
      });
    } else {
      toast({
        description: `To continue, click the link in the email sent to: ${email}`,
        className: 'font-man', // Ensure consistent font styling
      });
    }

    form.reset();
    setPending(false);
  }

  async function handleOAuthClick(provider: 'google' | 'github') {
    setPending(true);
    try {
      // controls the google behavior
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline', // refresh access tokens when user not present
            prompt: 'select_account', // prompts user to select google account
          },
        },
      });
      // The user will be redirected to the provider's login page,
      // so we don't need to handle success here.
    } catch (error) {
      console.error('OAuth error:', error);
      toast({
        variant: 'destructive',
        description: 'An error occurred while authenticating. Please try again.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className='flex h-screen w-full font-[sans-serif]'>
      <div className='hidden w-1/2 items-center justify-center bg-[#E8E4DB] p-4 lg:flex'>
        <div className='aspect-square w-full max-w-[800px]'>
          <Spline scene='https://prod.spline.design/zLtKyCfRf2bEYScH/scene.splinecode' />
        </div>
      </div>

      <div className='flex w-full items-center justify-center overflow-auto bg-[#E8E4DB] bg-white p-8 lg:w-1/2'>
        <form onSubmit={handleEmailSubmit} className='w-full max-w-md'>
          <div className='mb-6'>
            <h3 className='font-man text-3xl font-extrabold text-gray-800 '>Sign Up</h3>
            <p className='text-md mt-4 font-man text-gray-800'>Or login with your email.</p>
          </div>

          <div className='mb-4'>
            <label className='mb-2 block font-man text-sm text-black'>Email</label>
            <div className='relative flex items-center'>
              <input
                type='email'
                name='email' // Ensure this is set
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className='w-full border border-black bg-white px-4 py-3.5 font-man text-sm text-gray-800 focus:bg-transparent'
                placeholder='Enter email'
              />
              {/* Email icon SVG */}
            </div>
          </div>

          <div className='mb-4'>
            <label className='mb-2 block font-man text-sm text-black'>Password</label>
            <div className='relative flex items-center'>
              <input
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className='w-full border border-black bg-white px-4 py-3.5 font-man text-sm text-gray-800 focus:bg-transparent'
                placeholder='Enter password'
              />
              {/* Password icon SVG */}
            </div>
          </div>
          {/* 
          <div className='mb-4 flex items-center justify-between py-[0.5] font-man'>
            <div className='flex items-center'>
              <input
                id='remember-me'
                name='remember-me'
                type='checkbox'
                className='h-4 w-4 shrink-0  border-gray-300 '
              />
              <label htmlFor='remember-me' className='ml-3 block text-sm text-black'>
                Remember me
              </label>
            </div>
            <a href='javascript:void(0);' className='text-sm font-medium text-[#0097FC] hover:underline'>
              Forgot Password?
            </a>
          </div> */}

          <button
            type='submit'
            disabled={pending}
            className='mb-4 mb-[-1px] w-full border border-[1px] border-black bg-[#E8E4DB] px-6 py-3 font-man text-sm font-semibold tracking-wide text-black hover:bg-[#D4D0C6]'
          >
            Sign In
          </button>

          <div className='my-4 flex items-center gap-4'>
            <hr className='w-full border-black' />
            <p className='text-center text-sm text-black'>or</p>
            <hr className='w-full border-black' />
          </div>

          <button
            type='button'
            onClick={() => handleOAuthClick('google')}
            disabled={pending}
            className='flex w-full items-center justify-center gap-4 border-[1px] border-black bg-white px-6 py-3 font-man text-sm font-semibold tracking-wide text-gray-800 hover:bg-gray-100 focus:outline-none'
          >
            <IoLogoGoogle size={20} />
            Continue with Google
          </button>

          {/* <button
            type="button"
            onClick={() => handleOAuthClick('github')}
            disabled={pending}
            className="w-full flex items-center justify-center gap-4 py-3 px-6 text-sm tracking-wide text-gray-800 border border-gray-300 rounded-md bg-gray-50 hover:bg-gray-100 focus:outline-none"
          >
            <IoLogoGithub size={20} />
            Continue with GitHub
          </button> */}

          {mode === 'signup' && (
            <p className='mt-4 text-sm text-gray-600'>
              By clicking continue, you agree to our{' '}
              <Link
                href='https://i.pinimg.com/736x/e9/ee/e5/e9eee5e921e68379978009a9751f7ae0.jpg'
                className='text-[#0097FC] hover:underline'
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href='https://i.pinimg.com/736x/e9/ee/e5/e9eee5e921e68379978009a9751f7ae0.jpg'
                className='text-[#0097FC] hover:underline'
              >
                Privacy Policy
              </Link>
              .
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
