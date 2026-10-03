import { createContext, useContext } from 'react';

interface PopupContextType {
  showUserProfile: boolean;
  openUserProfile: () => void;
  closeUserProfile: () => void;
}


export const PopupContext = createContext<PopupContextType | undefined>(undefined);

export const usePopup = () => {
  const context = useContext(PopupContext);
  if (!context) throw new Error('usePopup must be used within a PopupProvider');
  return context;
}; 
