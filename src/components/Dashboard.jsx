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
import { useCompany } from '../contexts/CompanyContext';
import styles from './Dashboard.module.css';

export default function Dashboard({ onNavigate }) {
  const { settings } = useCompany();

  const modules = [
    {
      id: 'pipeline',
      title: 'Orçamentos (CRM)',
      description: 'Acompanhe negociações e feche contratos',
      icon: <BarChart3 size={28} color="var(--primary)" />,
      color: 'var(--primary-light)'
    },
    {
      id: 'agenda',
      title: 'Agenda de Eventos',
      description: 'Calendário de festas confirmadas',
      icon: <Calendar size={28} color="#f59e0b" />,
      color: '#fef3c7'
    },
    {
      id: 'inbox',
      title: 'Avisos & Mensagens',
      description: 'Notificações importantes e lembretes',
      icon: <Bell size={28} color="#ef4444" />,
      color: '#fee2e2'
    },
    {
      id: 'leads',
      title: 'Base de Clientes',
      description: 'Gerencie todos os seus contatos',
      icon: <Users size={28} color="#8b5cf6" />,
      color: '#ede9fe'
    },
    {
      id: 'acervo',
      title: 'Acervo de Temas',
      description: 'Inventário de temas e decorações',
      icon: <Package size={28} color="#10b981" />,
      color: '#d1fae5'
    },
    {
      id: 'catalogo',
      title: 'Galeria Mágica (IA)',
      description: 'Análise inteligente de fotos',
      icon: <Camera size={28} color="#ec4899" />,
      color: '#fce7f3'
    },
    {
      id: 'configuracoes',
      title: 'Configurações',
      description: 'Ajustes da empresa e sistema',
      icon: <Settings size={28} color="#64748b" />,
      color: '#f1f5f9'
    },
    {
      id: 'perfil',
      title: 'Meu Perfil',
      description: 'Gerencie sua conta de usuário',
      icon: <User size={28} color="#64748b" />,
      color: '#f1f5f9'
    }
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--primary-light), var(--primary))', color: 'white', marginBottom: '1rem', boxShadow: 'var(--shadow-md)' }}>
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" style={{ width: '100%', height: '100%', borderRadius: '16px', objectFit: 'cover' }} />
          ) : (
            <PartyPopper size={36} />
          )}
        </div>
        <h2 style={{ color: 'var(--text-color)', marginBottom: '0.5rem', fontSize: '1.75rem', fontWeight: 800 }}>
          Bem-vindo ao {settings?.companies?.nome || 'FestaFlow'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Escolha uma das opções abaixo para gerenciar seu negócio de festas.
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
                padding: '1rem', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {module.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
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
