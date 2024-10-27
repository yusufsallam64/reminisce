import React from 'react';
import { signOut } from 'next-auth/react';

const SettingsPopup = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      
      {/* Popup */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50">
        <div className="bg-background border border-accent/50 rounded-lg shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-accent/50">
            <h2 className="text-xl font-bold text-text">Settings</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-secondary/20 rounded-full transition-colors text-text"
            >
              ✕
            </button>
          </div>
          
          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Content space for future settings */}
            <div className="min-h-[200px]">
              {/* Add settings content here */}
            </div>
            
            {/* Sign Out Button */}
            <div className="border-t border-accent/50 pt-4">
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full p-2 bg-primary hover:bg-secondary text-accent rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPopup;