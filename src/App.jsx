import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import ConfirmEventModal from './components/ConfirmEventModal';
import { supabase } from './supabaseClient';
import { archiveEvent, logActivity } from './services/dbService';
import styles from './App.module.css';
import Spinner from './components/ui/Spinner';
import ImportarClientesModal from './components/ImportarClientesModal';
import ErrorState from './components/ui/ErrorState';
import Button from './components/ui/Button';
import Configuracoes from './components/Configuracoes';
import Perfil from './components/Perfil';
import Dashboard from './components/Dashboard';
import { Calendar, BarChart3, Settings, Bell, Plus, ClipboardList, Package, User, LogOut, Users, LayoutDashboard, Camera, Menu, ChevronLeft, Inbox, AlertTriangle, XCircle, FileText, UserRoundCog, ShieldCheck } from 'lucide-react';

import { useCompany } from './hooks/useCompany';
import Onboarding from './components/Onboarding';
import { trackProductEvent } from './services/productAnalytics';

const KanbanBoard = lazy(() => import('./components/KanbanBoard'));
const Catalogo = lazy(() => import('./components/Catalogo'));
const Acervo = lazy(() => import('./components/Acervo'));
const CaixaEntrada = lazy(() => import('./components/CaixaEntrada'));
const GeradorOrcamento = lazy(() => import('./components/GeradorOrcamento'));
const FichaCliente = lazy(() => import('./components/FichaCliente'));
const BaseClientes = lazy(() => import('./components/BaseClientes'));
const Agenda = lazy(() => import('./components/Agenda'));
const OperacaoEventos = lazy(() => import('./components/OperacaoEventos'));
const MobileHub = lazy(() => import('./components/MobileHub'));
const Propostas = lazy(() => import('./components/Propostas'));
const TeamSubscription = lazy(() => import('./components/TeamSubscription'));
const PilotAdmin = lazy(() => import('./components/PilotAdmin'));

const pageTitles = {
  dashboard: 'Visão geral',
  pipeline: 'Orçamentos',
  leads: 'Clientes',
  agenda: 'Agenda',
  operacao: 'Operação',
  inbox: 'Avisos',
  acervo: 'Acervo',
  catalogo: 'Galeria de temas',
  configuracoes: 'Configurações',
  perfil: 'Perfil',
  propostas: 'Propostas',
  equipe: 'Equipe e assinatura',
  admin: 'Piloto',
};

export default function App({ initialTab }) {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const [session, setSession] = useState(undefined); // undefined = loading auth
  const { settings, needsOnboarding, refreshCompany, loading: companyLoading } = useCompany();
  const [acervo, setAcervo] = useState([]);
  const [requirePasswordReset, setRequirePasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [eventPrompt, setEventPrompt] = useState(null);
  const routeTab = location.pathname.startsWith('/app/') ? location.pathname.split('/')[2] : null;
  const [activeTab, setActiveTab] = useState(initialTab || routeTab || 'dashboard');
  const [showGerador, setShowGerador] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [prefilledLeadForGerador, setPrefilledLeadForGerador] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [leads, setLeads] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [isFetchingDeals] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [subscriptionState, setSubscriptionState] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const trackedPages = useRef(new Set());

  const navigateTo = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    routerNavigate(`/app/${tab}`);
  };

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
    else if (routeTab && pageTitles[routeTab]) setActiveTab(routeTab);
  }, [initialTab, routeTab]);

  const requestEventData = (defaultData, defaultHora) => {
    return new Promise((resolve) => {
      setEventPrompt({ resolve, defaultData, defaultHora });
    });
  };

  const [festasProximos7Dias, setFestasProximos7Dias] = useState(0);
  const [inboxTasksCount, setInboxTasksCount] = useState(0);

  const fetchInboxTasks = async () => {
    const { count } = await supabase
      .from('inbox_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');
    if (count !== null) setInboxTasksCount(count);
  };

  const fetchSubscription = async () => {
    const { data } = await supabase.from('company_subscriptions').select('*').maybeSingle();
    setSubscriptionState(data || null);
  };

  const fetchDeals = async () => {
    setFetchError(null);
    const { data, error } = await supabase.from('deals').select('*, leads(*), events(*)');
    
    if (error) {
      console.error('Erro ao buscar dados:', error);
      setFetchError(error.message);
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
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setClientes(data);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(prev => {
        if (prev === undefined) return session;
        if (!prev && session) return session;
        if (prev && !session) return null;
        if (prev?.user?.id !== session?.user?.id) return session;
        return prev;
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(prev => {
        if (prev === undefined) return session;
        if (!prev && session) return session;
        if (prev && !session) return null;
        if (prev?.user?.id !== session?.user?.id) return session;
        return prev;
      });
      if (event === 'PASSWORD_RECOVERY') {
        setRequirePasswordReset(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && location.pathname === '/entrar') routerNavigate('/app/dashboard', { replace: true });
  }, [session, location.pathname, routerNavigate]);

  useEffect(() => {
    if (session) {
      fetchDeals();
      fetchClientes();
      fetchAcervo();
      fetchInboxTasks();
      fetchSubscription();
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      document.title = session === undefined ? 'FestaControl' : 'Entrar · FestaControl';
      return;
    }
    const section = pageTitles[activeTab];
    document.title = section ? `${section} · FestaControl` : 'FestaControl';
  }, [activeTab, session]);

  useEffect(() => {
    if (!session?.user?.id || !settings?.company_id) return;
    const context = { companyId: settings.company_id, userId: session.user.id };
    const openedKey = `festacontrol_opened_${settings.company_id}`;
    if (!sessionStorage.getItem(openedKey)) {
      sessionStorage.setItem(openedKey, '1');
      trackProductEvent(supabase, context, 'app_opened', { surface: isMobile ? 'mobile' : 'desktop' });
    }
    if (!trackedPages.current.has(activeTab)) {
      trackedPages.current.add(activeTab);
      trackProductEvent(supabase, context, 'page_viewed', { page: activeTab, surface: isMobile ? 'mobile' : 'desktop' });
    }
  }, [activeTab, isMobile, session?.user?.id, settings?.company_id]);

  useEffect(() => {
    const handleAppRefresh = () => {
      fetchDeals();
      fetchClientes();
      fetchAcervo();
      fetchInboxTasks();
    };
    window.addEventListener('app_refresh', handleAppRefresh);
    
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('app_refresh', handleAppRefresh);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const exportTenantData = async () => {
    const tables = ['leads', 'deals', 'events', 'acervo', 'proposals', 'proposal_items', 'event_costs', 'pagamentos', 'event_tasks'];
    const results = await Promise.all(tables.map(async (table) => {
      const { data, error } = await supabase.from(table).select('*');
      return [table, error ? { error: error.message } : data];
    }));
    const blob = new Blob([JSON.stringify(Object.fromEntries(results), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `festacontrol-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
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
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Safety timeout: se ainda estiver carregando após 10 segundos na primeira carga, mostra tela de diagnóstico
  useEffect(() => {
    const timer = setTimeout(() => setLoadingTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  const isLoading = session === undefined || companyLoading;
  const readOnly = subscriptionState && !(
    subscriptionState.status === 'active' ||
    (subscriptionState.status === 'trialing' && new Date(subscriptionState.trial_ends_at).getTime() > Date.now()) ||
    (subscriptionState.status === 'past_due' && new Date(subscriptionState.grace_ends_at).getTime() > Date.now())
  );

  useEffect(() => {
    if (!isLoading) {
      setHasLoadedOnce(true);
    }
  }, [isLoading]);

  if (isLoading && loadingTimedOut && !hasLoadedOnce) {
    const missingUrl = !import.meta.env.VITE_SUPABASE_URL;
    const missingKey = !import.meta.env.VITE_SUPABASE_ANON_KEY;
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', fontFamily: 'system-ui', textAlign: 'center' }}>
        <h2 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}><AlertTriangle size={24} /> Erro de configuração</h2>
        <p style={{ color: '#6b7280', maxWidth: 400 }}>
          O app não conseguiu conectar ao banco de dados. Verifique as variáveis de ambiente no painel do Vercel.
        </p>
        {(missingUrl || missingKey) && (
          <div style={{ background: '#fee2e2', padding: '1rem', borderRadius: 8, textAlign: 'left', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {missingUrl && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>VITE_SUPABASE_URL: <XCircle size={14} color="#dc2626" /> ausente</span>}
            {missingKey && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>VITE_SUPABASE_ANON_KEY: <XCircle size={14} color="#dc2626" /> ausente</span>}
          </div>
        )}
        <p style={{ color: '#9ca3af', fontSize: '0.8rem' }}>session={String(session)} | companyLoading={String(companyLoading)}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '0.5rem 1.5rem', borderRadius: 8, background: '#f97316', color: 'white', border: 'none', cursor: 'pointer' }}>Tentar novamente</button>
      </div>
    );
  }

  if (isLoading && !hasLoadedOnce) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={32} label="Carregando..." />
      </div>
    );
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('A senha deve conter letras maiúsculas, minúsculas e números.');
      return;
    }
    setIsResetting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error('Erro ao atualizar senha.');
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
      <>
        <Toaster position="top-right" />
        <Onboarding 
          onComplete={() => {
            refreshCompany();
            fetchDeals();
            fetchClientes();
            fetchAcervo();
          }} 
        />
      </>
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
      if (activeTab === 'dashboard') {
        if (isMobile) {
          return <MobileHub 
            session={session} 
            leads={leads} 
            onNavigate={navigateTo}
            onNovoOrcamento={() => setShowGerador(true)}
          />;
        }
        return <Dashboard 
          leads={leads} 
          inboxTasksCount={inboxTasksCount} 
          onNovoOrcamento={() => setShowGerador(true)} 
          onNavigate={navigateTo}
          session={session}
        />;
      }
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
          onNovoOrcamento={() => setShowGerador(true)}
        />;
      if (activeTab === 'operacao') return <OperacaoEventos />;
      if (activeTab === 'propostas') return <Propostas />;
      if (activeTab === 'equipe') return <TeamSubscription />;
      if (activeTab === 'admin') return <PilotAdmin />;
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
        <button
          type="button"
          className={styles.brand}
          onClick={() => navigateTo('dashboard')}
          aria-label="Ir para a visão geral"
          title="Ir para a visão geral"
        >
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className={styles.brandLogo} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
          ) : (
            <img src="/logo-icon.png" alt="FestaControl Logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
          )}
          <h2 className={styles.brandText}>{settings?.companies?.nome || 'FestaControl'}</h2>
        </button>
        
        {!readOnly ? <div className={styles.newActionContainer}>
          <Button 
            icon={Plus} 
            size="lg" 
            style={{ width: '100%' }}
            onClick={() => setShowGerador(true)}
          >
            <span className={styles.navLabel}>Novo Orçamento</span>
          </Button>
        </div> : null}

        <nav className={styles.nav}>
            <button
              className={`${styles.navItem} ${activeTab === 'dashboard' ? styles.active : ''}`}
              onClick={() => navigateTo('dashboard')}
              title="Visão Geral"
            >
              <BarChart3 size={20} /> <span className={styles.navLabel}>Visão Geral</span>
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'pipeline' ? styles.active : ''}`}
              onClick={() => navigateTo('pipeline')}
              title="Orçamentos (CRM)"
            >
              <LayoutDashboard size={20} /> <span className={styles.navLabel}>Orçamentos (CRM)</span>
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'leads' ? styles.active : ''}`}
              onClick={() => navigateTo('leads')}
              title="Base de Clientes"
            >
              <Users size={20} /> <span className={styles.navLabel}>Base de Clientes</span>
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'agenda' ? styles.active : ''}`}
              onClick={() => navigateTo('agenda')}
              title="Agenda"
            >
              <Calendar size={20} /> <span className={styles.navLabel}>Agenda</span>
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'operacao' ? styles.active : ''}`}
              onClick={() => navigateTo('operacao')}
              title="Operação"
            >
              <ClipboardList size={20} /> <span className={styles.navLabel}>Operação</span>
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'inbox' ? styles.active : ''}`}
              onClick={() => navigateTo('inbox')}
              title="Inbox"
            >
              <Inbox size={20} /> <span className={styles.navLabel}>Inbox</span>
              {(festasProximos7Dias + inboxTasksCount) > 0 ? <span className={styles.sidebarBadge}>{festasProximos7Dias + inboxTasksCount}</span> : null}
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'acervo' ? styles.active : ''}`}
              onClick={() => navigateTo('acervo')}
              title="Inventário (Acervo)"
            >
              <Package size={20} /> <span className={styles.navLabel}>Inventário (Acervo)</span>
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'catalogo' ? styles.active : ''}`}
              onClick={() => navigateTo('catalogo')}
              title="Galeria de Temas"
            >
              <Camera size={20} /> <span className={styles.navLabel}>Galeria de Temas</span>
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'propostas' ? styles.active : ''}`}
              onClick={() => navigateTo('propostas')}
              title="Propostas"
            >
              <FileText size={20} /> <span className={styles.navLabel}>Propostas</span>
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'equipe' ? styles.active : ''}`}
              onClick={() => navigateTo('equipe')}
              title="Equipe e assinatura"
            >
              <UserRoundCog size={20} /> <span className={styles.navLabel}>Equipe e assinatura</span>
            </button>
            {initialTab === 'admin' ? (
              <button className={`${styles.navItem} ${activeTab === 'admin' ? styles.active : ''}`} onClick={() => setActiveTab('admin')} title="Painel do piloto">
                <ShieldCheck size={20} /> <span className={styles.navLabel}>Painel do piloto</span>
              </button>
            ) : null}
        </nav>
        

      </aside>
      
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            {activeTab !== 'dashboard' ? (
              <button 
                onClick={() => navigateTo('dashboard')}
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
              {activeTab === 'dashboard' ? (settings?.companies?.nome || 'FestaControl') : 
               activeTab === 'pipeline' ? 'Pipeline' : 
               activeTab === 'leads' ? 'Clientes' :
               activeTab === 'agenda' ? 'Agenda' :
               activeTab === 'operacao' ? 'Operação' :
               activeTab === 'inbox' ? 'Avisos' :
               activeTab === 'acervo' ? 'Acervo' :
               activeTab === 'catalogo' ? 'Galeria' :
               activeTab === 'propostas' ? 'Propostas' :
               activeTab === 'equipe' ? 'Equipe e assinatura' :
               activeTab === 'admin' ? 'Piloto' :
               activeTab === 'configuracoes' ? 'Configurar' :
               activeTab === 'perfil' ? 'Perfil' :
               'FestaControl'}
            </h1>
          </div>
          <div className={styles.userProfile}>
            <div 
              className={styles.avatar} 
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              style={{ cursor: 'pointer' }}
              title="Menu da Conta"
            >
              {session?.user?.email?.substring(0, 2).toUpperCase() || 'U'}
            </div>
            
            {profileMenuOpen && (
              <>
                <div 
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }} 
                  onClick={() => setProfileMenuOpen(false)} 
                />
                <div className={styles.profileDropdown}>
                  <button 
                    className={styles.dropdownItem}
                    onClick={() => { setActiveTab('perfil'); setProfileMenuOpen(false); }}
                  >
                    <User size={18} /> Meu Perfil
                  </button>
                  <button 
                    className={styles.dropdownItem}
                    onClick={() => { setActiveTab('configuracoes'); setProfileMenuOpen(false); }}
                  >
                    <Settings size={18} /> Configurações
                  </button>
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                  <button 
                    className={`${styles.dropdownItem} ${styles.danger}`}
                    onClick={() => { setProfileMenuOpen(false); handleLogout(); }}
                  >
                    <LogOut size={18} /> Sair da conta
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
        <div className={styles.pageContent}>
          {readOnly ? <div role="alert" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.9rem 1rem', marginBottom: '1rem', borderLeft: '4px solid #d8992b', background: '#fff7e6', color: '#482f08' }}><span><strong>Conta em modo somente leitura.</strong> Regularize a assinatura ou exporte seus dados.</span><Button variant="secondary" onClick={exportTenantData}>Exportar dados</Button></div> : null}
          {renderContent()}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={styles.bottomNav}>
        <button className={`${styles.bottomNavItem} ${activeTab === 'agenda' ? styles.active : ''}`} onClick={() => navigateTo('agenda')}>
          <Calendar size={22} strokeWidth={activeTab === 'agenda' ? 2.5 : 2} />
          Agenda
        </button>
        <button className={`${styles.bottomNavItem} ${activeTab === 'pipeline' ? styles.active : ''}`} onClick={() => navigateTo('pipeline')}>
          <BarChart3 size={22} strokeWidth={activeTab === 'pipeline' ? 2.5 : 2} />
          Pipeline
        </button>
        
        {!readOnly ? <div className={styles.fabWrapper}>
          <button className={styles.fab} onClick={() => setShowGerador(true)} aria-label="Criar novo orçamento" title="Criar novo orçamento">
            <Plus size={28} />
          </button>
        </div> : <div className={styles.fabWrapper} aria-hidden="true" />}

        <button className={`${styles.bottomNavItem} ${activeTab === 'inbox' ? styles.active : ''}`} onClick={() => navigateTo('inbox')}>
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
