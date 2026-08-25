import React, { useState, useEffect, useCallback } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { useCompany } from '../hooks/useCompany';
import { toast } from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import styles from './Configuracoes.module.css';
import { normalizeConnectionState, startWhatsAppStatusPolling } from '../services/whatsappClient';

export default function Configuracoes() {
  const { settings, updateSettings, refreshCompany, loading } = useCompany();
  const [formData, setFormData] = useState({
    telefone: '',
    pix_key: '',
    instagram: '',
    endereco: '',
    primary_color: '#8b5cf6',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [whatsappBusy, setWhatsappBusy] = useState(false);
  const [automation, setAutomation] = useState({
    welcome_enabled: false,
    welcome_message: 'Olá! Recebemos sua mensagem. Em breve nossa equipe continuará o atendimento por aqui.',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        telefone: settings.telefone || '',
        pix_key: settings.pix_key || '',
        instagram: settings.instagram || '',
        endereco: settings.endereco || '',
        primary_color: settings.primary_color || '#8b5cf6',
      });
      setAutomation({
        welcome_enabled: settings.automations?.whatsapp?.welcome_enabled === true,
        welcome_message: settings.automations?.whatsapp?.welcome_message || 'Olá! Recebemos sua mensagem. Em breve nossa equipe continuará o atendimento por aqui.',
      });
    }
  }, [settings]);

  const callWhatsAppSession = useCallback(async (method) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sua sessão expirou. Entre novamente.');
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-session`, {
      method,
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Falha na conexão com o WhatsApp.');
    return data;
  }, []);

  const checkWhatsAppStatus = useCallback(async () => {
    try {
      const data = await callWhatsAppSession('GET');
      const status = normalizeConnectionState(data);
      await refreshCompany();
      if (status === 'connected') setQrCode('');
      return status;
    } catch {
      return 'error';
    }
  }, [callWhatsAppSession, refreshCompany]);

  useEffect(() => {
    if (settings?.whatsapp_status !== 'connecting') return undefined;
    return startWhatsAppStatusPolling(checkWhatsAppStatus);
  }, [checkWhatsAppStatus, settings?.whatsapp_status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const { success } = await updateSettings(formData);
    setIsSaving(false);
    
    if (success) {
      toast.success('Configurações salvas!');
    } else {
      toast.error('Erro ao salvar configurações. Tente novamente.');
    }
  };

  const handleDesconectar = async () => {
    const confirm = window.confirm("Tem certeza que deseja desconectar o WhatsApp?");
    if (!confirm) return;
    
    try {
      setWhatsappBusy(true);
      await callWhatsAppSession('DELETE');
      setQrCode('');
      await refreshCompany();
      toast.success('WhatsApp desconectado.');
    } catch (error) {
      toast.error(error.message || 'Erro ao desconectar.');
    } finally {
      setWhatsappBusy(false);
    }
  };

  const handleConnect = async () => {
    setWhatsappBusy(true);
    try {
      const data = await callWhatsAppSession('POST');
      if (!data.base64) throw new Error('O provedor não retornou um QR Code.');
      setQrCode(data.base64);
      await refreshCompany();
      toast.success('QR Code gerado. Leia com o WhatsApp da empresa.');
    } catch (error) {
      toast.error(error.message || 'Erro ao conectar.');
    } finally {
      setWhatsappBusy(false);
    }
  };

  const saveAutomation = async () => {
    if (automation.welcome_enabled && !automation.welcome_message.trim()) {
      toast.error('Escreva a mensagem de boas-vindas.');
      return;
    }
    setWhatsappBusy(true);
    try {
      await updateSettings({
        automations: {
          ...(settings?.automations || {}),
          whatsapp: {
            welcome_enabled: automation.welcome_enabled,
            welcome_message: automation.welcome_message.trim().slice(0, 1000),
          },
        },
      });
      toast.success('Automação do WhatsApp salva.');
    } catch {
      toast.error('Não foi possível salvar a automação.');
    } finally {
      setWhatsappBusy(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Carregando configurações...</div>;

  return (
    <div className={styles.container}>
      <div>
        <h2 style={{ marginBottom: '1rem', color: 'var(--text-color)' }}>Integração WhatsApp (Evolution API)</h2>
        <Card padding="lg">
          <div className={styles.whatsappRow}>
            <div>
              <h3 style={{ margin: 0 }}>Status: {settings?.whatsapp_status === 'connected' ? 'Conectado' : (settings?.whatsapp_status === 'connecting' ? 'Aguardando leitura do QR Code' : settings?.whatsapp_status === 'error' ? 'Precisa de atenção' : 'Desconectado')}</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>Integração Evolution beta. Em caso de indisponibilidade, use o atalho do WhatsApp.</p>
              {settings?.whatsapp_last_error ? <p className={styles.connectionError}>{settings.whatsapp_last_error}</p> : null}
            </div>
            
            {settings?.whatsapp_status === 'connected' ? (
               <Button onClick={handleDesconectar} variant="danger" disabled={whatsappBusy}>Desconectar</Button>
            ) : (
               <Button onClick={handleConnect} disabled={whatsappBusy}>
                 {whatsappBusy ? 'Preparando...' : 'Conectar WhatsApp'}
               </Button>
            )}
          </div>
          {qrCode ? <div className={styles.qrPanel}><img src={qrCode} alt="QR Code para conectar o WhatsApp" /><p>Leia o código no WhatsApp. Ele expira em aproximadamente um minuto.</p></div> : null}
          <div className={styles.automationPanel}>
            <div className={styles.automationTitle}>
              <div><strong>Boas-vindas automáticas</strong><p>Envia uma única resposta na primeira mensagem de cada conversa nova.</p></div>
              <input
                type="checkbox"
                aria-label="Ativar boas-vindas automáticas"
                checked={automation.welcome_enabled}
                onChange={(event) => setAutomation({ ...automation, welcome_enabled: event.target.checked })}
              />
            </div>
            <textarea
              value={automation.welcome_message}
              onChange={(event) => setAutomation({ ...automation, welcome_message: event.target.value })}
              maxLength={1000}
              disabled={!automation.welcome_enabled}
              aria-label="Mensagem automática de boas-vindas"
            />
            <div className={styles.automationFooter}><span>{automation.welcome_message.length}/1000</span><Button variant="secondary" onClick={saveAutomation} disabled={whatsappBusy}>Salvar automação</Button></div>
          </div>
        </Card>
      </div>

      <div>
        <h2 style={{ marginBottom: '1rem', color: 'var(--text-color)' }}>Dados da Empresa</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Estes dados serão usados em todos os orçamentos, PDFs e painéis do cliente.
        </p>

        <Card padding="lg">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div className={styles.formGrid}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Telefone Fixo / Celular Auxiliar</label>
                <input 
                  type="text" 
                  value={formData.telefone}
                  onChange={e => setFormData({...formData, telefone: e.target.value})}
                  placeholder="(11) 3333-3333"
                  style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Instagram</label>
                <input 
                  type="text" 
                  value={formData.instagram}
                  onChange={e => setFormData({...formData, instagram: e.target.value})}
                  placeholder="@festaencantada"
                  style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Chave PIX (Para Recebimentos)</label>
              <input 
                type="text" 
                value={formData.pix_key}
                onChange={e => setFormData({...formData, pix_key: e.target.value})}
                placeholder="CNPJ ou E-mail"
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Endereço (Showroom/Galpão)</label>
              <input 
                type="text" 
                value={formData.endereco}
                onChange={e => setFormData({...formData, endereco: e.target.value})}
                placeholder="Rua Exemplo, 123"
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Cor Principal da Marca</label>
              <div className={styles.colorRow}>
                <input 
                  type="color" 
                  value={formData.primary_color}
                  onChange={e => setFormData({...formData, primary_color: e.target.value})}
                  style={{ width: '50px', height: '40px', padding: '0', cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>Muda a cor primária dos botões do sistema.</span>
              </div>
            </div>

            <div className={styles.actionRow}>
              <Button type="submit" isLoading={isSaving} size="lg">
                Salvar Configurações
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
