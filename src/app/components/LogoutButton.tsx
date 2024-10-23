import React from 'react';

interface LogoutButtonProps {
  onLogout: () => Promise<void>;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ onLogout }) => {
  return (
    <button
      onClick={onLogout}
      className='border border-[1px] border-black bg-white px-4 py-1 font-man text-black hover:bg-[#3C3C3C] hover:text-white'
    >
      Logout
    </button>
  );
};

export default LogoutButton;
