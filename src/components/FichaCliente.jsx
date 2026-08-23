import React, { useState, useEffect, useRef } from 'react';
import styles from './FichaCliente.module.css';
import { useCompany } from '../hooks/useCompany';
import { supabase } from '../supabaseClient';
import { addDealNote, uploadDealFile, fetchUnifiedTimeline, fetchThemeHistory, createDealFileSignedUrls } from '../services/dbService';
import { toast } from 'react-hot-toast';

// UI
import Modal from './ui/Modal';
import Button from './ui/Button';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import PromptDialog from './ui/PromptDialog';
import ConfirmDialog from './ui/ConfirmDialog';
import Spinner from './ui/Spinner';

// Icons
import { 
  User, Phone, Pencil, MessageCircle, XOctagon, Zap, Activity, History, 
  MessageSquare, FilePlus, Send, ArrowRightCircle, 
  Clock, MapPin, CircleDollarSign, Package, CalendarDays, FileText,
  Eye, CheckSquare, Image as ImageIcon
} from 'lucide-react';

export default function FichaCliente({ lead, onClose, onAdvanceStatus, onUpdateLead, onUpdateDeal }) {
  const { settings } = useCompany();
  const [activeTab, setActiveTab] = useState('timeline');
  const [timeline, setTimeline] = useState([]);
  const [themePhotos, setThemePhotos] = useState([]);
  const [themeHistory, setThemeHistory] = useState([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [novaNotaTipo, setNovaNotaTipo] = useState('NORMAL');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [promptConfig, setPromptConfig] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [selectedThemePhotos, setSelectedThemePhotos] = useState([]);
  const [signedFileUrls, setSignedFileUrls] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (lead?.id) {
      loadData();
    }
  // loadData intentionally refreshes when the selected deal or its theme changes.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, lead?.tema]);

  const loadData = async () => {
    setIsLoading(true);
    const tl = await fetchUnifiedTimeline(lead.id);
    setTimeline(tl);
    try {
      const urls = await createDealFileSignedUrls(tl.filter(item => item.type === 'FILE').map(item => item.path));
      setSignedFileUrls(urls);
    } catch {
      setSignedFileUrls({});
    }
    
    if (lead.tema) {
      // Fetch fotos do tema
      const { data: fotos } = await supabase.from('catalogo_fotos').select('*').eq('tema', lead.tema);
      setThemePhotos(fotos || []);
      
      // Fetch histórico de orçamentos com esse tema
      const th = await fetchThemeHistory(lead.tema_id);
      setThemeHistory(th || []);
    }
    setIsLoading(false);
  };

  if (!lead) return null;

  const openWhatsApp = (e, customMsg = null) => {
    if (e) e.stopPropagation();
    if (settings?.companies?.is_demo) { toast.error('Ações externas estão desativadas no ambiente demo.'); return; }
    if (!lead || !lead.telefone) return;
    let num = lead.telefone.replace(/\D/g, '');
    if (!num) { toast.error("Telefone inválido"); return; }
    if (num.length <= 11) num = '55' + num;
    
    let msg = customMsg || `Olá ${lead.nome}, tudo bem? Aqui é da ${settings?.companies?.nome || 'FestaControl'}.`;
    if (!customMsg && lead.status === 'NEGOCIACAO' && settings?.pix_key) {
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

  const handleAddMensagem = async () => {
    if (!novaMensagem.trim()) return;
    const companyId = lead.company_id || settings?.companies?.id;
    const res = await addDealNote(lead.id, companyId, novaMensagem, novaNotaTipo);
    if (res.success) {
      setNovaMensagem('');
      loadData();
      toast.success('Anotação salva!');
    } else {
      toast.error('Erro: ' + (res.error?.message || JSON.stringify(res.error)));
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    
    // Determinar tipo baseado na extensão
    let tipo = 'Documento';
    if (file.type.startsWith('image/')) tipo = 'Foto';
    else if (file.name.toLowerCase().includes('comprovante')) tipo = 'Comprovante PIX';
    else if (file.name.toLowerCase().includes('contrato')) tipo = 'Contrato';

    // Para pegar companyId, lead.company_id deve existir (vem do app)
    const companyId = lead.company_id || settings?.companies?.id;
    
    const res = await uploadDealFile(lead.id, companyId, file, tipo);
    setIsUploading(false);
    
    if (res.success) {
      toast.success('Arquivo anexado com sucesso!');
      loadData();
    } else {
      toast.error('Erro: ' + (res.error?.message || JSON.stringify(res.error)));
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const togglePhotoSelection = (fotoPath) => {
    if (selectedThemePhotos.includes(fotoPath)) {
      setSelectedThemePhotos(selectedThemePhotos.filter(p => p !== fotoPath));
    } else {
      setSelectedThemePhotos([...selectedThemePhotos, fotoPath]);
    }
  };

  const sendSelectedPhotosOnWhatsApp = () => {
    if (selectedThemePhotos.length === 0) return;
    const links = selectedThemePhotos.join('\n');
    const msg = `Olá ${lead.nome}! Selecionei algumas fotos de referência do tema ${lead.tema || ''} para você dar uma olhada:\n\n${links}`;
    openWhatsApp(null, msg);
    setSelectedThemePhotos([]);
  };

  // Motor: Determinar a "Próxima Ação" baseada no status
  let motor = { texto: 'Cliente novo. Enviar primeira mensagem.', botao: 'Iniciar Atendimento', btnVariant: 'primary', bg: '#eff6ff', color: '#3b82f6' };
  let statusBadge = { variant: 'danger', text: 'Cancelado' };
  if (lead.status === 'NOVOS') { statusBadge = { variant: 'info', text: 'Novos' }; } 
  else if (lead.status === 'ORCAMENTO') { motor = { texto: 'Orçamento enviado. Aguardando feedback.', botao: 'Cobrar Resposta', btnVariant: 'warning', bg: '#fef3c7', color: '#d97706' }; statusBadge = { variant: 'warning', text: 'Orçamento' }; } 
  else if (lead.status === 'NEGOCIACAO') { motor = { texto: 'Fechando detalhes. Falta cobrar o sinal.', botao: 'Enviar PIX do Sinal', btnVariant: 'primary', bg: '#e0e7ff', color: '#4f46e5' }; statusBadge = { variant: 'warning', text: 'Negociação' }; } 
  else if (lead.status === 'SINAL') { motor = { texto: 'Sinal recebido. Gerar e enviar contrato.', botao: 'Enviar Contrato', btnVariant: 'primary', bg: '#f3e8ff', color: '#9333ea' }; statusBadge = { variant: 'primary', text: 'Sinal Pago' }; } 
  else if (lead.status === 'CONFIRMADO') { motor = { texto: 'Festa confirmada. Confirmar logística de montagem.', botao: 'Confirmar Logística', btnVariant: 'success', bg: '#dcfce7', color: '#16a34a' }; statusBadge = { variant: 'success', text: 'Confirmado' }; } 
  else if (lead.status === 'CANCELADO') { motor = { texto: 'Venda perdida. Tentar resgate futuro.', botao: 'Reativar Lead', btnVariant: 'secondary', bg: '#f1f5f9', color: '#64748b' }; }

  const formatDate = (dateString) => {
    if (!dateString) return 'A Definir';
    const [yyyy, mm, dd] = dateString.split('T')[0].split('-');
    return `${dd}/${mm}/${yyyy}`;
  };

  const getLogIcon = (type) => {
    if (type === 'NOTE') return <MessageSquare size={16} />;
    if (type === 'FILE') return <FileText size={16} />;
    return <Activity size={16} />;
  };

  return (
    <Modal isOpen={true} onClose={onClose} maxWidth="xl" hideHeader>
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
                <button className={styles.editBtn} title="Editar Telefone" onClick={() => setPromptConfig({ title: 'Editar Telefone', defaultValue: lead.telefone, icon: Phone, onConfirm: (novoTel) => { if (novoTel && onUpdateLead) onUpdateLead(lead.lead_id || lead.id, { telefone: novoTel }); setPromptConfig(null); }})}><Pencil size={14} /></button>
              </div>
            </div>

            <div className={styles.headerActions}>
              {lead.status !== 'CANCELADO' && (<Button variant="ghost" color="danger" icon={XOctagon} onClick={() => setShowCancelConfirm(true)}>Cancelar Venda</Button>)}
              <Button variant="primary" size="lg" icon={MessageCircle} onClick={openWhatsApp}>Enviar Mensagem</Button>
            </div>
          </div>

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Tema da Festa</span><div className={styles.infoValue}><Package size={16} color="var(--text-tertiary)" />{lead.tema || 'A Definir'}<button className={styles.editBtn} onClick={() => setPromptConfig({ title: 'Tema da Festa', defaultValue: lead.tema, icon: Package, onConfirm: (val) => { if (val && onUpdateDeal) onUpdateDeal(lead.id, { tema: val }); setPromptConfig(null); }})}><Pencil size={14} /></button></div></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Orçamento Final</span><div className={styles.infoValue}><CircleDollarSign size={16} color="var(--success)" />R$ {lead.valor_total || '0.00'}<button className={styles.editBtn} onClick={() => setPromptConfig({ title: 'Orçamento Final', defaultValue: lead.valor_total, icon: CircleDollarSign, onConfirm: (val) => { if (val && onUpdateDeal) onUpdateDeal(lead.id, { valor_total: val }); setPromptConfig(null); }})}><Pencil size={14} /></button></div></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Data</span><div className={styles.infoValue}><CalendarDays size={16} color="var(--text-tertiary)" />{formatDate(lead.data_festa)}<button className={styles.editBtn} onClick={() => setPromptConfig({ title: 'Data (DD/MM/AAAA)', defaultValue: formatDate(lead.data_festa), icon: CalendarDays, onConfirm: (val) => { if (val && onUpdateDeal) { let dbVal = val; if (val.includes('/')) { const p = val.split('/'); if (p.length === 3) dbVal = `${p[2]}-${p[1]}-${p[0]}`; } onUpdateDeal(lead.id, { data_festa: dbVal }); } setPromptConfig(null); }})}><Pencil size={14} /></button></div></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Horário</span><div className={styles.infoValue}><Clock size={16} color="var(--text-tertiary)" />{lead.horario_festa || 'A Definir'}<button className={styles.editBtn} onClick={() => setPromptConfig({ title: 'Horário da Festa', defaultValue: lead.horario_festa, icon: Clock, onConfirm: (val) => { if (val && onUpdateDeal) onUpdateDeal(lead.id, { horario_festa: val }); setPromptConfig(null); }})}><Pencil size={14} /></button></div></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Local</span><div className={styles.infoValue}><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.endereco || '')}`} target="_blank" rel="noreferrer" title="Abrir no Google Maps" style={{ display: 'flex', alignItems: 'center' }}><MapPin size={16} color="var(--primary)" style={{ cursor: 'pointer' }} /></a><button className={styles.editBtn} onClick={() => setPromptConfig({ title: 'Endereço', defaultValue: lead.endereco, icon: MapPin, onConfirm: (val) => { if (val && onUpdateDeal) onUpdateDeal(lead.id, { endereco: val }); setPromptConfig(null); }})}><Pencil size={14} /></button></div></div>
          </div>
        </div>

        {/* PRÓXIMA AÇÃO */}
        <div className={styles.motorSection}>
          <div className={styles.motorInfo}>
            <div className={styles.motorIconBox} style={{ background: motor.bg, color: motor.color }}><Zap size={24} /></div>
            <div>
              <span className={styles.motorLabel}>Motor de Vendas (Próxima Ação)</span>
              <p className={styles.motorText}>{motor.texto}</p>
            </div>
          </div>
          <Button variant={motor.btnVariant} size="lg" icon={ArrowRightCircle} onClick={handleProximaAcao}>{motor.botao}</Button>
        </div>

        {/* Tabs */}
        <div className={styles.tabsNav}>
          <button className={`${styles.tabBtn} ${activeTab === 'timeline' ? styles.active : ''}`} onClick={() => setActiveTab('timeline')}><History size={18} /> Histórico</button>
          <button className={`${styles.tabBtn} ${activeTab === 'galeria' ? styles.active : ''}`} onClick={() => setActiveTab('galeria')}><ImageIcon size={18} /> Arquivos & Referências</button>
          <button className={`${styles.tabBtn} ${activeTab === 'mensagens' ? styles.active : ''}`} onClick={() => setActiveTab('mensagens')}><MessageSquare size={18} /> Anotações</button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent} style={{ minHeight: '300px' }}>
          
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Spinner size={32} label="Carregando..." />
            </div>
          ) : (
            <>
              {activeTab === 'timeline' && (
                <div className={styles.timelineWrapper}>
                  {timeline.length === 0 ? (
                    <EmptyState icon={History} title="Nenhum histórico" description="As atividades deste orçamento aparecerão aqui." />
                  ) : (
                    <>
                      {timeline.map((item, idx) => (
                        <div key={item.id} className={styles.timelineItem}>
                          <div className={styles.timelineIconCol}>
                            <div className={styles.timelineIconBox} style={{ 
                              color: item.type === 'NOTE' ? 'var(--warning-dark)' : item.type === 'FILE' ? 'var(--primary-dark)' : 'var(--text-secondary)',
                              background: item.type === 'NOTE' ? 'var(--warning-light)' : item.type === 'FILE' ? 'var(--primary-light)' : 'var(--bg-secondary)',
                              borderColor: 'transparent'
                            }}>
                              {getLogIcon(item.type)}
                            </div>
                            {idx < timeline.length - 1 && <div className={styles.timelineLine}></div>}
                          </div>
                          <div className={`${styles.timelineContent} ${idx === timeline.length - 1 ? styles.last : ''}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                              <div className={styles.timelineTitle}>{item.content}</div>
                              <span className={styles.timelineDate}>{item.date.toLocaleString('pt-BR')}</span>
                            </div>
                            <div className={styles.timelineDesc} style={{ marginTop: '0.25rem' }}>
                              {item.badge && <Badge variant="secondary" size="sm" style={{ marginRight: '0.5rem' }}>{item.badge}</Badge>}
                              {item.type === 'NOTE' && <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Escrito por {item.author}</span>}
                              {item.type === 'FILE' && signedFileUrls[item.path] && (
                                <a href={signedFileUrls[item.path]} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', textDecoration: 'none' }}>
                                  <Eye size={14} /> Visualizar
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className={styles.timelineItem}>
                        <div className={styles.timelineIconCol}>
                          <div className={styles.timelineIconBox} style={{ color: 'var(--success-dark)', background: 'var(--success-light)', borderColor: 'transparent' }}>
                            <User size={16} />
                          </div>
                        </div>
                        <div className={`${styles.timelineContent} ${styles.last}`}>
                          <div className={styles.timelineTitle}>Lead Criado</div>
                          <div className={styles.timelineDesc}>{lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : 'Data desconhecida'}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'galeria' && (
                <div className={styles.galleryLayout}>
                  
                  {/* Seção Esquerda: Arquivos Anexados */}
                  <div className={styles.galleryLeft}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Arquivos do Orçamento</h3>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleFileUpload} 
                      />
                      <Button variant="secondary" icon={FilePlus} onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                        {isUploading ? 'Enviando...' : 'Anexar'}
                      </Button>
                    </div>
                    
                    <div className={styles.galleryGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                      {timeline.filter(t => t.type === 'FILE').map(file => (
                        <a key={file.id} href={signedFileUrls[file.path]} target="_blank" rel="noreferrer" className={styles.galleryItem} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', textDecoration: 'none', color: 'var(--text-color)', pointerEvents: signedFileUrls[file.path] ? 'auto' : 'none' }}>
                          {file.original.nome_arquivo.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            signedFileUrls[file.path] ? <img src={signedFileUrls[file.path]} alt={file.original.nome_arquivo} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', marginBottom: '0.5rem' }} /> : <ImageIcon size={32} opacity={0.6} style={{ marginBottom: '0.5rem' }} />
                          ) : (
                            <FileText size={32} opacity={0.6} style={{ marginBottom: '0.5rem' }} />
                          )}
                          <span style={{ fontSize: '0.75rem', textAlign: 'center', wordBreak: 'break-all' }}>{file.original.nome_arquivo}</span>
                          <Badge variant="secondary" style={{ marginTop: '0.5rem', fontSize: '0.65rem' }}>{file.badge}</Badge>
                        </a>
                      ))}
                      {timeline.filter(t => t.type === 'FILE').length === 0 && (
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', gridColumn: '1 / -1' }}>Nenhum arquivo anexado.</p>
                      )}
                    </div>
                  </div>

                  {/* Seção Direita: Inteligência do Tema */}
                  <div className={styles.galleryRight}>
                    
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      Referências do Tema
                      {selectedThemePhotos.length > 0 && (
                        <Button size="sm" variant="success" icon={Send} onClick={sendSelectedPhotosOnWhatsApp}>
                          Enviar ({selectedThemePhotos.length})
                        </Button>
                      )}
                    </h3>
                    
                    {themePhotos.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '2rem' }}>
                        {themePhotos.slice(0, 6).map(foto => (
                          <div key={foto.id} onClick={() => togglePhotoSelection(foto.foto_url)} style={{ position: 'relative', cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: selectedThemePhotos.includes(foto.foto_url) ? '3px solid var(--primary)' : '1px solid var(--border-color)' }}>
                            <img src={foto.foto_url} alt="Tema" style={{ width: '100%', height: '100px', objectFit: 'cover', display: 'block' }} />
                            
                            {/* Botão de Visualizar */}
                            <div 
                              onClick={(e) => { e.stopPropagation(); window.open(foto.foto_url, '_blank'); }}
                              style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '4px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Visualizar Imagem"
                            >
                              <Eye size={14} />
                            </div>

                            {/* Indicador de Seleção */}
                            {selectedThemePhotos.includes(foto.foto_url) && (
                              <div style={{ position: 'absolute', top: 4, right: 4, background: 'var(--primary)', color: 'white', borderRadius: '50%', padding: '2px' }}>
                                <CheckSquare size={14} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '2rem' }}>Nenhuma foto cadastrada para o tema "{lead.tema}".</p>
                    )}

                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Últimos usando "{lead.tema}"</h3>
                    {themeHistory.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {themeHistory.map(th => (
                          <div key={th.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--surface-color)', borderRadius: '6px', fontSize: '0.85rem' }}>
                            <span><strong>{th.leads?.nome}</strong></span>
                            <span style={{ color: 'var(--success)' }}>R$ {th.valor_total}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Nenhum orçamento anterior encontrado para ajudar na precificação.</p>
                    )}
                    
                  </div>
                </div>
              )}

              {activeTab === 'mensagens' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className={styles.messageList}>
                    {timeline.filter(t => t.type === 'NOTE').map(msg => (
                      <div key={msg.id} className={styles.messageBubble} style={{ 
                        borderLeft: `4px solid ${msg.badge === 'URGENTE' || msg.badge === 'IMPORTANTE' ? 'var(--danger)' : 'var(--primary)'}`,
                        background: msg.badge === 'URGENTE' ? 'var(--danger-light)' : 'var(--surface-color)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span className={styles.messageDate}><strong>{msg.author}</strong> - {msg.date.toLocaleString('pt-BR')}</span>
                          <Badge variant="secondary" size="sm">{msg.badge}</Badge>
                        </div>
                        <p className={styles.messageText}>{msg.content}</p>
                      </div>
                    ))}
                    {timeline.filter(t => t.type === 'NOTE').length === 0 && (
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>Nenhuma anotação registrada ainda.</p>
                    )}
                  </div>
                  
                  <div className={styles.messageInputArea}>
                    <div className={styles.messageInputRow}>
                      <select 
                        value={novaNotaTipo}
                        onChange={(e) => setNovaNotaTipo(e.target.value)}
                        className={styles.messageSelect}
                      >
                        <option value="NORMAL">Normal</option>
                        <option value="IMPORTANTE">Importante</option>
                        <option value="URGENTE">Urgente</option>
                        <option value="INTERNO">Aviso Interno</option>
                        <option value="CLIENTE">Feedback Cliente</option>
                      </select>
                      <input 
                        type="text" 
                        value={novaMensagem} 
                        onChange={(e) => setNovaMensagem(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleAddMensagem()} 
                        placeholder="Escreva uma anotação privada..." 
                        className={styles.messageInput} 
                      />
                    </div>
                    <Button variant="primary" icon={Send} onClick={handleAddMensagem} className={styles.messageSubmitBtn}>Salvar Nota</Button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {promptConfig && (
        <PromptDialog isOpen={true} title={promptConfig.title} message={promptConfig.message} defaultValue={promptConfig.defaultValue} icon={promptConfig.icon} onConfirm={promptConfig.onConfirm} onCancel={() => setPromptConfig(null)} />
      )}

      {showCancelConfirm && (
        <ConfirmDialog isOpen={true} title="Cancelar Venda" message={`Tem certeza que deseja cancelar a venda para ${lead.nome}? Essa ação mudará o status para Cancelado.`} confirmText="Sim, Cancelar Venda" onConfirm={() => { if (onAdvanceStatus) onAdvanceStatus(lead.id, 'CANCELADO'); setShowCancelConfirm(false); }} onCancel={() => setShowCancelConfirm(false)} />
      )}
    </Modal>
  );
}
