import React from 'react';

const AppHeader = () => {
  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      padding: '24px 32px',
      boxSizing: 'border-box'
    }}>
      {/* Siemens Logo */}
      <img
        src="/siemens-logo.png"
        alt="Siemens Healthineers"
        style={{ height: 48, objectFit: 'contain' }}
      />
      {/* Robot Avatar with slow breathe animation */}
      <img
        src="/robot-avatar.png"
        alt="Robot companion"
        style={{
          height: 64,
          objectFit: 'contain',
          animation: 'breathe 4s ease-in-out infinite'
        }}
      />
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </header>
  );
};

export default AppHeader;

