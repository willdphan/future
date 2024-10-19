import { PropsWithChildren } from 'react';
import type { Metadata } from 'next';
import { Montserrat, Montserrat_Alternates } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/utils/cn';
import { Analytics } from '@vercel/analytics/react';

import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Prolly',
  description: 'It will prolly happen.',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang='en'>
      <body>
        <div className='max-w-screen m-auto flex h-full flex-col'>
          {/* <header className='flex items-center justify-between py-8 bg-[#535353]'>
            <Navigation />
          </header> */}
          <main className='relative flex-1'>
            <div className='relative h-full'>{children}</div>
          </main>
        </div>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
