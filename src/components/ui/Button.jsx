import React from 'react';
import styles from './Button.module.css';
import { Loader2 } from 'lucide-react';

export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon: Icon, 
  iconPosition = 'left', 
  isLoading = false, 
  disabled = false,
  className = '',
  ...props 
}) {
  const buttonClass = `${styles.button} ${styles[variant]} ${styles[size]} ${className}`;
  
  return (
    <button 
      className={buttonClass.trim()} 
      disabled={disabled || isLoading} 
      {...props}
    >
      {isLoading ? (
        <Loader2 className="lucide-spin" size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />}
          {children}
          {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />}
        </>
      )}
    </button>
  );
}
