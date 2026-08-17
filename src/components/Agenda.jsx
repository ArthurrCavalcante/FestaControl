import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import styles from './Agenda.module.css';

// UI Components
import Card from './ui/Card';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';

// Icons
import { 
  Calendar as CalendarIcon, 
  Search, 
  Truck, 
  Package, 
  PlayCircle, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  CircleDollarSign,
  Lock,
  Flag
} from 'lucide-react';

const STATUS_MAP = {
  'RASCUNHO': { label: 'Orçamento/Pendente', variant: 'default' },
  'AGUARDANDO': { label: 'Aguardando', variant: 'default' },
  'EM_PREPARACAO': { label: 'Em preparação', variant: 'warning' },
  'EM_MONTAGEM': { label: 'Em montagem', variant: 'primary' },
  'FINALIZADA': { label: 'Finalizada', variant: 'success' },
  'PROBLEMA': { label: 'Problema', variant: 'danger' }
};

export default function Agenda({ acervo = [] }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [filterMode, setFilterMode] = useState('THIS_MONTH'); // ALL, THIS_WEEK, THIS_MONTH
  const [selectedFesta, setSelectedFesta] = useState(null);
  const [festas, setFestas] = useState([]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase.from('events').select('*, deals(*, leads(*))');
      if (error) {
        console.error('Erro ao buscar eventos:', error);
        return;
      }
      if (data) {
        const grouped = {};
        data.forEach(evt => {
          const dealObj = Array.isArray(evt.deals) ? evt.deals[0] : evt.deals;
          const leadObj = dealObj ? (Array.isArray(dealObj.leads) ? dealObj.leads[0] : dealObj.leads) : null;

          let d = dealObj?.data_festa || evt.data_evento;
          if (!d) d = new Date().toISOString().split('T')[0];
          if (typeof d === 'string' && d.includes('T')) d = d.split('T')[0];
          
          if (!grouped[d]) {
            grouped[d] = {
              dia: d,
              date: d,
              festas: []
            };
          }

          grouped[d].festas.push({
            id: evt.id,
            horario: dealObj?.horario_festa || evt.horario || 'Sem Horário',
            cliente: leadObj?.nome || 'Cliente Desconhecido',
            tema: dealObj?.tema || 'Sem Tema',
            tema_id: dealObj?.tema_id || null,
            modalidade: dealObj?.modalidade || 'PEGUE_MONTE',
            statusOp: evt.status_operacional,
            alertaFin: evt.pendencia_pagamento,
            endereco: dealObj?.endereco || evt.endereco || 'A Combinar',
            checklist: evt.checklist || {}
          });
        });
        
        const sorted = Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
        setFestas(sorted);
      }
    } catch (err) {
      console.error('Erro inesperado no fetchEvents:', err);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const displayedFestas = React.useMemo(() => {
    // A busca por data específica sobrepõe os filtros rápidos (permite consultar histórico)
    if (selectedDate) {
      return festas.filter(dia => dia.date === selectedDate);
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    // Filtra para manter na timeline padrão apenas festas de hoje ou futuras
    const futureOrToday = festas.filter(dia => {
      if (!dia.date) return false;
      const [y, m, d] = dia.date.split('-');
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      dateObj.setHours(0,0,0,0);
      return dateObj >= today;
    });

    if (filterMode === 'ALL') return futureOrToday;

    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Calcula o início e o fim da semana atual
    const firstDayOfWeek = new Date(today);
    firstDayOfWeek.setDate(today.getDate() - today.getDay());
    firstDayOfWeek.setHours(0,0,0,0);
    
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
    lastDayOfWeek.setHours(23,59,59,999);

    return futureOrToday.filter(dia => {
      if (!dia.date) return false;
      const [y, m, d] = dia.date.split('-');
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      
      if (filterMode === 'THIS_MONTH') {
        return dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear;
      }
      
      if (filterMode === 'THIS_WEEK') {
        return dateObj >= firstDayOfWeek && dateObj <= lastDayOfWeek;
      }

      return true;
    });
  }, [festas, selectedDate, filterMode]);

  const handleChecklistChange = async (festaId, item, isChecked) => {
    try {
      const festa = festas.flatMap(d => d.festas).find(f => f.id === festaId);
      const newChecklist = { ...festa.checklist, [item]: isChecked };
      
      const { error } = await supabase.from('events').update({ checklist: newChecklist }).eq('id', festaId);
      if (error) throw error;
      
      setFestas(festas.map(dia => ({
        ...dia,
        festas: dia.festas.map(f => f.id === festaId ? { ...f, checklist: newChecklist } : f)
      })));
      
      if (selectedFesta && selectedFesta.id === festaId) {
        setSelectedFesta({ ...selectedFesta, checklist: newChecklist });
      }
    } catch (err) {
      console.error('Erro ao atualizar checklist:', err);
    }
  };

  const handleUpdateStatus = async (festaId, novoStatus) => {
    const { error } = await supabase.from('events').update({ status_operacional: novoStatus }).eq('id', festaId);
    if (!error) {
      fetchEvents();
      if (selectedFesta && selectedFesta.id === festaId) {
        setSelectedFesta({ ...selectedFesta, statusOp: novoStatus });
      }
    } else {
      console.error(error);
    }
  };

  return (
    <div className={styles.container}>
      
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h2>Agenda Logística</h2>
          <p>Acompanhe os eventos e operações agendadas.</p>
        </div>
        
        <div className={styles.searchBox}>
          {!selectedDate && (
            <div className={styles.filterLinks}>
              <button 
                onClick={() => setFilterMode('ALL')}
                className={`${styles.filterLink} ${filterMode === 'ALL' ? styles.filterLinkActive : ''}`}
              >
                Todas
              </button>
              <span>·</span>
              <button 
                onClick={() => setFilterMode('THIS_WEEK')}
                className={`${styles.filterLink} ${filterMode === 'THIS_WEEK' ? styles.filterLinkActive : ''}`}
              >
                Esta semana
              </button>
              <span>·</span>
              <button 
                onClick={() => setFilterMode('THIS_MONTH')}
                className={`${styles.filterLink} ${filterMode === 'THIS_MONTH' ? styles.filterLinkActive : ''}`}
              >
                Este mês
              </button>
            </div>
          )}
          <span className={styles.searchLabel}>
            <Search size={18} /> Buscar Data:
          </span>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={styles.dateInput}
          />
          {selectedDate && (
            <button onClick={() => setSelectedDate('')} className={styles.clearBtn}>
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Nível 1: Visão Rápida */}
      <div className={styles.timeline}>
        {displayedFestas.length === 0 ? (
          <div style={{ margin: 'auto', maxWidth: '300px', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <EmptyState 
              icon={CalendarIcon}
              title="Nenhuma festa agendada"
              description="Não há eventos para o período selecionado."
              action={{
                label: "Criar evento",
                icon: Plus,
                onClick: onNovoOrcamento || (() => toast('Criar evento em breve')),
                variant: 'secondary'
              }}
            />
          </div>
        ) : displayedFestas.map(dia => (
          <div key={dia.dia} className={styles.dayColumn}>
            <h3 className={styles.dayTitle}>
              {(() => {
                if (!dia.dia) return '';
                const [yyyy, mm, dd] = dia.dia.split('T')[0].split('-');
                return `${dd}/${mm}/${yyyy}`;
              })()}
            </h3>
            
            <div className={styles.dayCards}>
              {dia.festas.map(festa => {
                const status = STATUS_MAP[festa.statusOp];
                let locationStr = null;
                if (Array.isArray(acervo)) {
                  if (festa.tema_id) {
                    const match = acervo.find(a => a.id === festa.tema_id);
                    if (match?.localizacao) locationStr = match.localizacao;
                  } else if (festa.tema) {
                    const match = acervo.find(a => a.nome?.toLowerCase() === festa.tema?.toLowerCase());
                    if (match?.localizacao) locationStr = match.localizacao;
                  }
                }

                return (
                  <Card 
                    key={festa.id} 
                    padding="sm" 
                    hoverable 
                    onClick={() => setSelectedFesta(festa)}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.timeLabel}>{festa.horario}</span>
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                    </div>
                    
                    <div className={styles.cardBody}>
                      <div className={styles.clientText}>{festa.cliente}</div>
                      <div className={styles.themeText}>
                        {festa.tema}
                        {locationStr && (
                          <span className={styles.locationTag} style={{marginLeft: 8}} title="Localização no Acervo">
                            <Package size={12} style={{marginRight: 4}}/>
                            {locationStr}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className={styles.cardFooter}>
                      {festa.modalidade === 'FRETADA' ? (
                        <Badge size="sm" variant="primary" icon={Truck}>Fretada</Badge>
                      ) : (
                        <Badge size="sm" variant="default" icon={Package}>Pegue e Monte</Badge>
                      )}
                      
                      {festa.alertaFin && (
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <AlertTriangle size={14} /> Pendente
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Nível 2: Modal Profundo usando o novo Design System */}
      <Modal 
        isOpen={!!selectedFesta} 
        onClose={() => setSelectedFesta(null)}
        title={selectedFesta?.cliente}
        icon={CalendarIcon}
        maxWidth="lg"
      >
        {selectedFesta && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Meta Header */}
            <div className={styles.modalSubtitle}>
              {selectedFesta.modalidade === 'FRETADA' ? (
                <Badge variant="primary" icon={Truck}>Fretada</Badge>
              ) : (
                <Badge variant="default" icon={Package}>Pegue e Monte</Badge>
              )}
              <span>Horário: <strong>{selectedFesta.horario}</strong></span>
              <span>
                Tema: <strong>{selectedFesta.tema}</strong>
                {(() => {
                  let locationStr = null;
                  if (Array.isArray(acervo)) {
                    if (selectedFesta.tema_id) {
                      const match = acervo.find(a => a.id === selectedFesta.tema_id);
                      if (match?.localizacao) locationStr = match.localizacao;
                    } else if (selectedFesta.tema) {
                      const match = acervo.find(a => a.nome?.toLowerCase() === selectedFesta.tema?.toLowerCase());
                      if (match?.localizacao) locationStr = match.localizacao;
                    }
                  }
                  return locationStr ? (
                    <span className={styles.locationTag} style={{marginLeft: 8, display: 'inline-flex', alignItems: 'center'}}><Package size={14} style={{ marginRight: 4 }} /> {locationStr}</span>
                  ) : null;
                })()}
              </span>
            </div>

            {/* Painel Operacional - Destaque Absoluto */}
            <Card padding="md" style={{ border: '2px solid var(--primary-light)', background: 'var(--bg-color)' }}>
              <h4 className={styles.sectionTitle}>Status Operacional</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedFesta.statusOp === 'AGUARDANDO' && (
                  <Button 
                    size="lg" 
                    variant="primary" 
                    icon={PlayCircle} 
                    onClick={() => handleUpdateStatus(selectedFesta.id, 'EM_PREPARACAO')}
                    style={{ width: '100%', fontSize: '1.1rem' }}
                  >
                    INICIAR SEPARAÇÃO
                  </Button>
                )}
                {selectedFesta.statusOp === 'EM_PREPARACAO' && (
                  <Button 
                    size="lg" 
                    variant="primary" 
                    icon={Truck} 
                    onClick={() => handleUpdateStatus(selectedFesta.id, 'EM_MONTAGEM')}
                    style={{ width: '100%', fontSize: '1.1rem' }}
                  >
                    SAIR PARA ENTREGA
                  </Button>
                )}
                {selectedFesta.statusOp === 'EM_MONTAGEM' && (
                  <Button 
                    size="lg" 
                    variant="success" 
                    icon={CheckCircle2} 
                    onClick={() => handleUpdateStatus(selectedFesta.id, 'FINALIZADA')}
                    style={{ width: '100%', fontSize: '1.1rem' }}
                  >
                    CONFIRMAR MONTAGEM
                  </Button>
                )}
                {selectedFesta.statusOp === 'FINALIZADA' && (
                  <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--success-light)', color: 'var(--success)', fontWeight: 700, fontSize: '1.1rem', textAlign: 'center', border: '1px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 /> FESTA ENTREGUE COM SUCESSO!
                  </div>
                )}
                {selectedFesta.statusOp !== 'PROBLEMA' && selectedFesta.statusOp !== 'FINALIZADA' && (
                  <Button 
                    variant="ghost" 
                    icon={Flag} 
                    onClick={() => handleUpdateStatus(selectedFesta.id, 'PROBLEMA')}
                    style={{ color: 'var(--danger)' }}
                  >
                    Reportar Problema Logístico
                  </Button>
                )}
              </div>
            </Card>

            {/* Endereço */}
            <Card padding="md">
              <h4 className={styles.sectionTitle}>Endereço de Montagem</h4>
              <p className={styles.addressText}>{selectedFesta.endereco}</p>
              {selectedFesta.modalidade === 'FRETADA' && (
                <div style={{ marginTop: '1.5rem' }}>
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedFesta.endereco)}`}
                    target="_blank" 
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <Button variant="primary" icon={MapPin} style={{ width: '100%' }}>
                      Iniciar Rota no Maps
                    </Button>
                  </a>
                </div>
              )}
            </Card>

            {/* Alerta Financeiro Crítico */}
            {selectedFesta.alertaFin && (
              <div className={styles.alertBox}>
                <div className={styles.alertHeader}>
                  <AlertTriangle size={32} />
                  <div>
                    <h4>Alerta Financeiro</h4>
                    <p>{selectedFesta.alertaFin}. Cobrar no local!</p>
                  </div>
                </div>
                <Button disabled variant="secondary" icon={Lock} style={{ width: '100%' }}>
                  Cobrar PIX e Gerar Recibo (Em breve)
                </Button>
              </div>
            )}

            {/* Checklist */}
            <Card padding="md">
              <h4 className={styles.sectionTitle}>Checklist Logístico (Carregamento)</h4>
              <div className={styles.checklist}>
                {['1x Painel Redondo MDF', '3x Cilindros Transparentes', 'Kit de Personagens de Mesa', 'Estrutura do Arco de Balões'].map(item => (
                  <label key={item} className={styles.checkItem}>
                    <input 
                      type="checkbox" 
                      checked={selectedFesta.checklist?.[item] || false}
                      onChange={(e) => handleChecklistChange(selectedFesta.id, item, e.target.checked)}
                    /> 
                    {item}
                  </label>
                ))}
              </div>
            </Card>

          </div>
        )}
      </Modal>

    </div>
  );
}
