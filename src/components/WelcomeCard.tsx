
import React, { useState } from 'react';
import UserProfile from './UserProfile';
import SearchDialog from './SearchDialog';
import { useUser } from '../context/userContextState';

const WelcomeCard: React.FC = () => {
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { user } = useUser();

  const displayName = user.name || '同学';
  const firstName = displayName.split(' ')[0];

  return (
    <>
      <div className="bg-primary    rounded-sm p-6 mb-6 text-primary-foreground relative overflow-hidden animate-fade-up">
        {/* Background decorative elements */}
        <div className="absolute top-4 right-4 w-12 h-12 bg-background/20 rounded-full flex items-center justify-center">
          <div className="w-6 h-6 bg-background/40 rounded-full"></div>
        </div>
        <div className="absolute bottom-4 right-8 w-8 h-8 bg-background/10 rounded-full"></div>
        <div className="absolute top-1/2 right-2 w-4 h-4 bg-background/20 rounded-full"></div>
        
        <div className="relative z-10">
          {/* Top section with profile, greeting and search */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setShowUserProfile(true)}
                className="w-10 h-10 bg-primary   rounded-full flex items-center justify-center   transition-colors duration-200 active:scale-95"
              >
                <span className="text-primary-foreground text-sm font-semibold">
                  {(displayName || '?').slice(0, 1).toUpperCase()}
                </span>
              </button>
              <div>
                <p className="text-primary-foreground font-semibold text-base">你好，{firstName}！</p>
                <p className="text-primary-foreground/80 text-xs">学号：{user.memberId || '—'}</p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowSearch(true)}
              className="w-10 h-10 bg-background/20  rounded-full flex items-center justify-center hover:bg-background/30 transition-colors duration-200"
            >
              <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
          
          <p className="text-primary-foreground/80 text-sm mb-6">查看班级近况，分享学习资源。</p>
          
          <div className="bg-background/20  border border-white/30 rounded-sm p-4 flex items-center space-x-3">
            <div className="w-12 h-12 bg-primary   rounded-sm flex items-center justify-center ">
              <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-primary-foreground font-bold text-base">ClassHub</h3>
              <p className="text-primary-foreground/80 text-xs">查看最新公告和活动安排</p>
            </div>
            <div className="w-8 h-8 bg-background/20 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <UserProfile 
        isOpen={showUserProfile} 
        onClose={() => setShowUserProfile(false)} 
      />
      
      <SearchDialog 
        isOpen={showSearch} 
        onClose={() => setShowSearch(false)} 
      />
    </>
  );
};

export default WelcomeCard;
