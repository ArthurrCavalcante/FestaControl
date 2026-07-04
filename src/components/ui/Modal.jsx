import React, { useEffect } from 'react';
import styles from './Modal.module.css';
import IconButton from './IconButton';
import { X } from 'lucide-react';

export default function Modal({ 
  isOpen = true, 
  onClose, 
  title, 
  icon: Icon, 
  maxWidth = 'md',
  footer,
  children 
}) {
  
  // Bloquear scroll do body quando modal abre
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles[maxWidth]}`} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            {Icon && (
              <div className={styles.titleIcon}>
                <Icon size={20} />
              </div>
            )}
            <h2 className={styles.title}>{title}</h2>
          </div>
          <IconButton 
            icon={X} 
            variant="ghost" 
            color="default" 
            onClick={onClose} 
            aria-label="Fechar modal" 
          />
        </div>
        
        <div className={styles.content}>
          {children}
        </div>
        
        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
