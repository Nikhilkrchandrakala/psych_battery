import React from 'react';

interface WatermarkProps {
  user: {
    name?: string;
    email?: string;
  } | null;
  isAdminPreview?: boolean;
}

export const Watermark: React.FC<WatermarkProps> = ({ user, isAdminPreview }) => {
  if (isAdminPreview || !user) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden select-none opacity-[0.035] flex flex-wrap gap-20 p-16 justify-around items-center">
      {Array.from({ length: 18 }).map((_, idx) => (
        <div 
          key={idx} 
          className="text-white text-xs font-black tracking-widest uppercase rotate-[-25deg] select-none whitespace-nowrap"
        >
          {user.name || 'Candidate'} ({user.email})
        </div>
      ))}
    </div>
  );
};
