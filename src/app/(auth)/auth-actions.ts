'use server';

// Defines server-side authentication functions that interact with Supabase 
// to handle OAuth, email sign-in, and sign-out processes.

import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { ActionResponse } from '@/types/action-response';
import { getURL } from '@/utils/get-url';

/**
 * HANDLES EMAIL-BASED AUTHENTICATION BY SENDING A ONE-TIME PASSWORD (OTP)
 * TO THE PROVIDED EMAIL ADDRESS. REDIRECTS TO THE FLOWCHART PAGE AFTER
 * SUCCESSFUL AUTHENTICATION.
 */
export async function signInWithEmail(email: string): Promise<ActionResponse> {
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Change the redirect URL to /flowchart
      emailRedirectTo: `${getURL()}/flowchart`,
    },
  });

  if (error) {
    console.error(error);
    return { data: null, error: error };
  }

  return { data: null, error: null };
}

/**
 * MANAGES OAUTH AUTHENTICATION FLOW FOR GITHUB AND GOOGLE PROVIDERS.
 * REDIRECTS USER TO THE SELECTED PROVIDER'S AUTH PAGE AND THEN TO
 * THE FLOWCHART PAGE AFTER SUCCESSFUL AUTHENTICATION.
 */
export async function signInWithOAuth(provider: 'github' | 'google'): Promise<ActionResponse> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      // url
      redirectTo: `${getURL()}/flowchart`,
    },
  });

  if (error) {
    console.error(error);
    return { data: null, error: error };
  }

  return { data: null, error: null };
}


export async function signOut(): Promise<ActionResponse> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error(error);
    return { data: null, error: error };
  }

  return { data: null, error: null };
}