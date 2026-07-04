import React from 'react';
import styles from './StatusDot.module.css';

export default function StatusDot({ 
  color = 'var(--primary)', 
  animate = false,
  className = ''
}) {
  return (
    <div className={`${styles.dotWrapper} ${className}`}>
      {animate && (
        <span 
          className={styles.ping} 
          style={{ backgroundColor: color }} 
        />
      )}
      <span 
        className={styles.dot} 
        style={{ backgroundColor: color }} 
      />
    </div>
  );
}
