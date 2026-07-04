import React from 'react';
import styles from './Skeleton.module.css';

export default function Skeleton({ width = '100%', height = '20px', borderRadius = 'var(--radius-md)', style }) {
  return (
    <div 
      className={styles.skeleton} 
      style={{ width, height, borderRadius, ...style }} 
    />
  );
}
