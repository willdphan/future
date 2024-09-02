'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IoLogoGithub, IoLogoGoogle } from 'react-icons/io5';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
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
    <div className="font-[sans-serif] flex h-screen w-full">
    <div className="hidden lg:flex w-1/2 bg-[#E8E4DB] items-center justify-center p-4">
      <div className="w-full max-w-[800px] aspect-square">
        <Spline
         scene="https://prod.spline.design/zLtKyCfRf2bEYScH/scene.splinecode" 
        />
      </div>
    </div>

    <div className="w-full lg:w-1/2 p-8 overflow-auto flex items-center justify-center bg-[#E8E4DB] bg-white">
      <form onSubmit={handleEmailSubmit} className="max-w-md w-full">
        <div className="mb-6">
          <h3 className="text-gray-800 text-3xl font-extrabold font-man ">Sign Up</h3>
          <p className='text-md mt-4 text-gray-800 font-man'>
            Or login with your email.
          </p>
        </div>

          <div className="mb-4">
            <label className="text-black text-sm mb-2 block font-man">Email</label>
            <div className="relative flex items-center">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full text-sm text-gray-800 bg-white focus:bg-transparent px-4 py-3.5  border  border-black font-man"
                placeholder="Enter email"
              />
              {/* Email icon SVG */}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-black text-sm mb-2 block font-man">Password</label>
            <div className="relative flex items-center">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full text-sm text-gray-800 bg-white focus:bg-transparent px-4 py-3.5  font-man border border-black"
                placeholder="Enter password"
              />
              {/* Password icon SVG */}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 font-man py-[0.5]">
            <div className="flex items-center">
              <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 shrink-0  border-gray-300 " />
              <label htmlFor="remember-me" className="ml-3 block text-black text-sm">
                Remember me
              </label>
            </div>
            <a href="javascript:void(0);" className="text-[#0097FC] font-medium text-sm hover:underline">
              Forgot Password?
            </a>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 px-6 text-sm tracking-wide text-black bg-[#E8E4DB] hover:bg-[#D4D0C6] mb-4 border-[1px] border border-black mb-[-1px] font-man font-semibold"
          >
            Sign In
          </button>

          <div className="my-4 flex items-center gap-4">
            <hr className="w-full border-black" />
            <p className="text-sm text-black text-center">or</p>
            <hr className="w-full border-black" />
          </div>

          <button
            type="button"
            onClick={() => handleOAuthClick('google')}
            disabled={pending}
            className="w-full flex items-center justify-center gap-4 py-3 px-6 text-sm tracking-wide text-gray-800 border-[1px] border-black bg-white hover:bg-gray-100 focus:outline-none font-man font-semibold"
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
            <p className="text-sm text-gray-600 mt-4">
              By clicking continue, you agree to our{' '}
              <Link href="https://i.pinimg.com/736x/e9/ee/e5/e9eee5e921e68379978009a9751f7ae0.jpg" className="text-[#0097FC] hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="https://i.pinimg.com/736x/e9/ee/e5/e9eee5e921e68379978009a9751f7ae0.jpg" className="text-[#0097FC] hover:underline">
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