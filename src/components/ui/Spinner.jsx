import React from 'react';
import styles from './Spinner.module.css';
import { Loader2 } from 'lucide-react';

export default function Spinner({ size = 24, color = 'var(--primary)', label = 'Carregando...' }) {
  return (
    <div className={styles.spinnerContainer}>
      <Loader2 
        className={styles.spinIcon} 
        size={size} 
        color={color} 
        strokeWidth={2.5}
      />
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
