import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import Button from './ui/Button';
import Card from './ui/Card';
import { Package, User, Building2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Onboarding({ onComplete }) {
  const [userName, setUserName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!userName.trim() || !companyName.trim()) {
      toast.error('Preencha todos os campos!');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const { error } = await supabase.rpc('create_new_tenant', {
        p_company_name: companyName.trim(),
        p_user_name: userName.trim()
      });

      if (error) {
        throw error;
      }

      toast.success('Conta configurada com sucesso!');
      if (onComplete) {
        onComplete();
      }

    } catch (err) {
      console.error('Erro no onboarding:', err);
      // Se o usuário clicar duas vezes, a função SQL pode lançar erro customizado.
      if (err.message && err.message.includes('já possui empresa vinculada')) {
        if (onComplete) onComplete();
      } else {
        toast.error(`Erro: ${err.message || 'Falha ao configurar conta.'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', padding: '1rem' }}>
      <Card style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
            <Package size={32} />
          </div>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Bem-vindo ao FestaControl!</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Para começar, precisamos de alguns detalhes sobre você e sua empresa.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Seu Nome
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Ex: João Silva"
                disabled={isSubmitting}
                style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text-primary)' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Nome da Empresa / Negócio
            </label>
            <div style={{ position: 'relative' }}>
              <Building2 size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Alegria Festas"
                disabled={isSubmitting}
                style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text-primary)' }}
                required
              />
            </div>
          </div>

          <Button 
            type="submit" 
            variant="primary" 
            disabled={isSubmitting || !userName.trim() || !companyName.trim()}
            style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
          >
            {isSubmitting ? 'Configurando...' : 'Começar a usar'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
