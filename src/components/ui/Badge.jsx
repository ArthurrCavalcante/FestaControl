import React from 'react';
import styles from './Badge.module.css';

export default function Badge({ 
  children, 
  variant = 'default', 
  size = 'md',
  icon: Icon,
  className = ''
}) {
  const badgeClass = `${styles.badge} ${styles[variant]} ${styles[size]} ${className}`;
  
  return (
    <span className={badgeClass.trim()}>
      {Icon && <Icon size={size === 'sm' ? 12 : 14} />}
      {children}
    </span>
  );
}
