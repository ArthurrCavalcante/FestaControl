import React, { useState, useEffect } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { supabase } from '../supabaseClient';
import { useCompany } from '../hooks/useCompany';
import { toast } from 'react-hot-toast';
import { Smartphone, CheckCircle, ArrowRight, Plug, MessageCircle, RefreshCw, Activity, ShieldCheck } from 'lucide-react';

export default function WizardConexao({ onClose, onComplete }) {
  const { settings } = useCompany();
  const [step, setStep] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);
  const [diagnostic, setDiagnostic] = useState(null);
  // Carrega o SDK do Facebook assim que o componente monta
  useEffect(() => {
    if (window.FB) return;

    window.fbAsyncInit = function() {
      window.FB.init({
        appId  : '1559415199175174',
        cookie : true,
        xfbml  : false,
        version: 'v19.0'
      });
    };

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      document.head.appendChild(script);
    }
  }, []);

  const handleFacebookLogin = () => {
    if (!window.FB) {
      toast.error('O SDK do Facebook ainda está carregando. Aguarde alguns segundos e tente novamente.');
      return;
    }

    // Importante: NENHUMA alteração de estado (setIsConnecting) ou await antes do FB.login,
    // senão o navegador bloqueia a pop-up!

    window.FB.login(async (response) => {
      setIsConnecting(true); // Só mostra o loading APÓS a pop-up fechar e o FB responder

      if (response.authResponse && response.authResponse.code) {
        setStep(2);
        
        try {
          const { data, error } = await supabase.functions.invoke('complete-whatsapp-signup', {
            body: { 
              code: response.authResponse.code, 
              company_id: settings.company_id 
            }
          });

          if (error) throw error;
          if (data.error) throw new Error(data.error);

          setDiagnostic({
            phoneNumber: data.display_phone_number,
            webhookOk: true,
            apiOk: true,
            tokenOk: true,
            lastSync: 'Agora'
          });
          
          setStep(3);
        } catch (err) {
          console.error(err);
          toast.error('Erro ao validar credenciais no servidor: ' + err.message);
          setStep(1);
        } finally {
          setIsConnecting(false);
        }
      } else {
        toast.error('Conexão cancelada ou pop-up bloqueado pelo navegador.');
        setIsConnecting(false);
      }
    }, {
      config_id: '3348520452001695',
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {}
      }
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <Card padding="xl" style={{ width: '100%', maxWidth: '500px' }}>
        
        {step === 1 && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Conectar WhatsApp Oficial</h2>
            <div style={{ background: '#e0e7ff', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <Plug size={32} color="#4f46e5" />
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              Para enviar e receber mensagens via WhatsApp no FestaFlow, conecte sua conta da Meta (Facebook).
            </p>
            <Button size="lg" icon={MessageCircle} onClick={handleFacebookLogin} isLoading={isConnecting}>
              Continuar com o Facebook
            </Button>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2rem 0' }}>
            <RefreshCw size={48} color="var(--primary)" style={{ margin: '0 auto', animation: 'spin 2s linear infinite' }} />
            <style>{`
              @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
            <h3>Sincronizando com a Meta...</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Buscando chaves de segurança e vinculando o seu WhatsApp Business.</p>
          </div>
        )}

        {step === 3 && diagnostic && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: '#dcfce7', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', marginBottom: '1rem' }}>
                <CheckCircle size={32} color="#16a34a" />
              </div>
              <h3 style={{ color: '#16a34a' }}>WhatsApp Business Conectado</h3>
            </div>
            
            <div style={{ background: 'var(--surface-hover)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Empresa</span>
                <strong style={{ fontSize: '0.9rem' }}>{settings?.companies?.nome || 'Minha Empresa'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Número</span>
                <strong style={{ fontSize: '0.9rem' }}><Smartphone size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }}/>{diagnostic.phoneNumber}</strong>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Webhook</span>
                <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontSize: '0.9rem' }}><Activity size={14}/> OK</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Token de Acesso</span>
                <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontSize: '0.9rem' }}><ShieldCheck size={14}/> OK</span>
              </div>
            </div>

            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px dashed #3b82f6' }}>
              <p style={{ margin: 0, color: '#1d4ed8', fontWeight: 500, fontSize: '0.95rem' }}>
                Para finalizar o teste, envie um <strong>"Oi"</strong> do seu celular pessoal para o número conectado acima.
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
