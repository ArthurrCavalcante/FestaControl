import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import styles from './CaixaEntrada.module.css';
import { toast } from 'react-hot-toast';
import { sendWhatsAppReply } from '../services/whatsappClient';
import { hydratePrivateMessageMedia } from '../services/messageMedia';

// UI Components
import Button from './ui/Button';
import EmptyState from './ui/EmptyState';

// Icons
import { 
  Inbox, 
  MessageCircle, 
  MessageSquare, 
  Camera, 
  Send,
  Phone,
  Bot,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  MapPin,
  Calendar,
  Loader2,
  DollarSign,
  Bell,
  ArrowLeft,
  FileText,
  Video
} from 'lucide-react';

export default function CaixaEntrada() {
  const [inboxTab, setInboxTab] = useState('ai_review'); // 'ai_review' | 'chats' | 'alerts'
  
  const [tasks, setTasks] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  
  const [activeItem, setActiveItem] = useState(null); // pode ser uma conversa ou uma task
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
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
      try {
        setMessages(await hydratePrivateMessageMedia(supabase, data));
      } catch (mediaError) {
        console.error('Erro ao assinar mídias privadas:', mediaError);
        setMessages(data.map((message) => ({ ...message, media_display_url: null })));
      }
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
      const crmState = task.payload.crm_state || {};
      const cliente = crmState.cliente || {};
      const evento = crmState.evento || {};
      
      if (decision === 'LEAD' || decision === 'DEAL') {
         // Create Lead
         const { data: lead } = await supabase.from('leads').insert({
           nome: cliente.nome || 'Cliente',
           telefone: cliente.telefone,
           origem: 'ai_review'
         }).select('id').single();

         if (lead && decision === 'DEAL') {
           await supabase.from('deals').insert({
             lead_id: lead.id,
             status_funil: 'NOVOS',
             tema: evento.tema,
             data_festa: evento.data,
             horario_festa: evento.horario
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

  const handleCreateLeadFromConversation = async (conversation) => {
    try {
      const crmState = conversation.crm_state || {};
      const cliente = crmState.cliente || {};
      const evento = crmState.evento || {};
      
      // 1. Criar Lead
      const { data: lead, error: leadError } = await supabase.from('leads').insert({
        nome: cliente.nome || conversation.nome_cliente || 'Novo Lead via WhatsApp',
        telefone: cliente.telefone || (conversation.canal === 'whatsapp' ? conversation.remetente_id.split('@')[0] : null),
        origem: 'whatsapp'
      }).select('id').single();

      if (leadError) throw leadError;

      // 2. Criar Deal associado
      const { error: dealError } = await supabase.from('deals').insert({
        lead_id: lead.id,
        status_funil: 'NOVOS',
        tema: evento.tema,
        data_festa: evento.data,
        horario_festa: evento.horario
      }).select('id').single();

      if (dealError) throw dealError;

      // 3. Atualizar a conversation com o lead_id (para esconder o botão, e manter aberta)
      const { error: updateError } = await supabase.from('conversations').update({
        lead_id: lead.id
      }).eq('id', conversation.id);

      if (updateError) throw updateError;

      toast.success('Lead e Negócio criados! A conversa continua aberta.');
      
      // Atualiza estado local
      setActiveItem({ ...activeItem, lead_id: lead.id });
      fetchData();

    } catch (err) {
      console.error(err);
      toast.error('Erro ao transformar em Lead: ' + err.message);
    }
  };

  const handleRecalculateState = async () => {
    setIsRecalculating(true);
    try {
      const convId = activeItem.id;
      const { data, error } = await supabase.functions.invoke('recalculate-state', {
        body: { conversation_id: convId }
      });
      if (error) throw error;
      
      if (data?.crm_state) {
        setActiveItem({ ...activeItem, crm_state: data.crm_state });
        toast.success('Ficha Inteligente atualizada!');
        // Update local list as well
        setConversations(conversations.map(c => c.id === convId ? { ...c, crm_state: data.crm_state } : c));
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao recalcular estado');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSendReply = async () => {
    if (!activeItem || !['evolution', 'whatsapp'].includes(activeItem.canal?.toLowerCase())) {
      toast.error('Esta conversa não está conectada ao WhatsApp.');
      return;
    }

    setIsSendingReply(true);
    try {
      const message = await sendWhatsAppReply(supabase, activeItem.id, replyText);
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setConversations((current) => current.map((conversation) => conversation.id === activeItem.id
        ? { ...conversation, last_message: message.content, last_activity: message.created_at }
        : conversation));
      setReplyText('');
      toast.success('Mensagem enviada.');
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Não foi possível enviar pelo WhatsApp.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const openWhatsAppReminder = (alert) => {
    const number = String(alert.telefone || '').replace(/\D/g, '');
    if (!number) {
      toast.error('Cadastre o telefone da cliente antes de abrir o WhatsApp.');
      return;
    }
    const text = `Olá, ${alert.nome}! Passando para confirmar os detalhes da sua festa de ${alert.tema} no dia ${new Date(`${alert.data_festa}T12:00:00`).toLocaleDateString('pt-BR')}.`;
    window.open(`https://wa.me/55${number.replace(/^55/, '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const getPlatformDetails = (plat) => {
    const p = plat?.toLowerCase() || '';
    if (p === 'facebook') return { icon: MessageSquare, color: '#1877F2', bg: '#eef2ff' };
    if (p === 'instagram') return { icon: Camera, color: '#E1306C', bg: '#fdf2f8' };
    if (p === 'whatsapp' || p === 'evolution') return { icon: Phone, color: '#25D366', bg: '#dcfce7' };
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
                        <span className={styles.chatName}>Alerta IA</span>
                        <span className={styles.chatTime}>
                          {new Date(task.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={styles.chatPreview}>
                        {task.payload?.summary || 'Revisão pendente'}
                      </div>
                    </div>
                  </div>
                ))
             )
          )}

          {inboxTab === 'alerts' && (
             alerts.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Tudo tranquilo!" description="Nenhuma cobrança ou aviso pendente." />
             ) : (
                alerts.map(alert => (
                  <div 
                    key={alert.id} 
                    className={`${styles.chatItem} ${activeItem?.id === alert.id ? styles.active : ''}`}
                    onClick={() => setActiveItem(alert)}
                  >
                    <div className={styles.chatAvatar} style={{ background: '#fef2f2', color: '#ef4444' }}>
                      <Bell size={20} />
                    </div>
                    <div className={styles.chatInfo}>
                      <div className={styles.chatInfoTop}>
                        <span className={styles.chatName}>{alert.nome}</span>
                        <span className={styles.chatTime}>
                          {alert.daysLeft === 0 ? 'Hoje' : `Faltam ${alert.daysLeft} dias`}
                        </span>
                      </div>
                      <div className={styles.chatPreview}>
                        Lembrete de Pagamento / Festa
                      </div>
                    </div>
                  </div>
                ))
             )
          )}

          {inboxTab === 'chats' && (
             <>
               {conversations.length === 0 ? (
                  <EmptyState icon={Inbox} title="Caixa Vazia" description="Nenhuma conversa registrada." />
               ) : (
                  conversations
                    .map(conv => {
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
               )}
             </>
          )}
        </div>
      </div>

      {/* Coluna Direita: Detalhes */}
      <div className={`${styles.chatDetail} ${activeItem ? styles.showOnMobile : ''}`}>
        {activeItem ? (
          <>
            <div className={styles.detailHeader}>
              <div className={styles.detailTitleArea}>
                <Button variant="ghost" className={styles.backButton} onClick={() => setActiveItem(null)}>
                  <ArrowLeft size={20} />
                </Button>
                <div>
                  <h3 className={styles.detailTitle}>
                    {inboxTab === 'ai_review' ? 'Revisão de IA' : 
                     inboxTab === 'alerts' ? `Aviso: ${activeItem.nome}` : 
                     activeItem.nome_cliente}
                  </h3>
                </div>
              </div>
              {inboxTab === 'chats' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '0.85rem' }}>
                    {activeItem.status === 'NEW' ? 'Novo' : 
                     activeItem.status === 'ACTIVE' ? 'Ativo' : 
                     activeItem.status === 'WAITING_CLIENT' ? 'Aguardando Cliente' :
                     activeItem.status === 'WAITING_COMPANY' ? 'Aguardando Loja' :
                     activeItem.status === 'ARCHIVED' ? 'Arquivado' : activeItem.status}
                  </div>
                  {!activeItem.lead_id && (
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={() => handleCreateLeadFromConversation(activeItem)}
                    >
                      Transformar em Lead
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    icon={RefreshCw} 
                    onClick={handleRecalculateState}
                    disabled={isRecalculating}
                  >
                    {isRecalculating ? 'Recalculando...' : 'Atualizar Resumo'}
                  </Button>
                </div>
              )}
            </div>

            <div className={styles.detailBody}>
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
                                {msg.ai_status === 'PROCESSING' && <span className={styles.transcribing} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Loader2 size={14} className={styles.spinner} /> Transcrevendo...</span>}
                                {msg.ai_status === 'COMPLETED' && <span className={styles.transcribing} style={{color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px'}}><CheckCircle2 size={14} /> Transcrito</span>}
                              </div>
                              {msg.media_display_url && (
                                <audio controls preload="metadata" src={msg.media_display_url} className={styles.audioPlayer}>Seu navegador não consegue reproduzir este áudio.</audio>
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
                                {msg.ai_status === 'PROCESSING' && <span className={styles.transcribing} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Loader2 size={14} className={styles.spinner} /> Analisando...</span>}
                              </div>
                              {msg.media_display_url && (
                                <img src={msg.media_display_url} alt="Recebida" className={styles.chatImage} />
                              )}
                              {msg.transcription && (
                                <div className={styles.transcriptionBox}>
                                  <strong>Descrição da IA:</strong>
                                  <p>{msg.transcription}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {msg.content_type === 'DOCUMENT' && (
                            <div className={styles.mediaBubble}>
                              <div className={styles.mediaHeader}><FileText size={14} /><span>{msg.content || 'Documento'}</span></div>
                              {msg.media_display_url && <a href={msg.media_display_url} target="_blank" rel="noreferrer" className={styles.mediaLink}>Abrir documento</a>}
                            </div>
                          )}

                          {msg.content_type === 'VIDEO' && (
                            <div className={styles.mediaBubble}>
                              <div className={styles.mediaHeader}><Video size={14} /><span>Vídeo recebido</span></div>
                              <p>Vídeos não são baixados automaticamente durante o beta.</p>
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
                         <h4>Ação Necessária: {activeItem.payload.summary}</h4>
                       </div>
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
                
                {inboxTab === 'alerts' && (
                  <div className={styles.aiReviewPanel} style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                     <div className={styles.aiReviewHeader}>
                       <Bell size={24} color="#ef4444" />
                       <div>
                         <h4>Festa se aproximando!</h4>
                         <p style={{ margin: '4px 0 0 0', color: '#7f1d1d', fontSize: '0.85rem' }}>
                           A festa de <strong>{activeItem.nome}</strong> é em {activeItem.daysLeft === 0 ? 'hoje' : `${activeItem.daysLeft} dias`} ({new Date(activeItem.data_festa + 'T12:00:00').toLocaleDateString('pt-BR')}).
                         </p>
                       </div>
                     </div>
                     <div className={styles.aiActions} style={{ marginTop: '1rem' }}>
                       <Button variant="primary" size="sm" icon={MessageCircle} onClick={() => openWhatsAppReminder(activeItem)}>
                         Abrir mensagem no WhatsApp
                       </Button>
                     </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Ficha Inteligente (CRM State) Lateral */}
              {inboxTab === 'chats' && activeItem.crm_state && (
                <div className={styles.crmStatePanel}>
                  <div className={styles.crmStateHeader}>
                    <Sparkles size={16} color="var(--primary)" /> Ficha Inteligente
                  </div>

                  <div className={styles.crmCard}>
                    <h5>Cliente</h5>
                    <p><strong>Nome:</strong> {activeItem.crm_state.cliente?.nome || '-'}</p>
                    <p><strong>Telefone:</strong> {activeItem.crm_state.cliente?.telefone || '-'}</p>
                  </div>

                  <div className={styles.crmCard}>
                    <h5>Evento</h5>
                    <p><Sparkles size={12}/> <strong>Tema:</strong> {activeItem.crm_state.evento?.tema || '-'}</p>
                    <p><Calendar size={12}/> <strong>Data:</strong> {activeItem.crm_state.evento?.data || '-'} às {activeItem.crm_state.evento?.horario || '-'}</p>
                    <p><MapPin size={12}/> <strong>Local:</strong> {activeItem.crm_state.cliente?.bairro || '-'}</p>
                  </div>

                  <div className={styles.crmCard}>
                    <h5>Negociação</h5>
                    <p><DollarSign size={12}/> <strong>Orçamento:</strong> {activeItem.crm_state.orcamento?.valor_desejado ? `R$ ${activeItem.crm_state.orcamento?.valor_desejado}` : '-'}</p>
                    <p><strong>Intenção:</strong> {activeItem.crm_state.intencao || '-'}</p>
                  </div>

                  {activeItem.crm_state.objecao && (
                    <div className={`${styles.crmCard} ${styles.crmObjection}`}>
                      <h5><AlertTriangle size={12}/> Objeção Detectada</h5>
                      <p><strong>{activeItem.crm_state.objecao.type}:</strong> {activeItem.crm_state.objecao.message}</p>
                    </div>
                  )}

                  {activeItem.crm_state.proxima_acao && (
                    <div className={`${styles.crmCard} ${styles.crmNextAction}`}>
                      <h5>Próxima Ação Sugerida</h5>
                      <p>{activeItem.crm_state.proxima_acao}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {inboxTab === 'chats' && (
              <div className={styles.replyArea}>
                <textarea 
                  className={styles.replyInput}
                  placeholder="Escreva sua resposta..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  maxLength={4000}
                  disabled={isSendingReply}
                />
                <div className={styles.replyActions}>
                  <Button
                    variant="primary"
                    icon={Send}
                    onClick={handleSendReply}
                    disabled={isSendingReply || !replyText.trim() || !['evolution', 'whatsapp'].includes(activeItem.canal?.toLowerCase())}
                  >
                    {isSendingReply ? 'Enviando...' : 'Responder'}
                  </Button>
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
