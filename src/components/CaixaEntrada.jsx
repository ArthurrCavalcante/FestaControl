import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import styles from './CaixaEntrada.module.css';
import { toast } from 'react-hot-toast';

// UI Components
import Card from './ui/Card';
import Badge from './ui/Badge';
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';
import PromptDialog from './ui/PromptDialog';

// Icons
import { 
  Inbox, 
  MessageCircle, 
  MessageSquare, 
  Camera, 
  Target, 
  Check, 
  Send,
  X,
  Phone,
  Users
} from 'lucide-react';

export default function CaixaEntrada() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [inboxTab, setInboxTab] = useState('chats'); // 'chats' ou 'alerts'
  const [alerts, setAlerts] = useState([]);
  const [promptConfig, setPromptConfig] = useState(null);
  
  // Ref para auto-scroll das mensagens
  const messagesEndRef = useRef(null);

  const fetchConversations = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('last_activity', { ascending: false });
      
    if (!error && data) {
      setConversations(data);
    }
  };

  const fetchUpcomingAlerts = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, deals(*, leads(*))');
      
    if (!error && data) {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const mapped = data
        .map(evt => {
          const deal = evt.deals;
          if (!deal || !deal.leads) return null;
          const partyDate = new Date(evt.data_evento + 'T00:00:00');
          const timeDiff = partyDate - today;
          const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
          const alreadySent = evt.lembrete_enviado;
          
          return {
            id: deal.id,
            eventId: evt.id,
            nome: deal.leads.nome,
            telefone: deal.leads.telefone,
            tema: deal.tema || 'Kit Personalizado',
            data_festa: evt.data_evento,
            status: deal.status_funil,
            daysLeft,
            alreadySent
          };
        })
        .filter(alert => alert !== null && alert.daysLeft >= 0 && alert.daysLeft <= 7 && alert.status === 'CONFIRMADO' && !alert.alreadySent)
        .sort((a, b) => a.daysLeft - b.daysLeft);
        
      setAlerts(mapped);
    }
  };

  const fetchMessages = async (conversationId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
      
    if (!error && data) {
      setMessages(data);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchUpcomingAlerts();
    
    // Realtime Notifications & Updates
    const msgSubscription = supabase.channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const newMsg = payload.new;
        
        // Atualiza a lista de conversas
        fetchConversations();

        // Se a conversa aberta é a que recebeu a mensagem, atualiza a tela
        setActiveConversation(prev => {
          if (prev && prev.id === newMsg.conversation_id) {
            setMessages(currentMsgs => {
               // Evita duplicidade se já tiver sido adicionada no envio
               if (currentMsgs.find(m => m.id === newMsg.id)) return currentMsgs;
               return [...currentMsgs, newMsg];
            });
          }
          return prev;
        });

        // Notificação visual simples no navegador (Toast)
        if (newMsg.direction === 'INBOUND') {
          // Apenas um alert para fins de feedback visual simples, ideal usar react-hot-toast depois
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgSubscription);
    };
  }, []);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
    } else {
      setMessages([]);
    }
  }, [activeConversation]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleReply = async () => {
    if (!replyText.trim() || !activeConversation) return;

    setIsSending(true);
    
    // Optimistic UI update
    const tempMsg = {
      id: 'temp-' + Date.now(),
      conversation_id: activeConversation.id,
      direction: 'OUTBOUND',
      content: replyText,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setReplyText('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('https://ksbivaolyusmrcblnnfe.supabase.co/functions/v1/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          conversation_id: activeConversation.id,
          content: tempMsg.content
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar mensagem');
      }

      // Atualizamos os dados reais no fetch automático via Realtime, 
      // ou limpamos o otimista e carregamos a base real
      fetchMessages(activeConversation.id);

    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar mensagem.');
      // Remove the optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setReplyText(tempMsg.content);
    } finally {
      setIsSending(false);
    }
  };

  const getPlatformDetails = (plat) => {
    const p = plat?.toLowerCase() || '';
    if (p === 'facebook') return { icon: MessageSquare, color: '#1877F2', bg: '#eef2ff' };
    if (p === 'instagram') return { icon: Camera, color: '#E1306C', bg: '#fdf2f8' };
    if (p === 'whatsapp') return { icon: Phone, color: '#25D366', bg: '#dcfce7' };
    return { icon: MessageCircle, color: 'var(--primary)', bg: 'var(--primary-light)' };
  };

  const handleOpenWhatsApp = async (alert, e) => {
    if (e) e.stopPropagation();
    let num = alert.telefone.replace(/\D/g, '');
    if (!num) { toast.error("Telefone inválido"); return; }
    if (num.length <= 11) num = '55' + num;
    
    const msg = alert.daysLeft === 0
      ? `Olá ${alert.nome}! 🥳\nChegou o grande dia da sua festa com o tema *${alert.tema}*! Desejamos um evento maravilhoso e inesquecível! Se precisar de qualquer suporte de última hora, estamos à disposição.`
      : `Olá ${alert.nome}! 🥳\nPassando para lembrar que faltam apenas ${alert.daysLeft} ${alert.daysLeft === 1 ? 'dia' : 'dias'} para a sua festa com o tema *${alert.tema}*!\n\nEstá tudo pronto para o grande dia? Qualquer dúvida ou ajuste, estamos por aqui!`;
      
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
    
    // Atualiza lembrete_enviado no supabase
    await supabase.from('events').update({ lembrete_enviado: true }).eq('id', alert.eventId);
    
    window.dispatchEvent(new CustomEvent('app_refresh'));
    
    // Atualiza a lista local na hora
    fetchUpcomingAlerts();
  };

  const handleCreateLead = () => {
    if (!activeConversation) return;
    setPromptConfig({
      title: 'Novo Lead',
      message: 'Confirme o nome do cliente:',
      defaultValue: activeConversation.nome_cliente,
      icon: Users,
      onConfirm: async (nome) => {
        setPromptConfig(null);
        if (!nome) return;

        const { error } = await supabase.from('leads').insert([{
          nome: nome,
          origem: activeConversation.canal,
        }]);

        if (!error) {
          toast.success("Lead salvo com sucesso!");
        } else {
          toast.error("Erro ao salvar Lead.");
        }
      }
    });
  };

  return (
    <div className={styles.inboxContainer}>
      
      {/* Coluna Esquerda: Lista de Conversas / Lembretes */}
      <div className={`${styles.chatList} ${activeConversation ? styles.hideOnMobile : ''}`}>
        <div className={styles.chatListHeader}>
          <h2>Avisos</h2>
        </div>

        {/* Abas Alternadoras */}
        <div className={styles.tabSelector}>
          <button 
            className={`${styles.tabBtn} ${inboxTab === 'chats' ? styles.active : ''}`}
            onClick={() => setInboxTab('chats')}
          >
            <MessageSquare size={16} /> Chats 
            {conversations.length > 0 && <span className={styles.tabBadge}>{conversations.length}</span>}
          </button>
          <button 
            className={`${styles.tabBtn} ${inboxTab === 'alerts' ? styles.active : ''}`}
            onClick={() => setInboxTab('alerts')}
          >
            <Phone size={16} /> Lembretes
            {alerts.length > 0 && <span className={`${styles.tabBadge} ${styles.badgeAlert}`}>{alerts.length}</span>}
          </button>
        </div>

        <div className={styles.listArea}>
          {inboxTab === 'chats' ? (
            conversations.length === 0 ? (
              <EmptyState 
                icon={Inbox}
                title="Caixa Vazia"
                description="Nenhuma conversa registrada ainda."
              />
            ) : (
              conversations.map(conv => {
                const platform = getPlatformDetails(conv.canal);
                const PlatformIcon = platform.icon;

                return (
                  <div 
                    key={conv.id} 
                    className={`${styles.chatItem} ${activeConversation?.id === conv.id ? styles.active : ''}`}
                    onClick={() => setActiveConversation(conv)}
                  >
                    <div className={styles.chatAvatar} style={{ background: platform.bg, color: platform.color }}>
                      <PlatformIcon size={20} />
                    </div>
                    <div className={styles.chatInfo}>
                      <div className={styles.chatInfoTop}>
                        <span className={styles.chatName}>{conv.nome_cliente}</span>
                        <span className={styles.chatTime}>
                          {new Date(conv.last_activity).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={styles.chatPreview}>
                        {conv.last_message || 'Nova conversa iniciada...'}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            alerts.length === 0 ? (
              <EmptyState 
                icon={Phone}
                title="Tudo em dia!"
                description="Nenhuma festa confirmada para os próximos 7 dias."
              />
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className={styles.alertCard}>
                  <div className={styles.alertHeader}>
                    <div>
                      <h4 className={styles.alertTitle}>{alert.nome}</h4>
                      <p className={styles.alertMeta}>Festa: <strong>{alert.tema}</strong></p>
                      <p className={styles.alertMeta}>Data: {new Date(alert.data_festa + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                    </div>
                    <Badge variant={alert.daysLeft === 0 ? 'danger' : alert.daysLeft <= 2 ? 'warning' : 'primary'}>
                      {alert.daysLeft === 0 ? 'É hoje!' : alert.daysLeft === 1 ? 'Falta 1 dia' : `Faltam ${alert.daysLeft} dias`}
                    </Badge>
                  </div>
                  <div className={styles.alertFooter}>
                    <Button 
                      variant="primary" 
                      size="sm" 
                      icon={Phone} 
                      onClick={(e) => handleOpenWhatsApp(alert, e)}
                      style={{ background: '#25D366', border: 'none' }}
                    >
                      Avisar Cliente
                    </Button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* Coluna Direita / Modal Mobile: Leitura e Resposta */}
      <div className={`${styles.chatDetail} ${activeConversation ? styles.showOnMobile : ''}`}>
        {activeConversation ? (
          <>
            <div className={styles.detailHeader}>
              <div className={styles.detailTitleArea}>
                <IconButton 
                  icon={X} 
                  variant="ghost" 
                  className={styles.mobileBackBtn}
                  onClick={() => setActiveConversation(null)}
                />
                <div>
                  <h3 className={styles.detailName}>{activeConversation.nome_cliente}</h3>
                  <Badge size="sm" variant="info" style={{ textTransform: 'capitalize' }}>
                    Origem: {activeConversation.canal}
                  </Badge>
                </div>
              </div>
              <div className={styles.detailActions}>
                <Button 
                  variant="primary" 
                  icon={Target}
                  onClick={handleCreateLead}
                >
                  Tornar Lead
                </Button>
              </div>
            </div>

            <div className={styles.chatHistory}>
              {messages.length === 0 ? (
                <EmptyState icon={MessageCircle} title="Carregando..." />
              ) : (
                messages.map(msg => {
                  const isOutbound = msg.direction === 'OUTBOUND';
                  return (
                    <div key={msg.id} className={`${styles.messageBubbleWrapper} ${isOutbound ? styles.outbound : styles.inbound}`}>
                      <div className={`${styles.messageBubble} ${isOutbound ? styles.outboundBubble : styles.inboundBubble}`}>
                        {msg.content}
                        <span className={styles.messageTimestamp}>
                          {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.replyArea}>
              <textarea 
                className={styles.replyInput}
                placeholder="Escreva sua resposta (será enviada direto para o cliente)..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
              <div className={styles.replyActions}>
                <Button 
                  variant="primary" 
                  icon={Send}
                  onClick={handleReply}
                  disabled={isSending || !replyText.trim()}
                >
                  {isSending ? 'Enviando...' : 'Responder Cliente'}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.emptyDetail}>
            <EmptyState 
              icon={MessageCircle}
              title="Selecione uma conversa"
              description="Clique em uma conversa na lista para ler o histórico e responder o cliente direto pela nossa plataforma."
            />
          </div>
        )}
      </div>

      {promptConfig && (
        <PromptDialog 
          isOpen={true}
          title={promptConfig.title}
          message={promptConfig.message}
          defaultValue={promptConfig.defaultValue}
          icon={promptConfig.icon}
          onConfirm={promptConfig.onConfirm}
          onCancel={() => setPromptConfig(null)}
        />
      )}
    </div>
  );
}
