// Use withAuth for pages that need specific user data or additional protection

import { GetServerSideProps } from 'next'; // Importing the GetServerSideProps type from Next.js for server-side rendering.
import { redirect } from 'next/navigation'; // Importing the redirect function from Next.js for navigation.

import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client'; // Importing the function to create a Supabase client for server-side use.

// takes a React component as an argument and returns a new component that wraps the original one. The wrapper component extracts the user prop from its props and passes it, along with all other props, to the wrapped component.

const withAuth = (WrappedComponent: React.FC<{ user: { email: string } }>) => { // Defining a higher-order component that takes a React component with user prop.
    const AuthenticatedComponent = (props: any) => { // Defining a component that wraps the passed component.
      const { user } = props; // Extracting the user prop.
      return <WrappedComponent {...props} user={user} />; // Rendering the wrapped component with all its props including user.
    };
    return AuthenticatedComponent; // Returning the authenticated component.
  };

  // checks user authentication on the server side. It creates a Supabase client, fetches the current user, and redirects to the signup page if no authenticated user is found. 
  export const getServerSideProps: GetServerSideProps = async (context) => { // Defining the getServerSideProps function for server-side data fetching.
    const supabase = createSupabaseServerClient(); // Creating a Supabase client instance for server-side use.
    const { data, error } = await supabase.auth.getUser(); // Fetching the authenticated user from Supabase.
  
    if (error || !data?.user) { // Checking if there was an error or if no user is authenticated.
      return {
        redirect: { // If not authenticated, redirect to the login page.
          destination: '/signup',
          permanent: false,
        },
      };
    }
  
    return {
      props: { user: data.user }, // If authenticated, return the user prop.
    };
  };
  
  export default withAuth; // Exporting the higher-order component as the default export.