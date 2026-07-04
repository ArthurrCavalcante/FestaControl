import React, { useState } from 'react';
import styles from './FichaCliente.module.css';
import { useCompany } from '../contexts/CompanyContext';

// UI
import Modal from './ui/Modal';
import Button from './ui/Button';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import PromptDialog from './ui/PromptDialog';
import ConfirmDialog from './ui/ConfirmDialog';

// Icons
import { 
  User, 
  Phone, 
  Pencil, 
  MessageCircle, 
  XOctagon, 
  Zap, 
  Activity, 
  History, 
  Image as ImageIcon, 
  MessageSquare,
  FilePlus,
  Send,
  ArrowRightCircle,
  Clock,
  MapPin,
  CircleDollarSign,
  Package,
  CalendarDays
} from 'lucide-react';

export default function FichaCliente({ lead, onClose, onAdvanceStatus, onUpdateLead, onUpdateDeal }) {
  const { settings } = useCompany();
  const [activeTab, setActiveTab] = useState('timeline');
  const [mensagens, setMensagens] = useState([{ id: 1, data: '10/10/2023', texto: 'Cliente perguntou sobre o pacote básico.' }]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [fotos, setFotos] = useState([
    { id: 1, nome: 'Foto Pinterest 1' },
    { id: 2, nome: 'Foto Pinterest 2' },
    { id: 3, nome: 'Contrato Assinado.pdf' }
  ]);
  const [promptConfig, setPromptConfig] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!lead) return null;

  const openWhatsApp = (e) => {
    if (e) e.stopPropagation();
    if (!lead || !lead.telefone) return;
    let num = lead.telefone.replace(/\D/g, '');
    if (!num) { toast.error("Telefone inválido"); return; }
    if (num.length <= 11) num = '55' + num;
    
    let msg = `Olá ${lead.nome}, tudo bem? Aqui é da ${settings?.companies?.nome || 'FestaFlow'}.`;
    if (lead.status === 'NEGOCIACAO' && settings?.pix_key) {
      msg += ` Segue nossa chave PIX para confirmar a reserva do seu evento: ${settings.pix_key}`;
    }
    
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleProximaAcao = () => {
    openWhatsApp();
    if (onAdvanceStatus) {
      if (lead.status === 'CANCELADO') {
        onAdvanceStatus(lead.id, 'NOVOS');
      } else {
        const statusFlow = ['NOVOS', 'NEGOCIACAO', 'SINAL', 'CONFIRMADO'];
        const currentIndex = statusFlow.indexOf(lead.status);
        if (currentIndex !== -1 && currentIndex < statusFlow.length - 1) {
          onAdvanceStatus(lead.id, statusFlow[currentIndex + 1]);
        }
      }
    }
  };

  const handleAddMensagem = () => {
    if (!novaMensagem.trim()) return;
    setMensagens([...mensagens, { id: Date.now(), data: new Date().toLocaleDateString('pt-BR'), texto: novaMensagem }]);
    setNovaMensagem('');
  };

  const handleAddFoto = () => {
    setFotos([...fotos, { id: Date.now(), nome: `Nova Referência ${fotos.length + 1}.jpg` }]);
  };

  // Motor: Determinar a "Próxima Ação" baseada no status
  let motor = { 
    texto: 'Cliente novo. Enviar primeira mensagem.', 
    botao: 'Iniciar Atendimento', 
    btnVariant: 'primary',
    bg: '#eff6ff', 
    color: '#3b82f6' 
  };
  let statusBadge = { variant: 'danger', text: 'Cancelado' };
  
  if (lead.status === 'NOVOS') {
    statusBadge = { variant: 'info', text: 'Novos' };
  } else if (lead.status === 'ORCAMENTO') {
    motor = { texto: 'Orçamento enviado. Aguardando feedback.', botao: 'Cobrar Resposta', btnVariant: 'warning', bg: '#fef3c7', color: '#d97706' };
    statusBadge = { variant: 'warning', text: 'Orçamento' };
  } else if (lead.status === 'NEGOCIACAO') {
    motor = { texto: 'Fechando detalhes. Falta cobrar o sinal.', botao: 'Enviar PIX do Sinal', btnVariant: 'primary', bg: '#e0e7ff', color: '#4f46e5' };
    statusBadge = { variant: 'warning', text: 'Negociação' };
  } else if (lead.status === 'SINAL') {
    motor = { texto: 'Sinal recebido. Gerar e enviar contrato.', botao: 'Enviar Contrato', btnVariant: 'primary', bg: '#f3e8ff', color: '#9333ea' };
    statusBadge = { variant: 'primary', text: 'Sinal Pago' };
  } else if (lead.status === 'CONFIRMADO') {
    motor = { texto: 'Festa confirmada. Confirmar logística de montagem.', botao: 'Confirmar Logística', btnVariant: 'success', bg: '#dcfce7', color: '#16a34a' };
    statusBadge = { variant: 'success', text: 'Confirmado' };
  } else if (lead.status === 'CANCELADO') {
    motor = { texto: 'Venda perdida. Tentar resgate futuro.', botao: 'Reativar Lead', btnVariant: 'secondary', bg: '#f1f5f9', color: '#64748b' };
  }

  // Formatadores rápidos
  const formatDate = (dateString) => {
    if (!dateString) return 'A Definir';
    const [yyyy, mm, dd] = dateString.split('T')[0].split('-');
    return `${dd}/${mm}/${yyyy}`;
  };

  return (
    <Modal 
      isOpen={true} 
      onClose={onClose} 
      maxWidth="xl" 
      hideHeader 
    >
      <div className={styles.modalContent}>
        
        {/* Header Profiling */}
        <div className={styles.headerArea}>
          <div className={styles.headerTop}>
            <div className={styles.nameSection}>
              <div className={styles.nameRow}>
                <h2 className={styles.clientName}>{lead.nome}</h2>
                <Badge variant={statusBadge.variant} size="lg">{statusBadge.text}</Badge>
              </div>
              <div className={styles.phoneRow}>
                <Phone size={18} /> {lead.telefone}
                <button 
                  className={styles.editBtn}
                  title="Editar Telefone"
                  onClick={() => setPromptConfig({
                    title: 'Editar Telefone',
                    defaultValue: lead.telefone,
                    icon: Phone,
                    onConfirm: (novoTel) => {
                      if (novoTel && onUpdateLead) onUpdateLead(lead.lead_id || lead.id, { telefone: novoTel });
                      setPromptConfig(null);
                    }
                  })}
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>

            <div className={styles.headerActions}>
              {lead.status !== 'CANCELADO' && (
                <Button 
                  variant="ghost" 
                  color="danger" 
                  icon={XOctagon}
                  onClick={() => setShowCancelConfirm(true)}
                >
                  Cancelar Venda
                </Button>
              )}
              <Button 
                variant="primary" 
                size="lg"
                icon={MessageCircle} 
                onClick={openWhatsApp}
                style={{ background: '#25D366', border: 'none' }}
              >
                Falar no WhatsApp
              </Button>
            </div>
          </div>

          {/* Grid de Informações Estruturais */}
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Tema da Festa</span>
              <div className={styles.infoValue}>
                <Package size={16} color="var(--text-tertiary)" />
                {lead.tema || 'A Definir'}
                <button className={styles.editBtn} onClick={() => setPromptConfig({
                  title: 'Tema da Festa',
                  defaultValue: lead.tema,
                  icon: Package,
                  onConfirm: (val) => {
                    if (val && onUpdateDeal) onUpdateDeal(lead.id, { tema: val });
                    setPromptConfig(null);
                  }
                })}><Pencil size={14} /></button>
              </div>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Orçamento Final</span>
              <div className={styles.infoValue}>
                <CircleDollarSign size={16} color="var(--success)" />
                R$ {lead.valor_total || '0.00'}
                <button className={styles.editBtn} onClick={() => setPromptConfig({
                  title: 'Orçamento Final',
                  defaultValue: lead.valor_total,
                  icon: CircleDollarSign,
                  onConfirm: (val) => {
                    if (val && onUpdateDeal) onUpdateDeal(lead.id, { valor_total: val });
                    setPromptConfig(null);
                  }
                })}><Pencil size={14} /></button>
              </div>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Data</span>
              <div className={styles.infoValue}>
                <CalendarDays size={16} color="var(--text-tertiary)" />
                {formatDate(lead.data_festa)}
                <button className={styles.editBtn} onClick={() => setPromptConfig({
                  title: 'Data (DD/MM/AAAA)',
                  defaultValue: formatDate(lead.data_festa),
                  icon: CalendarDays,
                  onConfirm: (val) => {
                    if (val && onUpdateDeal) {
                      let dbVal = val;
                      if (val.includes('/')) {
                        const p = val.split('/');
                        if (p.length === 3) dbVal = `${p[2]}-${p[1]}-${p[0]}`;
                      }
                      onUpdateDeal(lead.id, { data_festa: dbVal });
                    }
                    setPromptConfig(null);
                  }
                })}><Pencil size={14} /></button>
              </div>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Horário</span>
              <div className={styles.infoValue}>
                <Clock size={16} color="var(--text-tertiary)" />
                {lead.horario_festa || 'A Definir'}
                <button className={styles.editBtn} onClick={() => setPromptConfig({
                  title: 'Horário da Festa',
                  defaultValue: lead.horario_festa,
                  icon: Clock,
                  onConfirm: (val) => {
                    if (val && onUpdateDeal) onUpdateDeal(lead.id, { horario_festa: val });
                    setPromptConfig(null);
                  }
                })}><Pencil size={14} /></button>
              </div>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Local da Montagem</span>
              <div className={styles.infoValue}>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.endereco || '')}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  title="Abrir no Google Maps"
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  <MapPin size={16} color="var(--primary)" style={{ cursor: 'pointer' }} />
                </a>
                <button className={styles.editBtn} onClick={() => setPromptConfig({
                  title: 'Endereço',
                  defaultValue: lead.endereco,
                  icon: MapPin,
                  onConfirm: (val) => {
                    if (val && onUpdateDeal) onUpdateDeal(lead.id, { endereco: val });
                    setPromptConfig(null);
                  }
                })}><Pencil size={14} /></button>
              </div>
            </div>
          </div>
        </div>

        {/* PRÓXIMA AÇÃO (O MOTOR) */}
        <div className={styles.motorSection}>
          <div className={styles.motorInfo}>
            <div className={styles.motorIconBox} style={{ background: motor.bg, color: motor.color }}>
              <Zap size={24} />
            </div>
            <div>
              <span className={styles.motorLabel}>Motor de Vendas (Próxima Ação)</span>
              <p className={styles.motorText}>{motor.texto}</p>
            </div>
          </div>
          <Button 
            variant={motor.btnVariant} 
            size="lg" 
            icon={ArrowRightCircle}
            onClick={handleProximaAcao}
          >
            {motor.botao}
          </Button>
        </div>

        {/* Tabs Horizontais (Mobile Friendly) */}
        <div className={styles.tabsNav}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'timeline' ? styles.active : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <Activity size={18} /> Resumo Visual
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'historico' ? styles.active : ''}`}
            onClick={() => setActiveTab('historico')}
          >
            <History size={18} /> Histórico (CRM)
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'galeria' ? styles.active : ''}`}
            onClick={() => setActiveTab('galeria')}
          >
            <ImageIcon size={18} /> Arquivos e Contrato
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'mensagens' ? styles.active : ''}`}
            onClick={() => setActiveTab('mensagens')}
          >
            <MessageSquare size={18} /> Anotações
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          
          {activeTab === 'timeline' && (
            <div className={styles.timelineWrapper}>
              
              <div className={styles.timelineItem}>
                <div className={styles.timelineIconCol}>
                  <div className={styles.timelineIconBox} style={{ color: 'var(--primary)', borderColor: 'var(--primary-light)' }}>
                    <User size={20} />
                  </div>
                  <div className={styles.timelineLine}></div>
                </div>
                <div className={styles.timelineContent}>
                  <div className={styles.timelineTitle}>Lead Criado</div>
                  <div className={styles.timelineDesc}>
                    {lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : 'Data desconhecida'} 
                    <br/>Capturado via {lead.origem || 'Registro Manual'}
                  </div>
                </div>
              </div>

              <div className={styles.timelineItem}>
                <div className={styles.timelineIconCol}>
                  <div className={styles.timelineIconBox} style={{ background: motor.bg, color: motor.color, borderColor: 'transparent' }}>
                    <Zap size={20} />
                  </div>
                </div>
                <div className={`${styles.timelineContent} ${styles.last}`}>
                  <div className={styles.timelineTitle}>Fase Atual: {lead.status}</div>
                  <div className={styles.timelineDesc}>
                    Aguardando execução da Próxima Ação recomendada pelo Motor.
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'historico' && (
            <EmptyState 
              icon={History}
              title="Em Desenvolvimento"
              description="O histórico completo com inteligência de recompras estará disponível nas próximas atualizações."
            />
          )}

          {activeTab === 'galeria' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Referências e Documentos</h3>
                <Button variant="secondary" icon={FilePlus} onClick={handleAddFoto}>Anexar Arquivo</Button>
              </div>
              <div className={styles.galleryGrid}>
                {fotos.map(foto => (
                  <div key={foto.id} className={styles.galleryItem}>
                    <ImageIcon size={32} opacity={0.5} />
                    <span style={{ fontSize: '0.85rem' }}>{foto.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'mensagens' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className={styles.messageList}>
                {mensagens.map(msg => (
                  <div key={msg.id} className={styles.messageBubble}>
                    <span className={styles.messageDate}>{msg.data}</span>
                    <p className={styles.messageText}>{msg.texto}</p>
                  </div>
                ))}
              </div>
              <div className={styles.messageInputArea}>
                <input 
                  type="text" 
                  value={novaMensagem} 
                  onChange={(e) => setNovaMensagem(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMensagem()} 
                  placeholder="Escreva uma anotação privada sobre a negociação..." 
                  className={styles.messageInput} 
                />
                <Button variant="primary" icon={Send} onClick={handleAddMensagem}>Salvar</Button>
              </div>
            </div>
          )}

        </div>
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

      {showCancelConfirm && (
        <ConfirmDialog
          isOpen={true}
          title="Cancelar Venda"
          message={`Tem certeza que deseja cancelar a venda para ${lead.nome}? Essa ação mudará o status para Cancelado.`}
          confirmText="Sim, Cancelar Venda"
          onConfirm={() => {
            if (onAdvanceStatus) onAdvanceStatus(lead.id, 'CANCELADO');
            setShowCancelConfirm(false);
          }}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}
    </Modal>
  );
}
