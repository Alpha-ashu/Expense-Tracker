import React from 'react';

interface CenteredLayoutProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export const CenteredLayout: React.FC<CenteredLayoutProps> = ({ 
  children, 
  maxWidth = 'max-w-7xl' 
}) => {
  return (
    <div className="w-full h-full flex flex-col">
      <div className={`${maxWidth} w-full mx-auto px-6 py-6 flex-1`}>
        {children}
      </div>
    </div>
  );
};
