import { useState } from 'react';

import { toast } from '@/components/ui/use-toast';

import { signOut } from '../app/(auth)/auth-actions';

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
