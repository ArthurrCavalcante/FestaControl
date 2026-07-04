import React, { useState } from 'react';
import styles from './BaseClientes.module.css';

// UI
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import Badge from './ui/Badge';
import Card from './ui/Card';
import EmptyState from './ui/EmptyState';
import { toast } from 'react-hot-toast';

// Icons
import { 
  Plus, 
  Upload, 
  Flame, 
  Inbox, 
  Wallet, 
  Clock, 
  CheckCircle2, 
  Search,
  MessageCircle,
  Users
} from 'lucide-react';

const WhatsappIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

export default function BaseClientes({ leads, onCadastrarManual, onGerarOrcamentoPara, onRefresh, onOpenImportModal }) {
  const [searchTerm, setSearchTerm] = useState('');

  const calcularTempoEspera = (created_at) => {
    if (!created_at) return 'Hoje';
    const diff = new Date() - new Date(created_at);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Menos de 1h';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const calcularUrgencia = (created_at) => {
    if (!created_at) return null;
    const diff = new Date() - new Date(created_at);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 48) return { label: 'Esfriando (>48h)', level: 'high' };
    if (hours > 24) return { label: 'Responder Agora (>24h)', level: 'medium' };
    return null;
  };

  const openWhatsApp = (e, telefone, nome) => {
    e.stopPropagation();
    let num = telefone.replace(/\D/g, '');
    if (!num) { toast.error("Telefone inválido"); return; }
    if (num.length <= 11) num = '55' + num;
    const msg = `Olá ${nome}, tudo bem? Aqui é da FestaFlow.`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Lógica de Contatos (Leads puros)
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
          <h2 className={styles.title}>Agenda de Contatos</h2>
          <span className={styles.badge}>{leads.length} contatos</span>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={() => {
            if (onOpenImportModal) onOpenImportModal();
          }}>
            Importar
          </Button>
          <Button variant="primary" icon={Plus} onClick={onCadastrarManual}>
            Novo Contato
          </Button>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <Search size={20} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou telefone..." 
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
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map(lead => (
              <tr 
                key={lead.id} 
                className={styles.tableRow}
              >
                <td className={styles.clientCell}>
                  <div>
                    <strong className={styles.clientName}>{lead.nome}</strong>
                  </div>
                </td>
                <td>
                  <div className={styles.contactCell}>
                    {lead.telefone}
                    <IconButton 
                      icon={WhatsappIcon}
                      variant="ghost"
                      color="success"
                      onClick={(e) => openWhatsApp(e, lead.telefone, lead.nome)}
                      title="Chamar no WhatsApp"
                    />
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{lead.origem || '-'}</td>
                <td>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {calcularTempoEspera(lead.created_at)}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); onGerarOrcamentoPara(lead); }}>
                    Gerar Orçamento
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredLeads.length === 0 && (
          <div style={{ padding: '3rem' }}>
            <EmptyState 
              icon={Users}
              title={leads.length === 0 ? "Agenda vazia" : "Nenhum contato encontrado"}
              description={leads.length === 0 
                ? "Sua base de contatos está vazia. Adicione ou importe clientes para começar." 
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
                <div>
                  <h3 className={styles.mobileClientName}>{lead.nome}</h3>
                </div>
                <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); onGerarOrcamentoPara(lead); }}>
                  Orçar
                </Button>
              </div>
              <div className={styles.mobileCardBody}>
                <div className={styles.contactCell}>
                  {lead.telefone}
                  <IconButton 
                    icon={WhatsappIcon}
                    variant="ghost"
                    color="success"
                    onClick={(e) => openWhatsApp(e, lead.telefone, lead.nome)}
                  />
                </div>
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
