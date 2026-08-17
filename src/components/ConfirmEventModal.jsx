import React, { useState } from 'react';


export default function ConfirmEventModal({ onConfirm, onCancel, initialData, initialHora }) {
  const [dataFesta, setDataFesta] = useState(initialData || '');
  const [horarioFesta, setHorarioFesta] = useState(initialHora || '10:00');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!dataFesta || !horarioFesta) return;
    onConfirm({ dataFesta, horarioFesta });
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Confirmação de Festa
          <img src="/logo-icon.png" alt="Festa" style={{ width: 20, height: 20, objectFit: 'contain' }} />
        </h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Data da Festa</label>
            <input 
              type="date" 
              min={new Date().toISOString().split('T')[0]}
              value={dataFesta}
              onChange={(e) => setDataFesta(e.target.value)}
              required
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '1rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Horário da Festa</label>
            <input 
              type="time" 
              value={horarioFesta}
              onChange={(e) => setHorarioFesta(e.target.value)}
              required
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '1rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={onCancel} style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}>Cancelar</button>
            <button type="submit" style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--success)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Confirmar Festa</button>
          </div>
        </form>
      </div>
    </div>
  );
}
