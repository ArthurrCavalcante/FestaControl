import React, { useState, useEffect } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { useCompany } from '../hooks/useCompany';
import { toast } from 'react-hot-toast';
import { supabase } from '../supabaseClient';

export default function Configuracoes() {
  const { settings, updateSettings, loading } = useCompany();
  const [formData, setFormData] = useState({
    telefone: '',
    pix_key: '',
    instagram: '',
    endereco: '',
    primary_color: '#8b5cf6',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        telefone: settings.telefone || '',
        pix_key: settings.pix_key || '',
        instagram: settings.instagram || '',
        endereco: settings.endereco || '',
        primary_color: settings.primary_color || '#8b5cf6',
      });
    }
  }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const { success, error } = await updateSettings(formData);
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
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-session`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      await updateSettings({ whatsapp_status: 'disconnected' });
      toast.success('WhatsApp desconectado.');
    } catch (e) {
      toast.error('Erro ao desconectar.');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Carregando configurações...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ marginBottom: '1rem', color: 'var(--text-color)' }}>Integração WhatsApp (Evolution API)</h2>
        <Card padding="lg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Status: {settings?.whatsapp_status === 'connected' ? '🟢 Conectado' : (settings?.whatsapp_status === 'connecting' ? '🟡 Aguardando QR Code' : '🔴 Desconectado')}</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>Conecte seu aparelho para receber e enviar mensagens pelo CRM.</p>
            </div>
            
            {settings?.whatsapp_status === 'connected' ? (
               <Button onClick={handleDesconectar} variant="danger">Desconectar</Button>
            ) : (
               <Button onClick={async () => {
                 try {
                   const { data: { session } } = await supabase.auth.getSession();
                   const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-session`, {
                     method: 'POST',
                     headers: { 'Authorization': `Bearer ${session.access_token}` }
                   });
                   const json = await res.json();
                   if (json.base64) {
                      // Para facilitar o protótipo, podemos abrir o QR Code numa nova aba ou modal simples
                      const image = new Image();
                      image.src = json.base64;
                      const w = window.open("");
                      w.document.write(image.outerHTML);
                   }
                 } catch (e) {
                   toast.error('Erro ao conectar.');
                 }
               }}>
                 Conectar WhatsApp
               </Button>
            )}
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
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={formData.primary_color}
                  onChange={e => setFormData({...formData, primary_color: e.target.value})}
                  style={{ width: '50px', height: '40px', padding: '0', cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>Muda a cor primária dos botões do sistema.</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
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
