import React, { useState } from 'react';
import { useCompany } from '../hooks/useCompany';
import styles from './Automacoes.module.css';
import { 
  Bot, 
  Calendar, 
  Wallet, 
  PartyPopper, 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  Zap,
  Plug,
  MessageCircle,
  Facebook,
  Instagram,
  Mail
} from 'lucide-react';
import toast from 'react-hot-toast';

const AUTOMATION_CATEGORIES = [
  {
    id: 'atendimento',
    title: 'Atendimento',
    icon: Bot,
    items: [
      {
        id: 'auto_create_lead',
        title: 'Criar Lead automaticamente',
        description: 'O FestaFlow identificará clientes interessados nas mensagens e criará a ficha automaticamente.',
        dependency: 'WhatsApp ou Meta conectado',
        economy: '5 min por lead',
        active: false
      },
      {
        id: 'auto_create_deal',
        title: 'Criar orçamento automaticamente',
        description: 'Se o cliente informar o tema e a data, o orçamento inicial será gerado no seu pipeline.',
        dependency: 'WhatsApp ou Meta conectado',
        economy: '8 min por cliente',
        active: false
      },
      {
        id: 'ai_suggest_response',
        title: 'Sugerir resposta por IA',
        description: 'A inteligência artificial analisará o contexto e sugerirá respostas com base no seu acervo.',
        dependency: 'Gemini conectado',
        economy: '2 min por mensagem',
        active: false
      }
    ]
  },
  {
    id: 'operacao',
    title: 'Operação',
    icon: Calendar,
    items: [
      {
        id: 'auto_create_event',
        title: 'Criar evento na agenda quando confirmar venda',
        description: 'Assim que um orçamento for movido para Confirmado, a data será bloqueada na sua Agenda oficial.',
        dependency: null,
        economy: '3 min por festa',
        active: false
      },
      {
        id: 'notify_team',
        title: 'Avisar equipe',
        description: 'Mande um resumo automático no grupo da sua equipe (WhatsApp) sempre que uma festa fechar.',
        dependency: 'WhatsApp conectado',
        economy: '5 min por evento',
        active: false
      }
    ]
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    icon: Wallet,
    items: [
      {
        id: 'notify_deposit_pending',
        title: 'Avisar sinal pendente',
        description: 'Envia um lembrete gentil para clientes que aceitaram o orçamento mas não pagaram o sinal.',
        dependency: 'WhatsApp conectado',
        economy: 'Risco de inadimplência reduzido',
        active: false
      },
      {
        id: 'notify_final_payment',
        title: 'Avisar pagamento final',
        description: 'Cobra automaticamente o restante do pagamento 1 dia antes da festa.',
        dependency: 'WhatsApp conectado',
        economy: '10 min por festa',
        active: false
      }
    ]
  },
  {
    id: 'pos_venda',
    title: 'Pós-venda',
    icon: PartyPopper,
    items: [
      {
        id: 'ask_review',
        title: 'Pedir avaliação',
        description: 'Pergunta se o cliente gostou e pede uma avaliação 2 dias após a festa.',
        dependency: 'WhatsApp conectado',
        economy: 'Marketing orgânico',
        active: false
      },
      {
        id: 'remind_next_year',
        title: 'Lembrar aniversário no próximo ano',
        description: 'Envia uma mensagem 11 meses depois oferecendo desconto para a próxima festa.',
        dependency: 'WhatsApp conectado',
        economy: 'Aumenta retenção em 40%',
        active: false
      }
    ]
  }
];

const CONNECTIONS = [
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, status: 'disconnected' },
  { id: 'facebook', name: 'Facebook Groups', icon: Facebook, status: 'disconnected' },
  { id: 'instagram', name: 'Instagram Direct', icon: Instagram, status: 'disconnected' },
  { id: 'google_calendar', name: 'Google Agenda', icon: Calendar, status: 'disconnected' },
  { id: 'gemini', name: 'Google Gemini', icon: Zap, status: 'connected' } // Exemplo
];

export default function Automacoes() {
  const { settings, updateSettings } = useCompany();
  const [activeTab, setActiveTab] = useState('automacoes'); // 'automacoes' | 'conexoes'
  const [isSaving, setIsSaving] = useState(false);

  // Fallback to empty object if automations is null or undefined
  const currentAutomations = settings?.automations || {};

  const handleToggle = async (itemId) => {
    try {
      setIsSaving(true);
      const newValue = !currentAutomations[itemId];
      const updatedAutomations = {
        ...currentAutomations,
        [itemId]: newValue
      };

      await updateSettings({ automations: updatedAutomations });
      
      if (newValue) {
        toast.success('Automação ativada!');
      } else {
        toast('Automação desativada.', { icon: '🛑' });
      }
    } catch (error) {
      toast.error('Erro ao salvar configuração.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Cérebro Operacional</h1>
          <p className={styles.subtitle}>Configure o que o FestaFlow fará automaticamente por você.</p>
        </div>
      </header>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'automacoes' ? styles.active : ''}`}
          onClick={() => setActiveTab('automacoes')}
        >
          <Zap size={18} />
          Automações
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'conexoes' ? styles.active : ''}`}
          onClick={() => setActiveTab('conexoes')}
        >
          <Plug size={18} />
          Conexões
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'automacoes' && (
          <div className={styles.automationsWrapper}>
            
            <div className={styles.smartSuggestions}>
              <div className={styles.smartSuggestionsIcon}>
                <Zap size={24} color="#f59e0b" fill="#f59e0b" />
              </div>
              <div className={styles.smartSuggestionsText}>
                <h3>Sugestões Inteligentes (Dashboard)</h3>
                <p>O FestaFlow analisará seu pipeline diariamente e sugerirá ações cruciais (ex: "Cobrar João", "Confirmar endereço da Maria").</p>
              </div>
              <label className={styles.switch}>
                <input 
                  type="checkbox" 
                  checked={!!currentAutomations['smart_suggestions']} 
                  onChange={() => handleToggle('smart_suggestions')}
                  disabled={isSaving}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            {AUTOMATION_CATEGORIES.map(category => (
              <div key={category.id} className={styles.categoryBlock}>
                <h2 className={styles.categoryTitle}>
                  <category.icon size={22} className={styles.categoryIcon} />
                  {category.title}
                </h2>
                <div className={styles.cardGrid}>
                  {category.items.map(item => {
                    const isActive = !!currentAutomations[item.id];
                    return (
                      <div key={item.id} className={`${styles.card} ${isActive ? styles.cardActive : ''}`}>
                        <div className={styles.cardHeader}>
                          <h3 className={styles.cardTitle}>{item.title}</h3>
                          <label className={styles.switch}>
                            <input 
                              type="checkbox" 
                              checked={isActive} 
                              onChange={() => handleToggle(item.id)}
                              disabled={isSaving}
                            />
                            <span className={styles.slider}></span>
                          </label>
                        </div>
                        
                        <p className={styles.cardDesc}>{item.description}</p>
                        
                        <div className={styles.cardFooter}>
                          {item.dependency ? (
                            <span className={styles.dependencyBadge}>
                              <AlertTriangle size={14} />
                              Necessita: {item.dependency}
                            </span>
                          ) : (
                            <span className={styles.readyBadge}>
                              <CheckCircle2 size={14} />
                              Pronto para uso
                            </span>
                          )}
                          
                          <span className={styles.economyBadge}>
                            <Clock size={14} />
                            {item.economy}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'conexoes' && (
          <div className={styles.connectionsWrapper}>
            <div className={styles.connectionsHeader}>
              <h2>Plataformas Conectadas</h2>
              <p>Conecte o FestaFlow às suas redes sociais e ferramentas para liberar o poder das Automações.</p>
            </div>
            
            <div className={styles.connectionGrid}>
              {CONNECTIONS.map(conn => (
                <div key={conn.id} className={styles.connectionCard}>
                  <div className={styles.connIconWrapper}>
                    <conn.icon size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className={styles.connName}>{conn.name}</h3>
                  <div className={styles.connStatus}>
                    {conn.status === 'connected' ? (
                      <span className={styles.statusConnected}>
                        <span className={styles.statusDot} style={{ background: '#10b981' }}></span>
                        Conectado
                      </span>
                    ) : (
                      <span className={styles.statusDisconnected}>
                        <span className={styles.statusDot} style={{ background: '#ef4444' }}></span>
                        Desconectado
                      </span>
                    )}
                  </div>
                  <button 
                    className={styles.connBtn} 
                    onClick={() => toast('Configuração de conexões em breve!')}
                  >
                    {conn.status === 'connected' ? 'Configurar' : 'Conectar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
