import type { NextRequest } from 'next/server';

import { supabaseMiddlewareClient } from './libs/supabase/supabase-middleware-client';

// Use middleware for global auth checks and redirects

export async function middleware(req: NextRequest) {
  const { supabase, user, res } = await supabaseMiddlewareClient(req);

  /**
   * You can perform route guarding here like:
   *
   * const pathname = req.nextUrl.pathname;
   *
   * if (!user && pathname.startsWith('/dashboard')) {
   *   const redirectUrl = req.nextUrl.clone();
   *   redirectUrl.pathname = '/';
   *   return NextResponse.redirect(redirectUrl);
   * }
   */

  return res;
}

// run middleware on everything except below
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};