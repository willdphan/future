import { PropsWithChildren } from 'react';
import type { Metadata } from 'next';
import { Montserrat, Montserrat_Alternates } from 'next/font/google';

import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/utils/cn';
import { Analytics } from '@vercel/analytics/react';

import '@/styles/globals.css';

export const dynamic = 'force-dynamic';

// TODO: tailwind
const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
});

const montserratAlternates = Montserrat_Alternates({
  variable: '--font-montserrat-alternates',
  weight: ['500', '600', '700'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Prolly',
  description: 'It Will Prolly Happen.',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang='en'>
      <body className={cn('font-sans antialiased', montserrat.variable, montserratAlternates.variable)}>
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
