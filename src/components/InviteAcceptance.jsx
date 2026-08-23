import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Login from './Login';
import styles from './Saas.module.css';

export default function InviteAcceptance() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  const accept = async () => {
    setBusy(true);
    const { error: inviteError } = await supabase.functions.invoke('team-invite', { method: 'PUT', body: { token } });
    if (inviteError) {
      setError(inviteError.message);
      setBusy(false);
      return;
    }
    window.localStorage.removeItem('FestaControl_company_settings');
    navigate('/app/dashboard', { replace: true });
  };

  if (session === undefined) return <main className={styles.page}>Carregando convite...</main>;
  if (!session) return <Login allowSignup />;
  return (
    <main className={styles.page}>
      <div className={styles.shell} style={{ maxWidth: 560 }}>
        <h1>Entrar na equipe</h1>
        <p className={styles.muted}>Você está conectado como {session.user.email}. Confirme para entrar na empresa que enviou o convite.</p>
        {error ? <div className={styles.error}>{error}</div> : null}
        <button className={styles.button} disabled={busy} onClick={accept}>{busy ? 'Confirmando...' : 'Aceitar convite'}</button>
      </div>
    </main>
  );
}
