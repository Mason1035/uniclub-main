import { PopupContext } from './popupContextState';
import React, { createContext, useContext, useState, ReactNode } from 'react';



export const PopupProvider = ({ children }: { children: ReactNode }) => {
  const [showUserProfile, setShowUserProfile] = useState(false);

  const openUserProfile = () => setShowUserProfile(true);
  const closeUserProfile = () => setShowUserProfile(false);

  return (
    <PopupContext.Provider value={{ showUserProfile, openUserProfile, closeUserProfile }}>
      {children}
    </PopupContext.Provider>
  );
};

