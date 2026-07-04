import React from 'react';
import styles from './EmptyState.module.css';
import Button from './Button';

export default function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  className = '',
  style
}) {
  return (
    <div className={`${styles.container} ${className}`} style={style}>
      {Icon && (
        <div className={styles.iconWrapper}>
          <Icon size={32} strokeWidth={1.5} />
        </div>
      )}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      
      {action && (
        <div className={styles.actionWrapper}>
          <Button variant={action.variant || "primary"} onClick={action.onClick} icon={action.icon}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
