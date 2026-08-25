import { useEffect, useState } from 'react';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useCompany } from '../hooks/useCompany';
import { buildActivationChecklist } from '../services/activationChecklist';
import styles from './ActivationChecklist.module.css';

export default function ActivationChecklist({ onNavigate }) {
  const { settings } = useCompany();
  const [checklist, setChecklist] = useState(null);

  useEffect(() => {
    if (!settings?.company_id) return;
    let cancelled = false;
    Promise.all([
      supabase.from('acervo').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('team_invitations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('proposals').select('id', { count: 'exact', head: true }),
      supabase.from('company_connections').select('id', { count: 'exact', head: true }).eq('platform', 'evolution').eq('status', 'ACTIVE'),
    ]).then(([inventory, members, invitations, proposals, whatsapp]) => {
      if (cancelled) return;
      setChecklist(buildActivationChecklist({
        hasCompanyDetails: Boolean(settings.telefone && settings.pix_key),
        inventoryCount: inventory.count ?? 0,
        memberCount: members.count ?? 0,
        invitationCount: invitations.count ?? 0,
        proposalCount: proposals.count ?? 0,
        whatsappConnected: (whatsapp.count ?? 0) > 0 && settings.whatsapp_status === 'connected',
      }));
    });
    return () => { cancelled = true; };
  }, [settings]);

  if (!checklist || (checklist.completedRequired === checklist.requiredTotal && checklist.steps.at(-1)?.complete)) return null;
  const progress = Math.round((checklist.completedRequired / checklist.requiredTotal) * 100);

  return <section className={styles.band} aria-label="Primeiros passos">
    <div className={styles.summary}>
      <div><span>PRIMEIROS PASSOS</span><h3>Deixe sua operação pronta para o primeiro evento</h3></div>
      <strong>{progress}%</strong>
    </div>
    <div className={styles.progress}><span style={{ width: `${progress}%` }} /></div>
    <div className={styles.steps}>{checklist.steps.map((step) => <button key={step.id} onClick={() => onNavigate(step.tab)}>
      {step.complete ? <Check size={17} /> : <Circle size={17} />}
      <span>{step.label}{step.optional ? <small>Opcional</small> : null}</span>
      <ChevronRight size={17} />
    </button>)}</div>
  </section>;
}
