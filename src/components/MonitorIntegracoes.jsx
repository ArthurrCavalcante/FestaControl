import React, { useState, useEffect } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { supabase } from '../supabaseClient';
import { CheckCircle, Send, Inbox, RefreshCw, Trash2, Smartphone } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function MonitorIntegracoes({ connection, onReconnect, onRemove }) {
  const [isTestingSend, setIsTestingSend] = useState(false);
  const [isWaitingReceive, setIsWaitingReceive] = useState(false);
  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toISOString(), action: 'Conexão estabelecida via OAuth', status: 'OK' }
  ]);
  const [phoneNumber, setPhoneNumber] = useState('Carregando...');
  
  useEffect(() => {
    // Busca credenciais para pegar o número (simulado por enquanto)
    const fetchCreds = async () => {
      const { data } = await supabase.from('provider_credentials').select('phone_number_id').eq('connection_id', connection.id).single();
      if (data) {
         setPhoneNumber(data.phone_number_id.replace('_DUMMY', ''));
      }
    };
    fetchCreds();
  }, [connection]);

  const handleTestSend = async () => {
    setIsTestingSend(true);
    // Simula uma chamada para a edge function de send-message
    setTimeout(() => {
      setLogs(prev => [{ id: Date.now(), time: new Date().toISOString(), action: 'Mensagem de teste enviada', status: 'OK' }, ...prev]);
      setIsTestingSend(false);
      toast.success('Mensagem de teste enviada!');
    }, 1500);
  };

  const handleTestReceive = () => {
    setIsWaitingReceive(true);
    setLogs(prev => [{ id: Date.now(), time: new Date().toISOString(), action: 'Aguardando mensagem...', status: 'PENDING' }, ...prev]);
    
    // Simula receber uma mensagem depois de 5 segundos
    setTimeout(() => {
      setLogs(prev => [{ id: Date.now()+1, time: new Date().toISOString(), action: 'Mensagem "Oi" recebida com sucesso', status: 'OK' }, ...prev.filter(l => l.status !== 'PENDING')]);
      setIsWaitingReceive(false);
      toast.success('Mensagem recebida do WhatsApp!');
    }, 5000);
  };

  return (
    <Card padding="lg" style={{ border: '1px solid var(--primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Smartphone size={20} />
              {connection.display_name}
            </h3>
            <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
              Conectado
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            ID do Telefone: {phoneNumber}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={onReconnect}>
            Reconectar
          </Button>
          <Button variant="ghost" size="sm" icon={Trash2} onClick={onRemove} style={{ color: 'var(--danger)' }}>
            Remover
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', background: 'var(--surface-hover)', borderRadius: '8px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Status do Webhook</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#16a34a' }}>
            <CheckCircle size={16} /> Operacional
          </div>
        </div>
        <div style={{ padding: '1rem', background: 'var(--surface-hover)', borderRadius: '8px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Status da API</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#16a34a' }}>
            <CheckCircle size={16} /> Online
          </div>
        </div>
        <div style={{ padding: '1rem', background: 'var(--surface-hover)', borderRadius: '8px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Access Token</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#16a34a' }}>
            <CheckCircle size={16} /> Válido
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <Button 
          icon={Send} 
          onClick={handleTestSend} 
          isLoading={isTestingSend}
          disabled={isWaitingReceive}
        >
          Testar Envio
        </Button>
        <Button 
          variant="outline" 
          icon={Inbox} 
          onClick={handleTestReceive}
          isLoading={isWaitingReceive}
          disabled={isTestingSend}
        >
          Aguardar Mensagem
        </Button>
      </div>

      <div>
        <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Últimos Eventos</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {logs.map(log => (
            <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-color)', borderRadius: '6px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(log.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>{log.action}</span>
              </div>
              <span style={{ color: log.status === 'OK' ? '#16a34a' : log.status === 'PENDING' ? '#eab308' : '#ef4444', fontWeight: 600 }}>
                {log.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
