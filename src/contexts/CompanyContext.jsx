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
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Busca o perfil do usuário para saber qual é a empresa dele
      // Usamos limit(1) e order para evitar erro 406 se houver múltiplos perfis
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
        setSettings(data);
        setNeedsOnboarding(false);
        
        // Injeta a cor primária no sistema
        if (data.primary_color) {
          document.documentElement.style.setProperty('--primary', data.primary_color);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar configurações da empresa:', err);
      logError(err, 'CompanyContext');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Escuta evento de auth para carregar as configs só quando logado
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        fetchSettings();
      } else {
        setSettings(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });
    
    // Tenta carregar caso já tenha sessão no reload
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchSettings();
      else setLoading(false);
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
