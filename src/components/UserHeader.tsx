import React from 'react';
import { useUser } from '../context/userContextState';

const UserHeader: React.FC = () => {
  const { user } = useUser();

  return (
    <div className="text-center mb-4 px-6">
      <div className="relative mx-auto mb-3 w-20 h-20">
        <div className="w-20 h-20 bg-primary   rounded-full flex items-center justify-center  shadow-orange-500/20 overflow-hidden">
          {user.profileImage ? (
            <img src={user.profileImage} alt="头像" className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary-foreground text-2xl font-bold">{user.name.charAt(0)}</span>
          )}
        </div>
      </div>
      <h3 className="text-lg font-bold text-foreground dark:text-foreground mb-1">{user.displayName || user.name}</h3>
      <p className="text-muted-foreground dark:text-muted-foreground text-xs">{user.major} • {user.year}</p>
      <p className="text-muted-foreground dark:text-muted-foreground text-xs">{user.email}</p>
      <p className="text-primary text-xs font-semibold mt-1">ID: {user.memberId}</p>
    </div>
  );
};

export default UserHeader; 