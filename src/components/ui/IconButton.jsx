import React from 'react';
import styles from './IconButton.module.css';

export default function IconButton({ 
  icon: Icon, 
  variant = 'ghost', 
  color = 'default',
  size = 20,
  disabled = false,
  className = '',
  ...props 
}) {
  const btnClass = `${styles.iconButton} ${styles[variant]} ${styles[color]} ${className}`;
  
  return (
    <button 
      className={btnClass.trim()} 
      disabled={disabled}
      {...props}
    >
      <Icon size={size} />
    </button>
  );
}
