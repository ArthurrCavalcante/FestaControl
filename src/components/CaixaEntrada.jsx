import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import styles from './CaixaEntrada.module.css';
import { toast } from 'react-hot-toast';

// UI Components
import Card from './ui/Card';
import Badge from './ui/Badge';
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import EmptyState from './ui/EmptyState';

// Icons
import { 
  Inbox, 
  MessageCircle, 
  MessageSquare, 
  Camera, 
  Target, 
  Send,
  X,
  Phone,
  Bot,
  AlertTriangle,
  CheckCircle2,
  ListTodo
} from 'lucide-react';

export default function CaixaEntrada() {
  const [inboxTab, setInboxTab] = useState('ai_review'); // 'ai_review' | 'chats' | 'alerts'
  
  const [tasks, setTasks] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  
  const [activeItem, setActiveItem] = useState(null); // pode ser uma conversa ou uma task
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef(null);

  const fetchData = async () => {
    // 1. Fetch AI Tasks
    const { data: aiTasks } = await supabase
      .from('inbox_tasks')
      .select('*')
      .eq('status', 'PENDING')
      .eq('type', 'AI_REVIEW')
      .order('created_at', { ascending: false });
    
    if (aiTasks) setTasks(aiTasks);

    // 2. Fetch Conversations
    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .order('last_activity', { ascending: false });
      
    if (convs) setConversations(convs);

    // 3. Fetch Alerts (Upcoming parties)
    const { data: evts } = await supabase
      .from('events')
      .select('*, deals(*, leads(*))');
      
    if (evts) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const mapped = evts
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

  useEffect(() => {
    fetchData();
  }, []);

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
    if (activeItem) {
      const convId = inboxTab === 'ai_review' ? activeItem.payload?.conversation_id : activeItem.id;
      if (convId) fetchMessages(convId);
    } else {
      setMessages([]);
    }
  }, [activeItem, inboxTab]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleResolveTask = async (task, decision) => {
    try {
      const extracted = task.payload.extracted || {};
      
      if (decision === 'LEAD' || decision === 'DEAL') {
         // Create Lead
         const { data: lead } = await supabase.from('leads').insert({
           nome: extracted.nome || 'Cliente',
           telefone: extracted.telefone,
           origem: 'ai_review'
         }).select('id').single();

         if (lead && decision === 'DEAL') {
           await supabase.from('deals').insert({
             lead_id: lead.id,
             status_funil: 'NOVOS',
             tema: extracted.tema,
             data_festa: extracted.data
           });
         }
      }

      // Resolve Task
      await supabase.from('inbox_tasks').update({
        status: decision === 'IGNORE' ? 'IGNORED' : 'RESOLVED',
        resolved_at: new Date().toISOString()
      }).eq('id', task.id);

      toast.success(decision === 'IGNORE' ? 'Tarefa ignorada' : 'Ação realizada com sucesso!');
      setActiveItem(null);
      fetchData();

    } catch (err) {
      toast.error('Erro ao processar tarefa');
      console.error(err);
    }
  };

  const getPlatformDetails = (plat) => {
    const p = plat?.toLowerCase() || '';
    if (p === 'facebook') return { icon: MessageSquare, color: '#1877F2', bg: '#eef2ff' };
    if (p === 'instagram') return { icon: Camera, color: '#E1306C', bg: '#fdf2f8' };
    if (p === 'whatsapp') return { icon: Phone, color: '#25D366', bg: '#dcfce7' };
    return { icon: MessageCircle, color: 'var(--primary)', bg: 'var(--primary-light)' };
  };

  return (
    <div className={styles.inboxContainer}>
      
      {/* Coluna Esquerda: Lista */}
      <div className={`${styles.chatList} ${activeItem ? styles.hideOnMobile : ''}`}>
        <div className={styles.chatListHeader}>
          <h2>Inbox</h2>
        </div>

        {/* Abas Alternadoras (Menu) */}
        <div className={styles.tabSelector}>
          <button 
            className={`${styles.tabBtn} ${inboxTab === 'ai_review' ? styles.active : ''}`}
            onClick={() => { setInboxTab('ai_review'); setActiveItem(null); }}
          >
            <Bot size={16} /> IA
            {tasks.length > 0 && <span className={`${styles.tabBadge} ${styles.badgeAi}`}>{tasks.length}</span>}
          </button>
          <button 
            className={`${styles.tabBtn} ${inboxTab === 'chats' ? styles.active : ''}`}
            onClick={() => { setInboxTab('chats'); setActiveItem(null); }}
          >
            <MessageSquare size={16} /> Chats 
            {conversations.length > 0 && <span className={styles.tabBadge}>{conversations.length}</span>}
          </button>
          <button 
            className={`${styles.tabBtn} ${inboxTab === 'alerts' ? styles.active : ''}`}
            onClick={() => { setInboxTab('alerts'); setActiveItem(null); }}
          >
            <AlertTriangle size={16} /> Cobranças
            {alerts.length > 0 && <span className={`${styles.tabBadge} ${styles.badgeAlert}`}>{alerts.length}</span>}
          </button>
        </div>

        <div className={styles.listArea}>
          {inboxTab === 'ai_review' && (
             tasks.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Tudo limpo!" description="Nenhuma revisão de IA pendente." />
             ) : (
                tasks.map(task => (
                  <div 
                    key={task.id} 
                    className={`${styles.chatItem} ${activeItem?.id === task.id ? styles.active : ''}`}
                    onClick={() => setActiveItem(task)}
                  >
                    <div className={styles.chatAvatar} style={{ background: '#fdf4ff', color: '#d946ef' }}>
                      <Bot size={20} />
                    </div>
                    <div className={styles.chatInfo}>
                      <div className={styles.chatInfoTop}>
                        <span className={styles.chatName}>Nova sugestão de IA</span>
                        <span className={styles.chatTime}>
                          {new Date(task.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={styles.chatPreview}>
                        Confiança: {task.payload?.confidence}%
                      </div>
                    </div>
                  </div>
                ))
             )
          )}

          {inboxTab === 'chats' && (
             conversations.length === 0 ? (
                <EmptyState icon={Inbox} title="Caixa Vazia" description="Nenhuma conversa registrada ainda." />
             ) : (
                conversations.map(conv => {
                  const platform = getPlatformDetails(conv.canal);
                  const PlatformIcon = platform.icon;
                  return (
                    <div 
                      key={conv.id} 
                      className={`${styles.chatItem} ${activeItem?.id === conv.id ? styles.active : ''}`}
                      onClick={() => setActiveItem(conv)}
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
          )}
        </div>
      </div>

      {/* Coluna Direita: Detalhes */}
      <div className={`${styles.chatDetail} ${activeItem ? styles.showOnMobile : ''}`}>
        {activeItem ? (
          <>
            <div className={styles.detailHeader}>
              <div className={styles.detailTitleArea}>
                <IconButton 
                  icon={X} 
                  variant="ghost" 
                  className={styles.mobileBackBtn}
                  onClick={() => setActiveItem(null)}
                />
                <div>
                  <h3 className={styles.detailName}>
                    {inboxTab === 'ai_review' ? 'Revisão de Sugestão IA' : activeItem.nome_cliente}
                  </h3>
                </div>
              </div>
            </div>

            <div className={styles.chatHistory}>
              {messages.length === 0 ? (
                <EmptyState icon={MessageCircle} title="Carregando mensagens..." />
              ) : (
                messages.map(msg => {
                  const isOutbound = msg.direction === 'OUTBOUND';
                  return (
                    <div key={msg.id} className={`${styles.messageBubbleWrapper} ${isOutbound ? styles.outbound : styles.inbound}`}>
                      <div className={`${styles.messageBubble} ${isOutbound ? styles.outboundBubble : styles.inboundBubble}`}>
                        
                        {msg.content_type === 'AUDIO' && (
                          <div className={styles.mediaBubble}>
                            <div className={styles.mediaHeader}>
                              <Phone size={14} /> <span>Áudio</span>
                              {msg.ai_status === 'PROCESSING' && <span className={styles.transcribing}>⏳ Transcrevendo...</span>}
                              {msg.ai_status === 'COMPLETED' && <span className={styles.transcribing} style={{color: '#10b981'}}>✅ Transcrito</span>}
                            </div>
                            {msg.media_url && (
                              <a href={msg.media_url} target="_blank" rel="noreferrer" className={styles.mediaLink}>▶ Ouvir original</a>
                            )}
                            {msg.transcription && (
                              <div className={styles.transcriptionBox}>
                                <strong>Transcrição:</strong>
                                <p>"{msg.transcription}"</p>
                              </div>
                            )}
                          </div>
                        )}

                        {msg.content_type === 'IMAGE' && (
                          <div className={styles.mediaBubble}>
                            <div className={styles.mediaHeader}>
                              <Camera size={14} /> <span>Imagem</span>
                              {msg.ai_status === 'PROCESSING' && <span className={styles.transcribing}>⏳ Analisando...</span>}
                            </div>
                            {msg.media_url && (
                              <img src={msg.media_url} alt="Recebida" className={styles.chatImage} />
                            )}
                            {msg.transcription && (
                              <div className={styles.transcriptionBox}>
                                <strong>Descrição da IA:</strong>
                                <p>{msg.transcription}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {(msg.content_type === 'TEXT' || !msg.content_type) && msg.content}

                        <span className={styles.messageTimestamp}>
                          {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              
              {/* Painel da IA injetado na conversa */}
              {inboxTab === 'ai_review' && activeItem.payload && (
                 <div className={styles.aiReviewPanel}>
                   <div className={styles.aiReviewHeader}>
                     <Bot size={24} color="var(--primary)" />
                     <div>
                       <h4>Intenção: {activeItem.payload.intent === 'PURCHASE' ? '🛒 Fechamento' : activeItem.payload.intent === 'PRICE' ? '💰 Cotação' : activeItem.payload.intent === 'QUESTION' ? '❓ Dúvida' : activeItem.payload.intent === 'COMPLAINT' ? '⚠️ Reclamação' : '🤖 Análise Concluída'}</h4>
                       <p>Confiança: <strong style={{color: activeItem.payload.confidence < 90 ? '#f59e0b' : '#10b981'}}>{activeItem.payload.confidence}%</strong></p>
                     </div>
                   </div>

                   {activeItem.payload.summary && (
                     <div className={styles.aiSummary}>
                       <strong>Resumo:</strong> {activeItem.payload.summary}
                     </div>
                   )}
                   
                   {activeItem.payload.uncertainty_reason && (
                     <div className={styles.aiReason}>
                       <AlertTriangle size={16} />
                       {activeItem.payload.uncertainty_reason}
                     </div>
                   )}

                   <div className={styles.aiFields}>
                     <div className={styles.aiField}><span>Nome:</span> <strong>{activeItem.payload.extracted?.nome || '-'}</strong></div>
                     <div className={styles.aiField}><span>Tema:</span> <strong>{activeItem.payload.extracted?.tema || '-'}</strong></div>
                     <div className={styles.aiField}><span>Data:</span> <strong>{activeItem.payload.extracted?.data || '-'}</strong></div>
                     <div className={styles.aiField}><span>Telefone:</span> <strong>{activeItem.payload.extracted?.telefone || '-'}</strong></div>
                   </div>

                   <div className={styles.aiActions}>
                     <Button variant="outline" size="sm" onClick={() => handleResolveTask(activeItem, 'LEAD')}>
                       Criar apenas Lead
                     </Button>
                     <Button variant="primary" size="sm" onClick={() => handleResolveTask(activeItem, 'DEAL')}>
                       Criar Lead + Orçamento
                     </Button>
                     <Button variant="ghost" color="danger" size="sm" onClick={() => handleResolveTask(activeItem, 'IGNORE')}>
                       Ignorar
                     </Button>
                   </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {inboxTab === 'chats' && (
              <div className={styles.replyArea}>
                <textarea 
                  className={styles.replyInput}
                  placeholder="Escreva sua resposta..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div className={styles.replyActions}>
                  <Button variant="primary" icon={Send} disabled>Responder (Em breve)</Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyDetail}>
            <EmptyState 
              icon={Inbox}
              title="Selecione um item"
              description="Escolha uma notificação ou conversa na lista ao lado."
            />
          </div>
        )}
      </div>
    </div>
  );
}
