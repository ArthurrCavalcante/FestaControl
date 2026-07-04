import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Login from './components/Login';
import ConfirmEventModal from './components/ConfirmEventModal';
import { supabase } from './supabaseClient';
import { archiveEvent, logActivity } from './services/dbService';
import styles from './App.module.css';
import Spinner from './components/ui/Spinner';
import ImportarClientesModal from './components/ImportarClientesModal';
import ErrorState from './components/ui/ErrorState';
import Button from './components/ui/Button';
import IconButton from './components/ui/IconButton';
import Configuracoes from './components/Configuracoes';
import Perfil from './components/Perfil';
import Dashboard from './components/Dashboard';
import { PartyPopper, Calendar, MessageSquare, BarChart3, Settings, Bell, Search, Plus, ListTodo, Package, User, LogOut, Users, LayoutDashboard, Camera, Menu, ChevronLeft } from 'lucide-react';
import { useCompany } from './hooks/useCompany';
import Onboarding from './components/Onboarding';

const KanbanBoard = lazy(() => import('./components/KanbanBoard'));
const Catalogo = lazy(() => import('./components/Catalogo'));
const Acervo = lazy(() => import('./components/Acervo'));
const CaixaEntrada = lazy(() => import('./components/CaixaEntrada'));
const GeradorOrcamento = lazy(() => import('./components/GeradorOrcamento'));
const FichaCliente = lazy(() => import('./components/FichaCliente'));
const BaseClientes = lazy(() => import('./components/BaseClientes'));
const Agenda = lazy(() => import('./components/Agenda'));

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading auth
  const { settings, needsOnboarding, refreshCompany, loading: companyLoading } = useCompany();
  const [acervo, setAcervo] = useState([]);
  const [requirePasswordReset, setRequirePasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [eventPrompt, setEventPrompt] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showGerador, setShowGerador] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [prefilledLeadForGerador, setPrefilledLeadForGerador] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [leads, setLeads] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [isFetchingDeals, setIsFetchingDeals] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const requestEventData = (defaultData, defaultHora) => {
    return new Promise((resolve) => {
      setEventPrompt({ resolve, defaultData, defaultHora });
    });
  };

  const [festasProximos7Dias, setFestasProximos7Dias] = useState(0);

  const fetchDeals = async () => {
    setIsFetchingDeals(true);
    setFetchError(null);
    const { data, error } = await supabase.from('deals').select('*, leads(*), events(*)');
    
    if (error) {
      console.error('Erro ao buscar dados:', error);
      setFetchError(error.message);
      setIsFetchingDeals(false);
      return;
    }
    
    if (data) {
      const mapped = data.map(deal => ({
        id: deal.id,
        company_id: deal.company_id,
        lead_id: deal.leads.id,
        nome: deal.leads.nome,
        telefone: deal.leads.telefone,
        origem: deal.leads.origem,
        interesse: deal.tema || 'Kit Personalizado',
        tema: deal.tema,
        tema_id: deal.tema_id,
        status: deal.status_funil,
        modalidade: deal.modalidade,
        created_at: deal.created_at || deal.leads.created_at,
        confirmado_em: deal.confirmado_em,
        data_festa: deal.data_festa || deal.events?.[0]?.data_evento,
        horario_festa: deal.horario_festa || deal.events?.[0]?.horario,
        endereco: deal.endereco || deal.events?.[0]?.endereco,
        lembrete_enviado: deal.events?.[0]?.lembrete_enviado,
        valor_total: deal.valor_total || 0,
        itens: deal.itens_selecionados
      }));
      setLeads(mapped);

      // Calcular festas próximos 7 dias
      const today = new Date();
      today.setHours(0,0,0,0);
      const upcoming = mapped.filter(l => {
        if (l.status !== 'CONFIRMADO' || !l.data_festa || l.lembrete_enviado) return false;
        const partyDate = new Date(l.data_festa + 'T00:00:00');
        const diff = Math.ceil((partyDate - today) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 7;
      });
      setFestasProximos7Dias(upcoming.length);
    }
    setIsFetchingDeals(false);
  };

  const fetchAcervo = async () => {
    try {
      const { data, error } = await supabase.from('acervo').select('*').eq('ativo', true);
      if (error) {
        console.error('Erro ao buscar acervo:', error);
        return;
      }
      if (data) setAcervo(data);
    } catch (err) {
      console.error('Exceção ao buscar acervo:', err);
    }
  };

  const fetchClientes = async () => {
    setIsFetchingClientes(true);
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setClientes(data);
    }
    setIsFetchingClientes(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') {
        setRequirePasswordReset(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchDeals();
      fetchClientes();
      fetchAcervo();
    }
  }, [session]);

  useEffect(() => {
    const handleAppRefresh = () => {
      fetchDeals();
      fetchClientes();
      fetchAcervo();
    };
    window.addEventListener('app_refresh', handleAppRefresh);
    return () => window.removeEventListener('app_refresh', handleAppRefresh);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleAddLead = () => {
    fetchDeals();
    fetchClientes();
  };

  const syncEventWithDeal = async (dealId, lead, targetStatus) => {
    if (targetStatus === 'CONFIRMADO' && lead?.status !== 'CONFIRMADO') {
       const eventResult = await requestEventData(lead?.data_festa, lead?.horario_festa);
       if (!eventResult) return false;

       const { data: existingEvent } = await supabase.from('events').select('id').eq('deal_id', dealId).single();
       if (existingEvent) {
          const { error: evtError } = await supabase.from('events').update({
            data_evento: eventResult.dataFestaDb,
            horario: eventResult.horarioFesta,
            status_operacional: 'AGUARDANDO',
            lembrete_enviado: false
          }).eq('deal_id', dealId);
          if (evtError) console.error('Erro ao atualizar evento:', evtError);
       } else {
          const { error: evtError } = await supabase.from('events').insert({
             deal_id: dealId,
             data_evento: eventResult.dataFestaDb,
             horario: eventResult.horarioFesta,
             endereco: lead?.endereco || 'A Combinar',
             status_operacional: 'AGUARDANDO',
             lembrete_enviado: false
          });
          if (evtError) console.error('Erro ao criar evento:', evtError);
       }
       // Atualiza também a data na tabela deals para manter consistência
       await supabase.from('deals').update({ 
         confirmado_em: new Date().toISOString(),
         data_festa: eventResult.dataFestaDb
       }).eq('id', dealId);
    } else if (lead?.status === 'CONFIRMADO' && targetStatus !== 'CONFIRMADO') {
       await archiveEvent(dealId);
       await supabase.from('deals').update({ confirmado_em: null }).eq('id', dealId);
    }
    return true;
  };

  const handleAdvanceStatus = async (dealId, currentOrTargetStatus) => {
    const lead = leads.find(l => l.id === dealId);
    let nextStatus = currentOrTargetStatus;
    // Auto-advance if a current stage is passed
    if (currentOrTargetStatus === 'NOVOS') nextStatus = 'NEGOCIACAO';
    else if (currentOrTargetStatus === 'NEGOCIACAO') nextStatus = 'SINAL';
    else if (currentOrTargetStatus === 'SINAL') nextStatus = 'CONFIRMADO';
    
    // Se não mudou nada e não for cancelado
    if (nextStatus === lead?.status && currentOrTargetStatus !== 'CANCELADO') return; 

    const { error } = await supabase.from('deals').update({ status_funil: nextStatus }).eq('id', dealId);
    if (!error) {
      const success = await syncEventWithDeal(dealId, lead, nextStatus);
      if (!success) {
         await supabase.from('deals').update({ status_funil: lead.status }).eq('id', dealId);
         fetchDeals();
         return;
      }
      
      fetchDeals();
      setSelectedLead(null);
      toast.success('Status atualizado com sucesso!');
      logActivity('STATUS_CHANGED', 'deal', dealId, { from: lead?.status, to: nextStatus });
    } else {
      console.error(error);
      toast.error('Erro ao atualizar status.');
    }
  };

  const handleUpdateDeal = async (dealId, updates) => {
    // Separa os campos que pertencem a tabela events
    const eventUpdates = {};
    if ('data_festa' in updates) { 
      eventUpdates.data_evento = updates.data_festa; 
      eventUpdates.lembrete_enviado = false; // reset lembrete
    }
    if ('horario_festa' in updates) { eventUpdates.horario = updates.horario_festa; }
    if ('endereco' in updates) { eventUpdates.endereco = updates.endereco; }

    let success = true;

    // Atualiza eventos se houver
    if (Object.keys(eventUpdates).length > 0) {
      // Primeiro verifica se o evento existe
      const { data: existingEvent } = await supabase.from('events').select('id').eq('deal_id', dealId).single();
      
      if (existingEvent) {
        const { error } = await supabase.from('events').update(eventUpdates).eq('deal_id', dealId);
        if (error) { console.error("Erro ao atualizar evento:", error); success = false; }
      } else {
        // Se não existe, cria um evento provisório (assim a data fica salva!)
        // Na hora de confirmar o deal (handleMoveLead), ele já vai existir e a agenda vai assumir.
        const { error } = await supabase.from('events').insert({
          deal_id: dealId,
          status_operacional: 'RASCUNHO',
          data_evento: eventUpdates.data_evento || new Date().toISOString().split('T')[0],
          horario: eventUpdates.horario || 'A definir',
          endereco: eventUpdates.endereco || 'A definir'
        });
        if (error) { console.error("Erro ao criar evento provisório:", error); success = false; }
      }
    }

    // Atualiza deals se sobrar algo (ex: valor_total, modalidade, tema)
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('deals').update(updates).eq('id', dealId);
      if (error) { console.error("Erro ao atualizar deal:", error); success = false; }
    }

    if (success) {
      fetchDeals();
      fetchClientes(); // Caso seja algo que a lista precise
      setSelectedLead(prev => ({ ...prev, ...updates, ...eventUpdates }));
      toast.success('Orçamento atualizado!');
      logActivity('UPDATED', 'deal', dealId, { updates });
    } else {
      toast.error('Ocorreu um erro ao atualizar os dados.');
    }
  };

  const handleUpdateLead = async (leadId, updates) => {
    const { error } = await supabase.from('leads').update(updates).eq('id', leadId);
    if (!error) {
      fetchDeals();
      fetchClientes();
      setSelectedLead(prev => ({ ...prev, ...updates }));
      toast.success('Cliente atualizado!');
      logActivity('UPDATED', 'lead', leadId, { updates });
    } else {
      console.error("Erro ao atualizar lead:", error);
      toast.error('Erro ao atualizar cliente.');
    }
  };

  const handleMoveLead = async (dealId, targetStatus) => {
    const lead = leads.find(l => l.id === dealId);
    if (!lead || lead.status === targetStatus) return;

    const { error } = await supabase.from('deals').update({ status_funil: targetStatus }).eq('id', dealId);
    if (!error) {
      const success = await syncEventWithDeal(dealId, lead, targetStatus);
      if (!success) {
         await supabase.from('deals').update({ status_funil: lead.status }).eq('id', dealId);
         fetchDeals();
         return;
      }
      
      fetchDeals();
      toast.success('Card movido com sucesso!');
      logActivity('PIPELINE_MOVED', 'deal', dealId, { from: lead.status, to: targetStatus });
    } else {
      console.error(error);
      toast.error('Erro ao mover card.');
    }
  };

  if (session === undefined || companyLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={32} label="Carregando..." />
      </div>
    );
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setIsResetting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error('Erro ao atualizar senha: ' + error.message);
    } else {
      toast.success('Senha atualizada com sucesso!');
      setRequirePasswordReset(false);
    }
    setIsResetting(false);
  };

  if (!session) {
    return <Login />;
  }

  if (needsOnboarding) {
    return (
      <Onboarding 
        onComplete={() => {
          refreshCompany();
          fetchDeals();
          fetchClientes();
          fetchAcervo();
        }} 
      />
    );
  }

  if (requirePasswordReset) {
    return (
      <div className={styles.appContainer} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
          <h2>Redefinir Senha</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Digite sua nova senha abaixo.</p>
          <form onSubmit={handlePasswordReset}>
            <input 
              type="password" 
              required 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Nova senha"
              style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
            />
            <button type="submit" disabled={isResetting} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
              {isResetting ? 'Atualizando...' : 'Salvar Nova Senha'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (isFetchingDeals && leads.length === 0) {
      return (
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={32} label="Carregando informações..." />
        </div>
      );
    }

    if (fetchError) {
      return (
        <ErrorState 
          title="Erro de Conexão"
          description="Não foi possível carregar os dados. Verifique sua conexão e tente novamente."
          onRetry={fetchDeals}
        />
      );
    }

    const renderTab = () => {
      if (activeTab === 'dashboard') return <Dashboard leads={leads} onNavigate={setActiveTab} />;
      if (activeTab === 'pipeline') return <KanbanBoard leads={leads} onLeadSelect={setSelectedLead} onMoveLead={handleMoveLead} acervo={acervo} />;
      if (activeTab === 'acervo') return <Acervo />;
      if (activeTab === 'leads') return <BaseClientes leads={clientes} onCadastrarManual={() => setShowGerador(true)} onGerarOrcamentoPara={(lead) => setPrefilledLeadForGerador(lead)} onRefresh={fetchClientes} onOpenImportModal={() => {
        setShowImportModal(true);
      }} />;
      if (activeTab === 'catalogo') return <Catalogo />;
      if (activeTab === 'inbox') return <CaixaEntrada />;
      if (activeTab === 'agenda') return <Agenda 
          events={leads.filter(l => l.status === 'CONFIRMADO' && l.data_festa)} 
          acervo={acervo}
          onUpdateEvent={async () => {
            await fetchDeals();
          }}
        />;
      if (activeTab === 'configuracoes') return <Configuracoes />;
      if (activeTab === 'perfil') return <Perfil />;
      return null;
    };

    return (
      <Suspense fallback={
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={32} label="Carregando módulo..." />
        </div>
      }>
        {renderTab()}
      </Suspense>
    );
  };

  return (
    <div className={styles.appContainer}>
      <Toaster 
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--surface-hover)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: '0.95rem'
          }
        }}
      />
      <Suspense fallback={null}>
        {showGerador && (
        <GeradorOrcamento 
          onClose={() => setShowGerador(false)} 
          onAddLead={handleAddLead} 
        />
      )}

      {prefilledLeadForGerador && (
        <GeradorOrcamento 
          onClose={() => setPrefilledLeadForGerador(null)} 
          onAddLead={() => { setPrefilledLeadForGerador(null); handleAddLead(); }} 
          prefilledLead={prefilledLeadForGerador}
        />
      )}


      {showImportModal && (
        <ImportarClientesModal 
          onClose={() => setShowImportModal(false)} 
          onSuccess={() => { setShowImportModal(false); fetchClientes(); }} 
        />
      )}

      {selectedLead && (
          <FichaCliente 
            lead={selectedLead} 
            onClose={() => setSelectedLead(null)}
            onAdvanceStatus={handleAdvanceStatus}
            onUpdateLead={handleUpdateLead}
            onUpdateDeal={handleUpdateDeal}
          />
        )}
      </Suspense>
      
      {eventPrompt && (
        <ConfirmEventModal
          initialData={eventPrompt.defaultData}
          initialHora={eventPrompt.defaultHora}
          onConfirm={(data) => {
            let dataFestaDb = data.dataFesta;
            if (data.dataFesta.includes('/')) {
              const parts = data.dataFesta.split('/');
              if (parts.length === 3) dataFestaDb = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else if (data.dataFesta.includes('-')) {
              dataFestaDb = data.dataFesta;
            }
            eventPrompt.resolve({ dataFestaDb, horarioFesta: data.horarioFesta });
            setEventPrompt(null);
          }}
          onCancel={() => {
            eventPrompt.resolve(null);
            setEventPrompt(null);
          }}
        />
      )}

      {/* Desktop / Mobile Sidebar */}
      <div 
        className={`${styles.mobileOverlay} ${mobileMenuOpen ? styles.open : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />
      <aside className={`${styles.sidebar} ${mobileMenuOpen ? styles.mobileOpen : ''}`}>
        <div className={styles.brand}>
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className={styles.brandLogo} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
          ) : (
            <PartyPopper size={28} />
          )}
          <h2 className={styles.brandText}>{settings?.companies?.nome || 'FestaFlow'}</h2>
        </div>
        
        <div className={styles.newActionContainer}>
          <Button 
            icon={Plus} 
            size="lg" 
            style={{ width: '100%' }}
            onClick={() => setShowGerador(true)}
          >
            <span className={styles.navLabel}>Novo Orçamento</span>
          </Button>
        </div>

        <nav className={styles.nav}>
            <button 
              className={`${styles.navItem} ${activeTab === 'dashboard' ? styles.active : ''}`}
              onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
              title="Visão Geral"
            >
              <BarChart3 size={20} /> <span className={styles.navLabel}>Visão Geral</span>
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'pipeline' ? styles.active : ''}`}
              onClick={() => { setActiveTab('pipeline'); setMobileMenuOpen(false); }}
              title="Orçamentos (CRM)"
            >
              <LayoutDashboard size={20} /> <span className={styles.navLabel}>Orçamentos (CRM)</span>
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'leads' ? styles.active : ''}`}
              onClick={() => setActiveTab('leads')}
              title="Base de Clientes"
            >
              <Users size={20} /> <span className={styles.navLabel}>Base de Clientes</span>
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'agenda' ? styles.active : ''}`}
              onClick={() => setActiveTab('agenda')}
              title="Agenda"
            >
              <Calendar size={20} /> <span className={styles.navLabel}>Agenda</span>
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'inbox' ? styles.active : ''}`}
              onClick={() => setActiveTab('inbox')}
              title="Avisos"
            >
              <Bell size={20} /> <span className={styles.navLabel}>Avisos</span>
              {festasProximos7Dias > 0 ? <span className={styles.sidebarBadge}>{festasProximos7Dias}</span> : null}
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'acervo' ? styles.active : ''}`}
              onClick={() => setActiveTab('acervo')}
              title="Inventário (Acervo)"
            >
              <Package size={20} /> <span className={styles.navLabel}>Inventário (Acervo)</span>
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'catalogo' ? styles.active : ''}`}
              onClick={() => setActiveTab('catalogo')}
              title="Galeria de Temas"
            >
              <Camera size={20} /> <span className={styles.navLabel}>Galeria de Temas</span>
            </button>
        </nav>
        
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <button 
            className={`${styles.navItem} ${activeTab === 'perfil' ? styles.active : ''}`}
            onClick={() => { setActiveTab('perfil'); setMobileMenuOpen(false); }}
            title="Meu Perfil"
          >
            <User size={20} /> <span className={styles.navLabel}>Meu Perfil</span>
          </button>
          <button 
            className={`${styles.navItem} ${activeTab === 'configuracoes' ? styles.active : ''}`}
            onClick={() => { setActiveTab('configuracoes'); setMobileMenuOpen(false); }}
            title="Configurações"
          >
            <Settings size={20} /> <span className={styles.navLabel}>Configurações</span>
          </button>
          <button 
            className={styles.navItem}
            onClick={async () => {
              await supabase.auth.signOut();
            }}
            style={{ color: 'var(--danger)' }}
            title="Sair"
          >
            <LogOut size={20} /> <span className={styles.navLabel}>Sair</span>
          </button>
        </div>
      </aside>
      
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            {activeTab !== 'dashboard' ? (
              <button 
                onClick={() => setActiveTab('dashboard')}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  display: 'flex', 
                  alignItems: 'center', 
                  cursor: 'pointer',
                  color: 'var(--primary)',
                  padding: '0.5rem 0.5rem 0.5rem 0',
                  marginLeft: '-0.5rem',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  flexShrink: 0
                }}
              >
                <ChevronLeft size={28} strokeWidth={2.5} style={{ marginRight: '-4px' }} />
                Menu
              </button>
            ) : null}
            
            <h1 
              className={styles.headerTitle} 
              style={{ 
                fontSize: activeTab === 'dashboard' ? '1.35rem' : '1.15rem',
                marginLeft: activeTab !== 'dashboard' ? '0.5rem' : '0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {activeTab === 'dashboard' ? (settings?.companies?.nome || 'FestaFlow') : 
               activeTab === 'pipeline' ? 'Pipeline' : 
               activeTab === 'leads' ? 'Clientes' :
               activeTab === 'agenda' ? 'Agenda' :
               activeTab === 'inbox' ? 'Avisos' :
               activeTab === 'acervo' ? 'Acervo' :
               activeTab === 'catalogo' ? 'Galeria' :
               activeTab === 'configuracoes' ? 'Configurar' :
               activeTab === 'perfil' ? 'Perfil' :
               'FestaFlow'}
            </h1>
          </div>
          <div className={styles.userProfile}>
            <div 
              className={styles.avatar} 
              onClick={() => setActiveTab('perfil')}
              style={{ cursor: 'pointer' }}
              title="Ir para o Perfil"
            >
              {session?.user?.email?.substring(0, 2).toUpperCase() || 'U'}
            </div>
            <IconButton 
              icon={LogOut} 
              variant="ghost" 
              color="danger" 
              onClick={handleLogout} 
              title="Sair da conta" 
            />
          </div>
        </header>
        <div className={styles.pageContent}>
          {renderContent()}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={styles.bottomNav}>
        <button className={`${styles.bottomNavItem} ${activeTab === 'agenda' ? styles.active : ''}`} onClick={() => setActiveTab('agenda')}>
          <Calendar size={22} strokeWidth={activeTab === 'agenda' ? 2.5 : 2} />
          Agenda
        </button>
        <button className={`${styles.bottomNavItem} ${activeTab === 'pipeline' ? styles.active : ''}`} onClick={() => setActiveTab('pipeline')}>
          <BarChart3 size={22} strokeWidth={activeTab === 'pipeline' ? 2.5 : 2} />
          Pipeline
        </button>
        
        <div className={styles.fabWrapper}>
          <button className={styles.fab} onClick={() => setShowGerador(true)}>
            <Plus size={28} />
          </button>
        </div>

        <button className={`${styles.bottomNavItem} ${activeTab === 'inbox' ? styles.active : ''}`} onClick={() => setActiveTab('inbox')}>
          <div className={styles.bottomNavIconWrapper}>
            <Bell size={22} strokeWidth={activeTab === 'inbox' ? 2.5 : 2} />
            {festasProximos7Dias > 0 ? <span className={styles.bottomNavBadge}>{festasProximos7Dias}</span> : null}
          </div>
          Avisos
        </button>
        
        <button className={`${styles.bottomNavItem} ${mobileMenuOpen ? styles.active : ''}`} onClick={() => setMobileMenuOpen(true)}>
          <Menu size={22} strokeWidth={mobileMenuOpen ? 2.5 : 2} />
          Menu
        </button>
      </nav>
    </div>
  );
}
