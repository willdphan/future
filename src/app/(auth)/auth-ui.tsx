'use client';

// Renders the authentication user interface, accepting sign-in functions as props to handle user interactions.

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IoLogoGoogle } from 'react-icons/io5';
import { toast } from '../components/ui/use-toast';
import { ActionResponse } from '@/types/action-response';
import Spline from '@splinetool/react-spline';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

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
  const [emailFormOpen, setEmailFormOpen] = useState(false);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    // Use the email state instead of accessing the form element
    // usestate with email
    const response = await signInWithEmail(email);

    if (response?.error) {
      toast({
        variant: 'destructive',
        description: 'An error occurred while authenticating. Please try again.',
      });
    } else {
      toast({
        description: `To continue, click the link in the email sent to: ${email}`,
      });
    }

    // Reset the email state instead of the form
    setEmail('');
    setPending(false);
  }

  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const supabase = createClientComponentClient();

  async function handleOAuthClick(provider: 'google') {
    setPending(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      // The user will be redirected to the OAuth provider's login page
    } catch (error) {
      console.error('Error during OAuth sign-in:', error);
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
          <div className='mb-0'>
            <h3 className='font-man text-3xl font-extrabold text-gray-800 '>Sign Up</h3>
            <p className='text-md mt-4 font-man text-gray-800'>Continue with your email.</p>
          </div>

          {/* <div className='mb-4'>
            <label className='mb-2 block font-man text-sm text-black'>Email</label>
            <div className='relative flex items-center'>
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className='w-full border border-black bg-white px-4 py-3.5 font-man  text-sm  text-gray-800 focus:bg-transparent'
                placeholder='Enter email'
              />
            
            </div>
          </div> */}

          {/* <div className='mb-4'>
            <label className='mb-2 block font-man text-sm text-black'>Password</label>
            <div className='relative flex items-center'>
              <input
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className='w-full border border-black bg-white px-4 py-3.5 font-man  text-sm text-gray-800 focus:bg-transparent'
                placeholder='Enter password'
              />
            
            </div>
          </div> */}

          <div className='mb-4 flex items-center justify-between py-[0.5] font-man'>
            <div className='flex items-center'>
              {/* <input
                id='remember-me'
                name='remember-me'
                type='checkbox'
                className='h-4 w-4 shrink-0  border-gray-300 '
              /> */}
              {/* <label htmlFor='remember-me' className='ml-3 block text-sm text-black'>
                Remember me
              </label> */}
            </div>
            {/* <a href='javascript:void(0);' className='text-sm font-medium text-[#0097FC] hover:underline'>
              Forgot Password?
            </a> */}
          </div>

          {/* <button
            type='submit'
            disabled={pending}
            className='mb-4 mb-[-1px] w-full border border-[1px] border-black bg-[#E8E4DB] px-6 py-3 font-man text-sm font-semibold tracking-wide text-black hover:bg-[#D4D0C6]'
          >
            Sign In
          </button> */}

          {/* <div className='my-4 flex items-center gap-4'>
            <hr className='w-full border-black' />
            <p className='text-center text-sm text-black'>or</p>
            <hr className='w-full border-black' />
          </div> */}

          <button
            type='button'
            onClick={() => handleOAuthClick('google')}
            disabled={pending}
            className='flex w-full items-center justify-center gap-4 border-[1px] border-black bg-white px-6 py-3 font-man text-sm font-semibold tracking-wide text-gray-800 hover:bg-gray-100 focus:outline-none'
          >
            <IoLogoGoogle size={20} />
            Continue with Google
          </button>
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
