import React, { useState, useEffect } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { supabase } from '../supabaseClient';
import { toast } from 'react-hot-toast';

export default function Perfil() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ nome: '', telefone: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
          setProfile(data);
          setFormData({ nome: data.nome || '', telefone: data.telefone || '' });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!session?.user) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ nome: formData.nome, telefone: formData.telefone, updated_at: new Date().toISOString() })
        .eq('id', session.user.id);

      if (error) throw error;
      toast.success('Perfil atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar perfil.');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    const pwd = passwordForm.newPassword;
    if (!pwd) return;
    if (pwd.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (!/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
      toast.error('A senha deve conter letras maiúsculas, minúsculas e números.');
      return;
    }
    
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success('Senha alterada com sucesso!');
      setPasswordForm({ newPassword: '' });
    } catch (error) {
      toast.error('Erro ao alterar senha.');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Carregando perfil...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1rem', color: 'var(--text-color)' }}>Meu Perfil</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <Card padding="lg">
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-color)' }}>Informações Pessoais</h3>
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>E-mail (Login)</label>
              <input 
                type="text" 
                disabled
                value={session?.user?.email || ''}
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nome Completo</label>
              <input 
                type="text" 
                value={formData.nome}
                onChange={e => setFormData({...formData, nome: e.target.value})}
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Telefone Celular</label>
              <input 
                type="text" 
                value={formData.telefone}
                onChange={e => setFormData({...formData, telefone: e.target.value})}
                placeholder="(11) 99999-9999"
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" isLoading={isSaving}>Salvar Dados</Button>
            </div>
          </form>
        </Card>

        <Card padding="lg">
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-color)' }}>Segurança</h3>
          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nova Senha</label>
              <input 
                type="password" 
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ newPassword: e.target.value })}
                placeholder="Mínimo de 6 caracteres"
                minLength={8}
                maxLength={128}
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="outline">Atualizar Senha</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
