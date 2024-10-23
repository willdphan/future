import React from 'react';

interface LogoutButtonProps {
  onLogout: () => Promise<void>;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ onLogout }) => {
  return (
    <button
      onClick={onLogout}
      className="border border-[1px] border-black bg-[#3C3C3C] px-4 py-2 font-man text-white hover:bg-[#E8E4DB] hover:text-black"
    >
      Logout
    </button>
  );
};

export default LogoutButton;
