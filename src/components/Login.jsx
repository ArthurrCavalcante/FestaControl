import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import styles from './Login.module.css';
import { Mail, Lock, AlertCircle } from 'lucide-react';

import Card from './ui/Card';
import Button from './ui/Button';
import { toast } from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Credenciais inválidas. Verifique seu e-mail e senha.');
    }
    setLoading(false);
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Configurar redirectTo para o domínio atual (Vercel ou Localhost)
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : '';
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    
    if (error) {
      setError(error.message);
    } else {
      toast.success('E-mail de recuperação enviado!');
      setIsRecoveryMode(false);
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <Card padding="lg" className={styles.cardOverrides}>
        <div className={styles.logoContainer}>
          <h2 className={styles.title}>FestaControl CRM</h2>
          <p className={styles.subtitle}>
            {isRecoveryMode ? 'Recuperação de Senha' : 'Acesse seu painel administrativo'}
          </p>
        </div>
        
        {error && (
          <div className={styles.error}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={isRecoveryMode ? handleRecovery : handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>E-mail</label>
            <div className={styles.inputWrapper}>
              <Mail size={18} className={styles.inputIcon} />
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={styles.input}
                placeholder="admin@FestaControl.com"
              />
            </div>
          </div>
          
          {!isRecoveryMode && (
            <div className={styles.inputGroup}>
              <label className={styles.label}>Senha</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} className={styles.inputIcon} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={styles.input}
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Button 
              type="submit" 
              size="lg" 
              isLoading={loading} 
              className={styles.submitBtnOverrides}
            >
              {isRecoveryMode ? 'Enviar Link de Recuperação' : 'Entrar na Conta'}
            </Button>

            {!isRecoveryMode && (
              <Button 
                type="button" 
                size="lg" 
                variant="secondary"
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  const { error } = await supabase.auth.signInWithPassword({ email: 'visitante@FestaControl.com', password: 'demo-password' });
                  if (error) setError('Conta de visitante não configurada no banco de dados.');
                  setLoading(false);
                }}
              >
                Acessar como Visitante (Demo)
              </Button>
            )}
          </div>
        </form>
        
        <p className={styles.footerText}>
          {isRecoveryMode ? (
            <button 
              type="button" 
              className={styles.textButton} 
              onClick={() => { setIsRecoveryMode(false); setError(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Voltar para o Login
            </button>
          ) : (
            <button 
              type="button" 
              className={styles.textButton} 
              onClick={() => { setIsRecoveryMode(true); setError(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              Esqueci minha senha
            </button>
          )}
        </p>
      </Card>
    </div>
  );
}
