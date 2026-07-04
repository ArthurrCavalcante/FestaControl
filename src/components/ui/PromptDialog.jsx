import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import styles from './PromptDialog.module.css';

export default function PromptDialog({
  isOpen,
  title,
  message,
  defaultValue = '',
  placeholder = '',
  confirmText = 'Salvar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  icon: Icon
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(value);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onCancel}
      title={title}
      icon={Icon}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className={styles.container}>
        {message && <p className={styles.message}>{message}</p>}
        
        <input 
          type="text" 
          value={value} 
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={styles.input}
          autoFocus
        />
        
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button type="submit" variant="primary">
            {confirmText}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
