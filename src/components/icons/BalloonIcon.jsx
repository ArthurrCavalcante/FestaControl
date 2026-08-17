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
      {/* Balão elegante */}
      <path d="M12 2C8.134 2 5 5.134 5 9c0 4.5 4.5 9 7 11 2.5-2 7-6.5 7-11 0-3.866-3.134-7-7-7Z" />
      {/* Reflexo / Brilho */}
      <path d="M8.5 7A3.5 3.5 0 0 1 12 3.5" />
      {/* Nó do balão */}
      <path d="M10.5 20h3" />
      {/* Corda com leve curvatura */}
      <path d="M12 20c0 1-1.5 1.5-1.5 2.5S12 24 12 24" />
    </svg>
  );
};

export default BalloonIcon;
