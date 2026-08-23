import { useEffect, useState } from 'react';
import { Check, Printer, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import styles from './Saas.module.css';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PublicProposal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-proposal?token=${encodeURIComponent(token)}`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Proposta não encontrada.');
        setData(payload);
      } catch (loadError) {
        setError(loadError.message);
      }
    };
    load();
  }, [token]);

  const answer = async (action) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ token, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível registrar sua resposta.');
      setData((current) => ({ ...current, proposal: { ...current.proposal, status: payload.status } }));
    } catch (answerError) {
      setError(answerError.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <main className={styles.page}><div className={styles.shell}><div className={styles.error}>{error}</div></div></main>;
  if (!data) return <main className={styles.page}><div className={styles.shell}>Carregando proposta...</div></main>;

  const { proposal, company, settings } = data;
  const decided = ['accepted', 'rejected', 'confirmed'].includes(proposal.status);
  return (
    <main className={styles.page} style={{ '--proposal-color': settings?.primary_color || '#156f53' }}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            {settings?.logo_url ? <img className={styles.logo} src={settings.logo_url} alt="" /> : null}
            <div><h1 className={styles.title}>{company.nome}</h1><span className={styles.muted}>Proposta #{proposal.id.slice(0, 8)} · versão {proposal.version}</span></div>
          </div>
          <button className={styles.buttonSecondary} onClick={() => window.print()} title="Imprimir ou salvar em PDF"><Printer size={18} /></button>
        </header>

        <section className={styles.summary}>
          <div>
            <p className={styles.muted}>Preparada para</p>
            <h2>{proposal.customer_name}</h2>
            <p>{proposal.theme || 'Decoração personalizada'}</p>
            {proposal.event_date ? <p>{new Date(`${proposal.event_date}T12:00:00`).toLocaleDateString('pt-BR')} · {proposal.event_address || 'Local a definir'}</p> : null}
          </div>
          <div><span className={styles.muted}>Valor total</span><div className={styles.total}>{currency.format(proposal.total)}</div></div>
        </section>

        <section className={styles.band}>
          <table className={styles.table}>
            <thead><tr><th>Item</th><th>Quantidade</th><th>Valor</th></tr></thead>
            <tbody>{proposal.proposal_items.sort((a, b) => a.sort_order - b.sort_order).map((item, index) => (
              <tr key={`${item.description}-${index}`}><td>{item.description}</td><td>{item.quantity}</td><td>{currency.format(item.quantity * item.unit_price)}</td></tr>
            ))}</tbody>
            <tfoot><tr><th colSpan="2">Total</th><th>{currency.format(proposal.total)}</th></tr></tfoot>
          </table>
        </section>

        {proposal.terms ? <section><h2>Condições</h2><p style={{ whiteSpace: 'pre-wrap' }}>{proposal.terms}</p></section> : null}
        {settings?.pix_key ? <div className={styles.notice}><strong>PIX para o sinal:</strong> {settings.pix_key}</div> : null}
        <p className={styles.muted}>Válida até {new Date(`${proposal.valid_until}T12:00:00`).toLocaleDateString('pt-BR')}. O aceite registra esta versão e não representa assinatura eletrônica certificada.</p>
        {error ? <div className={styles.error}>{error}</div> : null}
        {decided ? (
          <div className={proposal.status === 'rejected' ? styles.notice : styles.success}>
            {proposal.status === 'rejected' ? 'Proposta recusada.' : proposal.status === 'confirmed' ? 'Proposta confirmada e sinal recebido.' : 'Proposta aceita. A decoradora confirmará o evento após o sinal.'}
          </div>
        ) : (
          <div className={styles.actions}>
            <button className={styles.button} disabled={busy} onClick={() => answer('accept')}><Check size={18} /> Aceitar proposta</button>
            <button className={styles.buttonSecondary} disabled={busy} onClick={() => answer('reject')}><X size={18} /> Recusar</button>
          </div>
        )}
      </div>
    </main>
  );
}
