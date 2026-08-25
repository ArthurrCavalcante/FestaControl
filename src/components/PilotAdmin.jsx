import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import styles from './Saas.module.css';
import { summarizeOperationalHealth, summarizeProductEvents } from '../services/productAnalytics';

export default function PilotAdmin() {
  const [data, setData] = useState({ companies: [], subscriptions: [], events: [], member_counts: {}, health: {} });
  const [error, setError] = useState('');
  const load = async () => {
    const { data: response, error: loadError } = await supabase.functions.invoke('pilot-admin', { method: 'GET' });
    if (loadError) return setError(loadError.message);
    setData(response);
  };
  useEffect(() => { load(); }, []);

  const metrics = useMemo(() => {
    const active = data.subscriptions.filter((row) => row.status === 'active').length;
    const acceptedCompanies = new Set(data.events.filter((row) => row.event_name === 'proposal_accepted').map((row) => row.company_id));
    const activatedCompanies = new Set(data.events.filter((row) => row.event_name === 'onboarding_completed').map((row) => row.company_id));
    const sent = data.events.filter((row) => row.event_name === 'proposal_sent').length;
    const accepted = data.events.filter((row) => row.event_name === 'proposal_accepted').length;
    const product = summarizeProductEvents(data.events);
    const health = summarizeOperationalHealth(data.health);
    return {
      active,
      mrr: active * 99,
      acceptedCompanies: acceptedCompanies.size,
      activated: activatedCompanies.size,
      conversion: sent ? Math.round((accepted / sent) * 100) : 0,
      churned: data.subscriptions.filter((row) => ['canceled', 'suspended'].includes(row.status)).length,
      messages: data.subscriptions.reduce((sum, row) => sum + Number(row.inbound_messages || 0) + Number(row.outbound_messages || 0), 0),
      support: data.subscriptions.reduce((sum, row) => sum + Number(row.support_minutes || 0), 0),
      ...product,
      ...health,
    };
  }, [data]);

  const updateSubscription = async (companyId, updates) => {
    const { error: updateError } = await supabase.functions.invoke('pilot-admin', { method: 'PATCH', body: { company_id: companyId, ...updates } });
    if (updateError) return setError(updateError.message);
    load();
  };

  return (
    <section className={styles.shell}>
      <div className={styles.topbar}><div><h2>Piloto FestaControl</h2><p className={styles.muted}>Ativação, conversão e suporte sem dados pessoais de clientes.</p></div></div>
      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.grid}>
        <div><span className={styles.muted}>Empresas pagantes</span><div className={styles.total}>{metrics.active}</div></div>
        <div><span className={styles.muted}>MRR reconciliado</span><div className={styles.total}>R$ {metrics.mrr}</div></div>
        <div><span className={styles.muted}>Empresas com aceite em 30 dias</span><div className={styles.total}>{metrics.acceptedCompanies}</div></div>
        <div><span className={styles.muted}>Empresas no piloto</span><div className={styles.total}>{data.companies.filter((row) => !row.is_demo).length}</div></div>
        <div><span className={styles.muted}>Empresas ativas em 30 dias</span><div className={styles.total}>{metrics.activeCompanies}</div></div>
        <div><span className={styles.muted}>Empresas criando propostas</span><div className={styles.total}>{metrics.proposingCompanies}</div></div>
        <div><span className={styles.muted}>Empresas usando WhatsApp</span><div className={styles.total}>{metrics.whatsappCompanies}</div></div>
        <div><span className={styles.muted}>Onboardings concluídos</span><div className={styles.total}>{metrics.activated}</div></div>
        <div><span className={styles.muted}>Conversão de propostas</span><div className={styles.total}>{metrics.conversion}%</div></div>
        <div><span className={styles.muted}>Contas suspensas/canceladas</span><div className={styles.total}>{metrics.churned}</div></div>
        <div><span className={styles.muted}>Mensagens no período</span><div className={styles.total}>{metrics.messages}</div></div>
        <div><span className={styles.muted}>Suporte acumulado</span><div className={styles.total}>{metrics.support} min</div></div>
        <div><span className={styles.muted}>Erros nas últimas 24h</span><div className={styles.total}>{metrics.errors24h}</div></div>
        <div><span className={styles.muted}>Eventos falhos nas últimas 24h</span><div className={styles.total}>{metrics.failedEvents24h}</div></div>
      </div>
      <div className={styles.list} style={{ marginTop: 28 }}>
        {data.companies.filter((company) => !company.is_demo).map((company) => {
          const subscription = data.subscriptions.find((row) => row.company_id === company.id);
          return <article className={styles.row} key={company.id}>
            <div><strong>{company.nome}</strong><p className={styles.muted}>{data.member_counts[company.id] || 0} usuário(s) · {subscription?.support_minutes || 0} min de suporte</p></div>
            <div className={styles.grid}><label className={styles.field}>Assinatura<select value={subscription?.status || 'trialing'} onChange={(event) => updateSubscription(company.id, { status: event.target.value })}><option value="trialing">Teste</option><option value="active">Ativa</option><option value="past_due">Em atraso</option><option value="suspended">Suspensa</option><option value="canceled">Cancelada</option></select></label><label className={styles.field}>Minutos de suporte<input type="number" min="0" defaultValue={subscription?.support_minutes || 0} onBlur={(event) => updateSubscription(company.id, { support_minutes: Number(event.target.value) })} /></label></div>
          </article>;
        })}
      </div>
    </section>
  );
}
