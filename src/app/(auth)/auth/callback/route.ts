// ref: https://github.com/vercel/next.js/blob/canary/examples/with-supabase/app/auth/callback/route.ts

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { getURL } from '@/utils/get-url';

const siteUrl = getURL();

export async function GET(request: NextRequest) {
  // EXTRACT AUTH CODE FROM URL PARAMETERS
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    // INITIALIZE SUPABASE AND EXCHANGE AUTH CODE FOR SESSION
    const supabase = createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);

    // GET USER DETAILS FROM THE SESSION
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // REDIRECT TO LOGIN IF NO USER ID IS FOUND
    if (!user?.id) {
      return NextResponse.redirect(`${siteUrl}/login`);
    // ELSE GO TO FLOWCHART
    } else {
      return NextResponse.redirect(`${siteUrl}/flowchart`);
    }
  }

  // FALLBACK: REDIRECT TO HOME IF NO AUTH CODE PRESENT
  return NextResponse.redirect(siteUrl);
}
