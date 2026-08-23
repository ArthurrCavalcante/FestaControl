import { useEffect, useState } from 'react';
import { Copy, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import styles from './Saas.module.css';

export default function TeamSubscription() {
  const [data, setData] = useState({ members: [], invitations: [], subscription: null });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [lastLink, setLastLink] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const { data: response, error: loadError } = await supabase.functions.invoke('team-invite', { method: 'GET' });
    if (loadError) return setError(loadError.message);
    setData(response);
  };
  useEffect(() => { load(); }, []);

  const invite = async (event) => {
    event.preventDefault();
    const { data: response, error: inviteError } = await supabase.functions.invoke('team-invite', { body: { email, role } });
    if (inviteError) return toast.error(inviteError.message);
    const link = `${window.location.origin}/convite/${response.token}`;
    setLastLink(link);
    await navigator.clipboard.writeText(link);
    setEmail('');
    toast.success('Convite criado e copiado. Envie o link por um canal seguro.');
    load();
  };

  const subscription = data.subscription;
  return (
    <section className={styles.shell}>
      <div className={styles.topbar}><div><h2>Equipe e assinatura</h2><p className={styles.muted}>Plano Fundador · até 3 usuários.</p></div><span className={styles.status}>{subscription?.status || 'carregando'}</span></div>
      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.band}>
        <div className={styles.summary}>
          <div><h3>R$ 99/mês ou R$ 990/ano</h3><p className={styles.muted}>Eventos e clientes ilimitados no piloto, uma conexão WhatsApp Evolution beta.</p></div>
          <div><strong>{data.members.length}/3 usuários</strong><p className={styles.muted}>{subscription?.billing_cycle === 'annual' ? 'Ciclo anual' : 'Ciclo mensal'}</p></div>
        </div>
      </div>
      <h3>Membros</h3>
      <div className={styles.list}>{data.members.map((member) => <div className={styles.row} key={member.id}><div><strong>{member.nome || 'Usuário'}</strong><p className={styles.muted}>{member.role}</p></div></div>)}</div>
      <h3 style={{ marginTop: 28 }}>Convidar pessoa</h3>
      <form className={styles.grid} onSubmit={invite}>
        <label className={styles.field}>E-mail<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className={styles.field}>Papel<select value={role} onChange={(event) => setRole(event.target.value)}><option value="staff">Equipe</option><option value="manager">Gerente</option></select></label>
        <button className={styles.button} disabled={data.members.length >= 3}><UserPlus size={18} /> Criar convite</button>
      </form>
      {lastLink ? <div className={styles.success}><div className={styles.actions}><span style={{ overflowWrap: 'anywhere' }}>{lastLink}</span><button className={styles.buttonSecondary} title="Copiar link" onClick={() => navigator.clipboard.writeText(lastLink)}><Copy size={17} /></button></div></div> : null}
      {data.invitations.length ? <><h3 style={{ marginTop: 28 }}>Convites</h3><div className={styles.list}>{data.invitations.map((inviteRow) => <div className={styles.row} key={inviteRow.id}><div><strong>{inviteRow.email}</strong><p className={styles.muted}>{inviteRow.role} · {inviteRow.status}</p></div></div>)}</div></> : null}
    </section>
  );
}
