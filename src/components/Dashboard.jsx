import React, { useMemo } from 'react';
import styles from './Dashboard.module.css';
import Button from './ui/Button';
import { Plus } from 'lucide-react';
import Badge from './ui/Badge';

export default function Dashboard({ leads = [], inboxTasksCount = 0, onNovoOrcamento, session }) {
  const userName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'visitante';

  const { metrics, recentActivities } = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    let eventosProximosCount = 0;
    let orcamentosAbertosCount = 0;
    let aguardandoRespostaCount = 0;
    const proximosEventosList = [];
    const activities = [];

    leads.forEach(lead => {
      // Metrics & Events
      if (lead.status === 'CONFIRMADO' && lead.data_festa) {
        const partyDate = new Date(lead.data_festa + 'T00:00:00');
        if (partyDate >= today) {
          eventosProximosCount++;
          proximosEventosList.push({ ...lead, parsedDate: partyDate });
        }
      } else if (['NOVOS', 'NEGOCIACAO', 'SINAL'].includes(lead.status)) {
        orcamentosAbertosCount++;
        if (lead.status === 'SINAL' || lead.status === 'NEGOCIACAO') {
          aguardandoRespostaCount++;
        }
      }

      // Recent Activities (derived from created_at and confirmado_em)
      if (lead.created_at) {
        activities.push({
          id: `create-${lead.id}`,
          date: new Date(lead.created_at),
          title: 'Novo orçamento criado',
          subtitle: `${lead.nome}${lead.tema ? ` · ${lead.tema}` : ''}`,
        });
      }
      
      if (lead.confirmado_em) {
        activities.push({
          id: `confirm-${lead.id}`,
          date: new Date(lead.confirmado_em),
          title: `Evento confirmado`,
          subtitle: lead.nome,
        });
      }
    });

    proximosEventosList.sort((a, b) => a.parsedDate - b.parsedDate);
    activities.sort((a, b) => b.date - a.date);

    return {
      metrics: {
        eventosProximosCount,
        orcamentosAbertosCount,
        aguardandoRespostaCount,
        proximosEventosList: proximosEventosList.slice(0, 5) // Mostrar apenas os 5 mais próximos
      },
      recentActivities: activities.slice(0, 5)
    };
  }, [leads]);

  const formatDate = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    return `${day} ${month}`;
  };

  const formatActivityDate = (dateObj) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateObj.toDateString() === today.toDateString()) return 'Hoje';
    if (dateObj.toDateString() === yesterday.toDateString()) return 'Ontem';
    
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = dateObj.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    return `${day} ${month}`;
  };

  const formatCurrency = (val) => {
    if (!val) return 'R$ 0,00';
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.headerRow}>
        <div className={styles.greetingSection}>
          <span className={styles.eyebrow}>OPERAÇÃO DE HOJE</span>
          <h2>Olá, {userName}.</h2>
          <p>Festas, vendas e pendências que precisam da sua atenção.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={onNovoOrcamento}>
          Novo orçamento
        </Button>
      </div>

      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricValue}>{metrics.eventosProximosCount}</span>
          <span className={styles.metricLabel}>Eventos próximos</span>
          <span className={styles.metricSubLabel}>
            {metrics.eventosProximosCount === 0 ? 'Nenhuma festa confirmada' : 'Próximas montagens em foco'}
          </span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricValue}>{metrics.orcamentosAbertosCount}</span>
          <span className={styles.metricLabel}>Orçamentos em andamento</span>
          <span className={styles.metricSubLabel}>
            {metrics.aguardandoRespostaCount > 0 ? `${metrics.aguardandoRespostaCount} pedem retorno` : 'Acompanhe as negociações'}
          </span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricValue}>{inboxTasksCount}</span>
          <span className={styles.metricLabel}>Pendências hoje</span>
          <span className={styles.metricSubLabel}>
            {inboxTasksCount === 0 ? 'Sem urgências agora' : 'Não deixe cliente esperando'}
          </span>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.mainCol}>
          <div className={styles.sectionTitle}>
            Próximos eventos
          </div>

          <div className={styles.tableContainer}>
            {metrics.proximosEventosList.length > 0 ? (
              <table className={styles.eventsTable}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Tema / Tipo</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.proximosEventosList.map(evento => (
                    <tr key={evento.id}>
                      <td style={{ fontWeight: 600 }}>{formatDate(evento.data_festa)}</td>
                      <td>{evento.nome}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{evento.tema || evento.interesse || '-'}</td>
                      <td>{formatCurrency(evento.valor_total)}</td>
                      <td><Badge variant="success">Confirmado</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyState}>
                Nenhum evento futuro confirmado.
                <Button variant="secondary" onClick={onNovoOrcamento} icon={Plus}>Criar evento</Button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.sideCol}>
          <div className={styles.sectionTitle}>
            Atividade recente
          </div>
          
          {recentActivities.length > 0 ? (
            <div className={styles.activityList}>
              {recentActivities.map(activity => (
                <div key={activity.id} className={styles.activityItem}>
                  <span className={styles.activityTime}>{formatActivityDate(activity.date)}</span>
                  <div className={styles.activityContent}>
                    <div className={styles.activityTitle}>{activity.title}</div>
                    <div className={styles.activitySubtitle}>{activity.subtitle}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className={styles.activityList} style={{ padding: '2rem 1.25rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
               Nenhuma atividade.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
