import React from 'react';
import Card from './ui/Card';
import { 
  BarChart3, 
  Calendar, 
  Users, 
  Package, 
  Bell, 
  Camera, 
  Settings, 
  User,
  PartyPopper
} from 'lucide-react';
import Skeleton from './ui/Skeleton';
import { useCompany } from '../hooks/useCompany';
import styles from './Dashboard.module.css';

export default function Dashboard({ onNavigate }) {
  const { settings, loading } = useCompany();

  const modules = [
    {
      id: 'pipeline',
      title: 'Orçamentos (CRM)',
      description: 'Acompanhe negociações e feche contratos',
      icon: <BarChart3 size={24} strokeWidth={1.5} color="var(--primary)" />,
      color: 'var(--surface-secondary)'
    },
    {
      id: 'agenda',
      title: 'Agenda de Eventos',
      description: 'Calendário de festas confirmadas',
      icon: <Calendar size={24} strokeWidth={1.5} color="var(--primary)" />,
      color: 'var(--surface-secondary)'
    },
    {
      id: 'inbox',
      title: 'Avisos & Mensagens',
      description: 'Notificações importantes e lembretes',
      icon: <Bell size={24} strokeWidth={1.5} color="var(--primary)" />,
      color: 'var(--surface-secondary)'
    },
    {
      id: 'leads',
      title: 'Base de Clientes',
      description: 'Gerencie todos os seus contatos',
      icon: <Users size={24} strokeWidth={1.5} color="var(--primary)" />,
      color: 'var(--surface-secondary)'
    },
    {
      id: 'acervo',
      title: 'Acervo de Temas',
      description: 'Inventário de temas e decorações',
      icon: <Package size={24} strokeWidth={1.5} color="var(--primary)" />,
      color: 'var(--surface-secondary)'
    },
    {
      id: 'catalogo',
      title: 'Galeria Mágica',
      description: 'Análise de fotos para orçamento',
      icon: <Camera size={24} strokeWidth={1.5} color="var(--primary)" />,
      color: 'var(--surface-secondary)'
    },
    {
      id: 'configuracoes',
      title: 'Configurações',
      description: 'Ajustes da empresa e sistema',
      icon: <Settings size={24} strokeWidth={1.5} color="var(--text-secondary)" />,
      color: 'var(--surface-secondary)'
    },
    {
      id: 'perfil',
      title: 'Meu Perfil',
      description: 'Gerencie sua conta de usuário',
      icon: <User size={24} strokeWidth={1.5} color="var(--text-secondary)" />,
      color: 'var(--surface-secondary)'
    }
  ];

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Skeleton width="64px" height="64px" borderRadius="12px" style={{ marginBottom: '1rem' }} />
          <Skeleton width="300px" height="32px" style={{ marginBottom: '0.5rem' }} />
          <Skeleton width="450px" height="24px" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {[1,2,3,4,5,6,7,8].map(i => (
            <Card key={i} padding="lg">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <Skeleton width="48px" height="48px" borderRadius="8px" />
                <div style={{ flex: 1 }}>
                  <Skeleton width="60%" height="20px" style={{ marginBottom: '0.5rem' }} />
                  <Skeleton width="90%" height="16px" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyItems: 'center', width: '64px', height: '64px', borderRadius: '12px', background: 'var(--surface-secondary)', border: '1px solid var(--border)', color: 'var(--primary)', marginBottom: '1rem', justifyContent: 'center' }}>
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover' }} />
          ) : (
            <PartyPopper size={32} strokeWidth={1.5} />
          )}
        </div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.75rem', fontWeight: 600 }}>
          Bem-vindo ao {settings?.companies?.nome || 'FestaFlow'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto' }}>
          Escolha uma das opções abaixo para gerenciar seu negócio.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {modules.map(module => (
          <Card 
            key={module.id} 
            padding="lg" 
            className={styles.moduleCard}
            onClick={() => onNavigate(module.id)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ 
                background: module.color, 
                padding: '0.75rem', 
                borderRadius: '8px',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {module.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 0.25rem 0' }}>
                  {module.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  {module.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
