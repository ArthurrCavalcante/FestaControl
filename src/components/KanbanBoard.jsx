import React from 'react';
import { PIPELINE_STAGES } from '../constants';
import styles from './KanbanBoard.module.css';

// UI Components
import Card from './ui/Card';
import Badge from './ui/Badge';
import IconButton from './ui/IconButton';
import Button from './ui/Button';
import { toast } from 'react-hot-toast';
import { useCompany } from '../hooks/useCompany';

// Icons
import { Clock, Truck, Package, Tag, ArrowRight, Filter, MessageCircle } from 'lucide-react';

export default function KanbanBoard({ leads, onLeadSelect, onMoveLead, acervo = [] }) {
  const { settings } = useCompany();
  const [filterMode, setFilterMode] = React.useState('ALL'); // ALL, THIS_MONTH, NEXT_MONTH

  const openWhatsApp = (e, telefone, nome, interesse) => {
    e.stopPropagation();
    if (settings?.companies?.is_demo) { toast.error('Ações externas estão desativadas no ambiente demo.'); return; }
    let num = telefone.replace(/\D/g, '');
    if (!num) { toast.error("Telefone inválido"); return; }
    if (num.length <= 11) num = '55' + num;
    
    const companyName = settings?.companies?.nome || 'FestaFlow';
    const msg = interesse && interesse !== '-' 
      ? `Olá ${nome}, tudo bem? Aqui é da ${companyName}. Vi que você tem interesse no tema ${interesse}.` 
      : `Olá ${nome}, tudo bem? Aqui é da ${companyName}.`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const filteredLeads = React.useMemo(() => {
    if (filterMode === 'ALL') return leads;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return leads.filter(l => {
      if (!l.data_festa) return false;
      const [yearStr, monthStr] = l.data_festa.split('-');
      const month = parseInt(monthStr, 10) - 1;
      const year = parseInt(yearStr, 10);

      if (filterMode === 'THIS_MONTH') {
        return month === currentMonth && year === currentYear;
      }
      if (filterMode === 'NEXT_MONTH') {
        let nextMonth = currentMonth + 1;
        let nextYear = currentYear;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear += 1;
        }
        return month === nextMonth && year === nextYear;
      }
      return true;
    });
  }, [leads, filterMode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface-color)' }}>
        <Filter size={20} color="var(--text-secondary)" />
        
        <div style={{ display: 'flex', background: 'var(--bg-color)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setFilterMode('ALL')}
            style={{ padding: '0.5rem 1rem', border: 'none', background: filterMode === 'ALL' ? 'var(--primary)' : 'transparent', color: filterMode === 'ALL' ? 'white' : 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem', transition: 'all 0.2s' }}
          >
            Todas as Festas
          </button>
          <button 
            onClick={() => setFilterMode('THIS_MONTH')}
            style={{ padding: '0.5rem 1rem', border: 'none', background: filterMode === 'THIS_MONTH' ? 'var(--primary)' : 'transparent', color: filterMode === 'THIS_MONTH' ? 'white' : 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem', transition: 'all 0.2s' }}
          >
            Este Mês
          </button>
          <button 
            onClick={() => setFilterMode('NEXT_MONTH')}
            style={{ padding: '0.5rem 1rem', border: 'none', background: filterMode === 'NEXT_MONTH' ? 'var(--primary)' : 'transparent', color: filterMode === 'NEXT_MONTH' ? 'white' : 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem', transition: 'all 0.2s' }}
          >
            Próximo Mês
          </button>
        </div>

        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: 'auto' }}>
          {filteredLeads.length} cartões encontrados
        </span>
      </div>
      <div className={styles.container}>
        {PIPELINE_STAGES.map(stage => {
          const stageLeads = filteredLeads.filter(l => l.status === stage.id);
        
        return (
          <div 
            key={stage.id} 
            className={styles.column}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dealId = e.dataTransfer.getData('dealId');
              if (dealId && onMoveLead) {
                onMoveLead(dealId, stage.id);
              }
            }}
          >
            <div 
              className={styles.columnHeader} 
              style={{ '--column-color': stage.color }}
            >
              <h3 className={styles.columnTitle}>
                {stage.label}
              </h3>
              <span className={styles.columnBadge}>
                {stageLeads.length}
              </span>
            </div>

            <div className={styles.cardList}>
              {stageLeads.map(lead => {
                let locationStr = null;
                if (Array.isArray(acervo)) {
                  if (lead.tema_id) {
                    const match = acervo.find(a => a.id === lead.tema_id);
                    if (match?.localizacao) locationStr = match.localizacao;
                  } else if (lead.interesse) {
                    const match = acervo.find(a => a.nome?.toLowerCase() === lead.interesse?.toLowerCase());
                    if (match?.localizacao) locationStr = match.localizacao;
                  }
                }

                return (
                <div 
                  key={lead.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('dealId', lead.id)}
                >
                  <Card 
                    padding="sm" 
                    hoverable 
                    onClick={() => onLeadSelect(lead)}
                  >
                    <div className={styles.cardContent}>
                      <div className={styles.cardHeader}>
                        <div style={{ flex: 1 }}>
                          <h4 className={styles.clientName}>{lead.nome}</h4>
                          <div className={styles.metaInfo}>
                            {lead.modalidade === 'FRETADA' ? (
                              <Badge size="sm" variant="primary" icon={Truck}>Fretada</Badge>
                            ) : lead.modalidade === 'PEGUE_MONTE' ? (
                              <Badge size="sm" variant="default" icon={Package}>Pegue e Monte</Badge>
                            ) : null}
                          </div>
                        </div>
                        
                        {lead.created_at && (() => {
                          const hours = Math.floor((new Date() - new Date(lead.created_at)) / (1000 * 60 * 60));
                          const label = hours < 1 ? '< 1h' : hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
                          const timeVariant = hours > 48 ? 'danger' : 'warning';
                          
                          return (
                            <Badge size="sm" variant={timeVariant} icon={Clock}>
                              {label}
                            </Badge>
                          );
                        })()}
                      </div>

                      <div className={styles.themeText}>
                        {lead.interesse}
                        {locationStr && (
                          <span className={styles.locationTag} title="Localização no Acervo">
                            <Package size={12} style={{marginRight: 4}}/>
                            {locationStr}
                          </span>
                        )}
                      </div>

                      <div className={styles.cardFooter}>
                        <Badge size="sm" variant="default" icon={Tag}>
                          {lead.origem || 'Desconhecida'}
                        </Badge>
                        
                        <select 
                          className={styles.mobileSelect} 
                          value={lead.status}
                          onChange={(e) => onMoveLead && onMoveLead(lead.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button 
                            className={styles.messageBtn}
                            onClick={(e) => openWhatsApp(e, lead.telefone, lead.nome, lead.interesse)}
                            title="Enviar Mensagem"
                          >
                            <MessageCircle size={18} />
                          </button>
                          <IconButton 
                            icon={ArrowRight} 
                            variant="ghost" 
                            color="primary" 
                            title="Abrir Ficha"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
                );
              })}
              
              {stageLeads.length === 0 && (
                <div className={styles.emptyState}>
                  {stage.id === 'NOVOS' ? 'Nenhum novo contato hoje' : 'Solte cards aqui'}
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
