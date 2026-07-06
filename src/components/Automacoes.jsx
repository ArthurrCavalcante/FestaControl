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
  Globe,
  Camera,
  Mail,
  Activity,
  History,
  GitBranch
} from 'lucide-react';
import toast from 'react-hot-toast';

const CONNECTIONS = [
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, status: 'disconnected' },
  { id: 'facebook', name: 'Facebook Groups', icon: Globe, status: 'disconnected' },
  { id: 'instagram', name: 'Instagram Direct', icon: Camera, status: 'disconnected' },
  { id: 'google_calendar', name: 'Google Agenda', icon: Calendar, status: 'disconnected' },
  { id: 'gemini', name: 'Google Gemini', icon: Zap, status: 'connected' }
];

export default function Automacoes() {
  const { settings, updateSettings } = useCompany();
  const [activeTab, setActiveTab] = useState('regras'); // 'regras' | 'histórico' | 'conexoes'
  const [isSaving, setIsSaving] = useState(false);

  const currentAutomations = settings?.automations || {};

  // Handlers para o novo formato JSON
  const handleModeChange = async (automationKey, newMode) => {
    try {
      setIsSaving(true);
      const updatedAutomations = {
        ...currentAutomations,
        [automationKey]: {
          ...(currentAutomations[automationKey] || {}),
          mode: newMode
        }
      };
      await updateSettings({ automations: updatedAutomations });
      toast.success('Regra atualizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar configuração.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFeature = async (automationKey) => {
    try {
      setIsSaving(true);
      const currentConfig = currentAutomations[automationKey] || {};
      const newEnabled = !currentConfig.enabled;
      
      const updatedAutomations = {
        ...currentAutomations,
        [automationKey]: {
          ...currentConfig,
          enabled: newEnabled
        }
      };
      await updateSettings({ automations: updatedAutomations });
      if (newEnabled) toast.success('Função ativada!');
      else toast('Função desativada.', { icon: '🛑' });
    } catch (error) {
      toast.error('Erro ao salvar configuração.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderModes = () => {
    const leadCreationMode = currentAutomations['lead_creation']?.mode || 'manual';

    return (
      <div className={styles.automationsWrapper}>
        
        {/* Banner Sugestões Inteligentes */}
        <div className={styles.smartSuggestions}>
          <div className={styles.smartSuggestionsIcon}>
            <Zap size={24} color="#f59e0b" fill="#f59e0b" />
          </div>
          <div className={styles.smartSuggestionsText}>
            <h3>Acelerador de IA (Fila de Revisão)</h3>
            <p>Deixe a Inteligência Artificial estruturar os dados das mensagens recebidas e sugerir ações de negócio para você revisar.</p>
          </div>
          <label className={styles.switch}>
            <input 
              type="checkbox" 
              checked={!!currentAutomations['ai_accelerator']?.enabled} 
              onChange={() => handleToggleFeature('ai_accelerator')}
              disabled={isSaving}
            />
            <span className={styles.slider}></span>
          </label>
        </div>

        {/* Engine Configs */}
        <div className={styles.categoryBlock}>
          <h2 className={styles.categoryTitle}>
            <GitBranch size={22} className={styles.categoryIcon} />
            Regras de Captação (Leads & Orçamentos)
          </h2>
          
          <div className={styles.engineCard}>
            <div className={styles.engineHeader}>
              <div>
                <h3>Criação de Leads e Orçamentos</h3>
                <p>O que acontece quando o Webhook recebe uma mensagem de um novo cliente?</p>
              </div>
            </div>
            
            <div className={styles.optionsGroup}>
              <label className={`${styles.radioOption} ${leadCreationMode === 'manual' ? styles.activeOption : ''}`}>
                <input 
                  type="radio" 
                  name="lead_creation_mode" 
                  value="manual"
                  checked={leadCreationMode === 'manual'}
                  onChange={() => handleModeChange('lead_creation', 'manual')}
                  disabled={isSaving}
                />
                <div className={styles.optionContent}>
                  <strong>Manual</strong>
                  <span>A mensagem cai na caixa de entrada. Você cria o lead manualmente.</span>
                </div>
              </label>

              <label className={`${styles.radioOption} ${leadCreationMode === 'semi_auto' ? styles.activeOption : ''}`}>
                <input 
                  type="radio" 
                  name="lead_creation_mode" 
                  value="semi_auto"
                  checked={leadCreationMode === 'semi_auto'}
                  onChange={() => handleModeChange('lead_creation', 'semi_auto')}
                  disabled={isSaving}
                />
                <div className={styles.optionContent}>
                  <strong>Fila de Revisão (Recomendado)</strong>
                  <span>A IA extrai os dados (Nome, Tema, Data) e pede sua aprovação na aba Pendências.</span>
                </div>
              </label>

              <label className={`${styles.radioOption} ${leadCreationMode === 'automatic' ? styles.activeOption : ''}`}>
                <input 
                  type="radio" 
                  name="lead_creation_mode" 
                  value="automatic"
                  checked={leadCreationMode === 'automatic'}
                  onChange={() => handleModeChange('lead_creation', 'automatic')}
                  disabled={isSaving}
                />
                <div className={styles.optionContent}>
                  <strong>100% Automático</strong>
                  <span>O Motor de Eventos cria o Lead e o Orçamento sozinho se a confiança da IA for alta (&gt;90%).</span>
                </div>
              </label>
            </div>
          </div>
        </div>

      </div>
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Motor Operacional</h1>
          <p className={styles.subtitle}>Configure regras e delegue o trabalho braçal para os executores do FestaFlow.</p>
        </div>
      </header>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'regras' ? styles.active : ''}`}
          onClick={() => setActiveTab('regras')}
        >
          <GitBranch size={18} />
          Regras de Ação
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'historico' ? styles.active : ''}`}
          onClick={() => setActiveTab('historico')}
        >
          <History size={18} />
          Execuções & Erros
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
        {activeTab === 'regras' && renderModes()}

        {activeTab === 'historico' && (
          <div className={styles.historyWrapper}>
            <div className={styles.blankState}>
              <Activity size={48} color="var(--border-color)" />
              <h3>Nenhuma execução recente</h3>
              <p>Quando o Motor começar a processar eventos (ex: criação automática de lead via IA), o histórico detalhado aparecerá aqui.</p>
            </div>
          </div>
        )}

        {activeTab === 'conexoes' && (
          <div className={styles.connectionsWrapper}>
            <div className={styles.connectionsHeader}>
              <h2>Canais (Webhooks)</h2>
              <p>Conecte as fontes de eventos (como mensagens) para engatilhar o Motor do FestaFlow.</p>
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
                    onClick={() => toast('Em breve você poderá mapear seus próprios Webhooks.')}
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
