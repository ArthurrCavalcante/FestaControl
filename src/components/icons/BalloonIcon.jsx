import React from 'react';

const BalloonIcon = ({ size = 24, color = 'currentColor', strokeWidth = 2, ...props }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth={strokeWidth} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M12 20c-1.1 0-2-.9-2-2 0-3.3-3-4.7-3-8 0-4.4 3.6-8 8-8s8 3.6 8 8c0 3.3-3 4.7-3 8 0 1.1-.9 2-2 2z" />
      <path d="M12 20v4" />
      <path d="M10 20h4" />
      <path d="M9.5 5.5a2.5 2.5 0 0 0-2 2" />
    </svg>
  );
};

export default BalloonIcon;
