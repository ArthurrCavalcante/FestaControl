import React from 'react';
import Modal from './Modal';
import Button from './Button';
import styles from './ConfirmDialog.module.css';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  variant = 'danger'
}) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onCancel}
      title={title}
      icon={AlertTriangle}
      maxWidth="sm"
    >
      <div className={styles.container}>
        <p className={styles.message}>{message}</p>
        
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
