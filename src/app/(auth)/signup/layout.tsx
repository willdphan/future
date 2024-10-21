import { PropsWithChildren } from 'react';
import type { Metadata } from 'next';

import { Toaster } from '@/app/components/ui/toaster';
import { Analytics } from '@vercel/analytics/react';

import '@/styles/globals.css';

// Sets link title and description
export const metadata: Metadata = {
  title: 'Prolly',
  description: 'It Will Prolly Happen.',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang='en'>
      <body>
        <div className=''>
          <main className='relative flex-1'>
            <div className='min-w-screen relative min-h-screen'>{children}</div>
          </main>
        </div>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
