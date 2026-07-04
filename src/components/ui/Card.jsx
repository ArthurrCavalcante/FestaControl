import React from 'react';
import styles from './Card.module.css';

export default function Card({ 
  children, 
  padding = 'md', 
  hoverable = false, 
  selected = false,
  className = '',
  onClick,
  ...props 
}) {
  const cardClass = `
    ${styles.card} 
    ${styles[`pad-${padding}`]} 
    ${hoverable || onClick ? styles.hoverable : ''} 
    ${selected ? styles.selected : ''} 
    ${className}
  `.trim();

  return (
    <div 
      className={cardClass} 
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      {...props}
    >
      {children}
    </div>
  );
}
