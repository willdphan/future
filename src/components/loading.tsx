import React from 'react';
import Spline from '@splinetool/react-spline';

const LoadingPage: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#E8E4DB]">
      <div className="text-center">
        <Spline scene="https://prod.spline.design/gbG6-0xtiOTPHBfn/scene.splinecode" />
      </div>
    </div>
  );
};

export default LoadingPage;