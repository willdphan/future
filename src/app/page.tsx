'use client';

import { useEffect, useState } from 'react';
import Hero from 'src/components/Hero';

import HeroSpline from '@/components/HeroSpline';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

import styles from '@/styles/HomePage.module.css';

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      console.log('Auth status:', !!session);
    };

    checkAuth();
  }, []);

  return (
    <div className={`flex flex-col bg-[#E8E4DB] ${styles.homePageContainer}`}>
      <Hero />
      <HeroSpline />
    </div>
  );
}
