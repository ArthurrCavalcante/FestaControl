import React, { useState, useEffect } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { supabase } from '../supabaseClient';
import { useCompany } from '../hooks/useCompany';
import { toast } from 'react-hot-toast';
import { Smartphone, CheckCircle, RefreshCw, Plug, QrCode } from 'lucide-react';

export default function WizardConexao({ onClose, onComplete }) {
  const { settings, refreshCompany } = useCompany();
  const [step, setStep] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState(null);
  
  // Assinar mudanças de status no banco para saber quando conectou
  useEffect(() => {
    if (!settings?.company_id) return;
    
    const channel = supabase
      .channel('whatsapp_status_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'company_settings', filter: `company_id=eq.${settings.company_id}` },
        (payload) => {
          if (payload.new.whatsapp_status === 'connected') {
            setStep(3);
            refreshCompany();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [settings?.company_id, refreshCompany]);

  const handleConnectEvolution = async () => {
    setIsConnecting(true);
    try {
      const { data: resData, error: invokeError } = await supabase.functions.invoke('evolution-connect', {
        method: 'POST'
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Erro ao conectar (Invoke)');
      }

      if (resData?.error) {
        throw new Error(resData.error);
      }

      if (resData?.base64) {
        setQrCodeBase64(resData.base64);
        setStep(2);
      } else if (resData?.instance?.state === 'open') {
        // Já estava conectado
        toast.success('WhatsApp já está conectado!');
        setStep(3);
        refreshCompany();
      } else {
        toast.error('Não foi possível carregar o QR Code. A instância pode estar reiniciando.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao iniciar conexão: ' + err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <Card padding="xl" style={{ width: '100%', maxWidth: '500px' }}>
        
        {step === 1 && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Conectar WhatsApp</h2>
            <div style={{ background: '#e0e7ff', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <Plug size={32} color="#4f46e5" />
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              Escaneie o QR Code para conectar seu número de WhatsApp ao FestaFlow.
            </p>
            <Button size="lg" icon={QrCode} onClick={handleConnectEvolution} isLoading={isConnecting}>
              Gerar QR Code
            </Button>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem 0' }}>
            <h3>Escaneie o QR Code</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e aponte a câmera para a imagem abaixo.
            </p>
            
            <div style={{ margin: '0 auto', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'inline-block' }}>
              {qrCodeBase64 ? (
                <img src={qrCodeBase64} alt="WhatsApp QR Code" style={{ width: '250px', height: '250px' }} />
              ) : (
                <div style={{ width: '250px', height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw className="spin" size={32} color="var(--primary)" />
                </div>
              )}
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Esta tela fechará automaticamente assim que a conexão for confirmada.
            </p>
            
            <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ background: '#dcfce7', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <CheckCircle size={32} color="#16a34a" />
            </div>
            <div>
              <h3 style={{ color: '#16a34a', marginBottom: '0.5rem' }}>WhatsApp Conectado!</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Seu número já está vinculado ao FestaFlow.
              </p>
            </div>

            <Button size="lg" icon={ArrowRight} onClick={() => { onClose(); onComplete(); }}>
              Ir para o Monitor
            </Button>
          </div>
        )}

      </Card>
    </div>
  );
}
