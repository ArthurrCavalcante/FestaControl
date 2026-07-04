import React from 'react';
import styles from './ErrorState.module.css';
import { AlertOctagon } from 'lucide-react';
import Button from './Button';

export default function ErrorState({ 
  title = "Algo deu errado", 
  description = "Não foi possível carregar os dados no momento.", 
  onRetry 
}) {
  return (
    <div className={styles.errorContainer}>
      <div className={styles.iconWrapper}>
        <AlertOctagon size={48} className={styles.errorIcon} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      
      {onRetry && (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onRetry}>
            Tentar Novamente
          </Button>
        </div>
      )}
    </div>
  );
}
