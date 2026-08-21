import React, { useState, useRef, useEffect } from 'react';
import styles from './BaseClientes.module.css';

// UI
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import Card from './ui/Card';
import EmptyState from './ui/EmptyState';
import { toast } from 'react-hot-toast';
import { useCompany } from '../hooks/useCompany';

// Icons
import { 
  Plus, 
  Upload, 
  Search,
  Users,
  MoreVertical,
  FileText,
  MessageCircle
} from 'lucide-react';

export default function BaseClientes({ leads, onCadastrarManual, onGerarOrcamentoPara, onOpenImportModal }) {
  const { settings } = useCompany();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const calcularTempoEspera = (created_at) => {
    if (!created_at) return 'Hoje';
    const diff = new Date() - new Date(created_at);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Menos de 1h';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const openWhatsApp = (e, telefone, nome) => {
    e.stopPropagation();
    if (settings?.companies?.is_demo) { toast.error('Ações externas estão desativadas no ambiente demo.'); return; }
    if (!telefone) { toast.error('Telefone não informado'); return; }
    let num = telefone.replace(/\D/g, '');
    if (!num) { toast.error("Telefone inválido"); return; }
    if (num.length <= 11) num = '55' + num;
    const msg = `Olá ${nome}, tudo bem? Aqui é da FestaFlow.`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name.substring(0, 2)).toUpperCase();
  };

  const filteredLeads = leads.filter(lead => {
    if (searchTerm && !lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) && !lead.telefone.includes(searchTerm)) {
      return false;
    }
    return true;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <span className={styles.eyebrow}>RELACIONAMENTO</span>
          <div className={styles.titleLine}>
            <h2 className={styles.title}>Clientes</h2>
            <span className={styles.badge}>{leads.length} contatos</span>
          </div>
          <p className={styles.subtitle}>Sua agenda de conversas, pronta para virar festa.</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={() => {
            if (onOpenImportModal) onOpenImportModal();
          }}>
            Importar
          </Button>
          <Button variant="primary" icon={Plus} onClick={onCadastrarManual}>
            Novo Cliente
          </Button>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <Search size={20} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Buscar nome ou telefone"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Tabela Desktop */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Contato</th>
              <th>Telefone</th>
              <th>Origem</th>
              <th>Adicionado há</th>
              <th style={{ textAlign: 'right', width: '80px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map(lead => (
              <tr 
                key={lead.id} 
                className={styles.tableRow}
              >
                <td className={styles.clientCell}>
                  <div className={styles.avatar}>
                    {getInitials(lead.nome)}
                  </div>
                  <div className={styles.clientInfo}>
                    <strong className={styles.clientName}>{lead.nome}</strong>
                    <span className={styles.clientSub}>Cliente há {calcularTempoEspera(lead.created_at)}</span>
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.phoneLink}
                    onClick={(event) => openWhatsApp(event, lead.telefone, lead.nome)}
                    title={`Enviar WhatsApp para ${lead.nome}`}
                  >
                    {lead.telefone}
                  </button>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{lead.origem || '-'}</td>
                <td>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {calcularTempoEspera(lead.created_at)}
                  </span>
                </td>
                <td style={{ textAlign: 'right', position: 'relative' }}>
                  <IconButton 
                    icon={MoreVertical}
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === lead.id ? null : lead.id);
                    }}
                  />
                  {activeMenuId === lead.id && (
                    <>
                      <div className={styles.actionMenuOverlay} onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} />
                      <div className={styles.actionMenu} ref={menuRef}>
                        <button className={`${styles.actionMenuItem} ${styles.primaryAction || ''}`} style={{ color: 'var(--primary)' }} onClick={() => { setActiveMenuId(null); onGerarOrcamentoPara(lead); }}><FileText size={18}/> Gerar orçamento</button>
                        <button className={`${styles.actionMenuItem} ${styles.successAction || ''}`} style={{ color: 'var(--success)' }} onClick={(e) => { setActiveMenuId(null); openWhatsApp(e, lead.telefone, lead.nome); }}><MessageCircle size={18}/> Enviar WhatsApp</button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredLeads.length === 0 && (
          <div style={{ padding: '3rem' }}>
            <EmptyState 
              icon={Users}
              title={leads.length === 0 ? "Base vazia" : "Nenhum contato encontrado"}
              description={leads.length === 0 
                ? "Sua base de clientes está vazia. Adicione ou importe clientes para começar." 
                : "Não encontramos nenhum registro na sua busca."}
              action={leads.length === 0 ? {
                label: "Importar Contatos",
                icon: Upload,
                onClick: onOpenImportModal
              } : null}
            />
          </div>
        )}
      </div>

      {/* Mobile List (Cards) */}
      <div className={styles.mobileList}>
        {filteredLeads.map(lead => (
          <Card 
            key={lead.id} 
            padding="sm" 
            style={{ borderLeft: '1px solid var(--border)' }}
          >
            <div className={styles.mobileCardContent}>
              <div className={styles.mobileCardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className={styles.avatar} style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                    {getInitials(lead.nome)}
                  </div>
                  <h3 className={styles.mobileClientName}>{lead.nome}</h3>
                </div>
                <IconButton 
                  icon={MoreVertical}
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(activeMenuId === lead.id ? null : lead.id);
                  }}
                />
                {activeMenuId === lead.id && (
                  <>
                    <div className={styles.actionMenuOverlay} onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} />
                    <div className={styles.actionMenu}>
                      <button className={`${styles.actionMenuItem} ${styles.primaryAction || ''}`} style={{ color: 'var(--primary)' }} onClick={() => { setActiveMenuId(null); onGerarOrcamentoPara(lead); }}><FileText size={18}/> Gerar orçamento</button>
                      <button className={`${styles.actionMenuItem} ${styles.successAction || ''}`} style={{ color: 'var(--success)' }} onClick={(e) => { setActiveMenuId(null); openWhatsApp(e, lead.telefone, lead.nome); }}><MessageCircle size={18}/> Enviar WhatsApp</button>
                    </div>
                  </>
                )}
              </div>
              <div className={styles.mobileCardBody}>
                <button
                  type="button"
                  className={styles.phoneLink}
                  onClick={(event) => openWhatsApp(event, lead.telefone, lead.nome)}
                  title={`Enviar WhatsApp para ${lead.nome}`}
                >
                  {lead.telefone}
                </button>
              </div>
              <div className={styles.mobileCardFooter}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Origem: {lead.origem || '-'}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {calcularTempoEspera(lead.created_at)}
                </span>
              </div>
            </div>
          </Card>
        ))}

        {filteredLeads.length === 0 && (
          <EmptyState 
            icon={Users}
            title={leads.length === 0 ? "Você ainda não possui clientes" : "Nenhum cliente encontrado"}
            description={leads.length === 0 
              ? "Que tal adicionar o seu primeiro orçamento agora?" 
              : "Tente mudar os filtros ou a busca."}
            action={leads.length === 0 ? {
              label: "Criar orçamento",
              icon: Plus,
              onClick: onCadastrarManual
            } : null}
          />
        )}
      </div>
    </div>
  );
}
