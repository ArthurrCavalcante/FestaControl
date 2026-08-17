import React, { useMemo } from 'react';
import styles from './MobileHub.module.css';
import { Plus, Calendar, KanbanSquare, Users, Image as ImageIcon, Bell } from 'lucide-react';

export default function MobileHub({ 
  session, 
  leads = [], 
  onNavigate, 
  onNovoOrcamento 
}) {
  const userName = session?.user?.user_metadata?.full_name || 
                   session?.user?.user_metadata?.name || 
                   session?.user?.email?.split('@')[0] || 
                   'visitante';

  const { eventosProximosCount, orcamentosAbertosCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    let proximos = 0;
    let abertos = 0;

    leads.forEach(lead => {
      if (lead.status === 'CONFIRMADO' && lead.data_festa) {
        const partyDate = new Date(lead.data_festa + 'T00:00:00');
        if (partyDate >= today) proximos++;
      } else if (['NOVOS', 'NEGOCIACAO', 'SINAL'].includes(lead.status)) {
        abertos++;
      }
    });

    return { eventosProximosCount: proximos, orcamentosAbertosCount: abertos };
  }, [leads]);

  return (
    <div className={styles.hubContainer}>
      <div className={styles.welcomeSection}>
        <h2 className={styles.greeting}>Olá, {userName} 👋</h2>
        <p className={styles.subtitle}>O que você quer fazer agora?</p>
        
        {(eventosProximosCount > 0 || orcamentosAbertosCount > 0) && (
          <div className={styles.metricsBadge} onClick={() => onNavigate('agenda')}>
            <Bell size={14} />
            Você tem <span>{eventosProximosCount} festas</span> em breve
          </div>
        )}
      </div>

      <div className={styles.grid}>
        {/* Ação Primária em Destaque */}
        <div 
          className={`${styles.card} ${styles.fullWidth} ${styles.primary}`} 
          onClick={onNovoOrcamento}
        >
          <div className={styles.iconWrapper}>
            <Plus size={24} />
          </div>
          <div className={styles.fullWidthText}>
            <h3 className={styles.cardTitle}>Novo Orçamento</h3>
            <p className={styles.cardDescription}>Criar proposta para cliente</p>
          </div>
        </div>

        {/* Atalhos Principais */}
        <div className={styles.card} onClick={() => onNavigate('agenda')}>
          <div className={styles.iconWrapper}>
            <Calendar size={24} />
          </div>
          <h3 className={styles.cardTitle}>Agenda</h3>
          <p className={styles.cardDescription}>Ver festas e datas</p>
        </div>

        <div className={styles.card} onClick={() => onNavigate('pipeline')}>
          <div className={styles.iconWrapper}>
            <KanbanSquare size={24} />
          </div>
          <h3 className={styles.cardTitle}>Funil</h3>
          <p className={styles.cardDescription}>Acompanhar vendas</p>
        </div>

        <div className={styles.card} onClick={() => onNavigate('leads')}>
          <div className={styles.iconWrapper}>
            <Users size={24} />
          </div>
          <h3 className={styles.cardTitle}>Clientes</h3>
          <p className={styles.cardDescription}>Base de contatos</p>
        </div>

        <div className={styles.card} onClick={() => onNavigate('catalogo')}>
          <div className={styles.iconWrapper}>
            <ImageIcon size={24} />
          </div>
          <h3 className={styles.cardTitle}>Catálogo</h3>
          <p className={styles.cardDescription}>Itens e temas</p>
        </div>
      </div>
    </div>
  );
}
