// Composes the signup page by importing authentication functions and passing them to the AuthUI component.
import { signInWithEmail, signInWithOAuth } from '../auth-actions';
import { AuthUI } from '../auth-ui';

export default async function SignUp() {

  return (
    <section className=' flex min-h-screen min-w-screen items-center justify-center'>
      <AuthUI mode='signup' signInWithOAuth={signInWithOAuth} signInWithEmail={signInWithEmail} />
    </section>
  );
}
