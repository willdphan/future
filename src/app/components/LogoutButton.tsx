import { useState } from 'react';

import { signOut } from '../(auth)/auth-actions';

import { toast } from './ui/use-toast';

export default function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await signOut();
      // redirect('/signup')
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: 'Error',
        description: 'Failed to log out. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <button
      className='mt-2 border-none bg-[#3C3C3C] px-3 py-1 font-man text-white'
      onClick={handleLogout}
      disabled={isLoading}
    >
      {isLoading ? 'Logging Out...' : 'Log Out'}
    </button>
  );
}
