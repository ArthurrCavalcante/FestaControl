import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { logError } from '../services/dbService';

export const CompanyContext = createContext({});

export function CompanyProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const fetchSettings = async () => {
    try {
      if (!settings) setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Busca o perfil do usuário para saber qual é a empresa dele
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .not('company_id', 'is', null)
        .limit(1);
        
      if (profileError) {
        throw profileError;
      }
      
      let profile = profiles && profiles.length > 0 ? profiles[0] : null;

      // Se não encontrou nenhum perfil COM company_id, tenta buscar qualquer um
      if (!profile) {
        const { data: fallbackProfiles } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1);
          
        if (!fallbackProfiles || fallbackProfiles.length === 0 || !fallbackProfiles[0].company_id) {
          setNeedsOnboarding(true);
          setLoading(false);
          return;
        }
        profile = fallbackProfiles[0];
      }

      // 2. Busca as configurações específicas da empresa dele
      const { data, error } = await supabase
        .from('company_settings')
        .select('*, companies(nome, documento)')
        .eq('company_id', profile.company_id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setSettings(prev => {
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });
        setNeedsOnboarding(false);
        
        // Injeta a cor primária no sistema
        if (data.primary_color) {
          document.documentElement.style.setProperty('--primary', data.primary_color);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar configurações da empresa');
      logError(err, 'CompanyContext');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let initialized = false;

    // Tenta carregar caso já tenha sessão no reload — sempre roda primeiro
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialized = true;
      if (session) {
        fetchSettings();
      } else {
        setLoading(false);
      }
    });

    // Escuta eventos de auth posteriores ao carregamento inicial
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;

      if (session) {
        // Só dispara fetchSettings se ainda não inicializado (evita duplicar com getSession acima)
        // ou se o usuário fez login num evento posterior
        if (!initialized || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          fetchSettings();
        }
      } else {
        setSettings(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateSettings = async (updates) => {
    if (!settings?.company_id) return { error: 'Nenhuma empresa ativa' };
    
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .update(updates)
        .eq('company_id', settings.company_id)
        .select('*, companies(nome, documento)')
        .single();

      if (error) throw error;
      
      if (data) {
        setSettings(data);
        if (data.primary_color) {
          document.documentElement.style.setProperty('--primary', data.primary_color);
        }
        return { success: true };
      }
    } catch (err) {
      console.error('Erro ao atualizar configurações:', err);
      logError(err, 'CompanyContext.updateSettings');
      throw err;
    }
  };

  return (
    <CompanyContext.Provider value={{ settings, updateSettings, loading, needsOnboarding, refreshCompany: fetchSettings }}>
      {children}
    </CompanyContext.Provider>
  );
}
