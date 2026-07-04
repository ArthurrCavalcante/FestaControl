import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { logError } from '../services/dbService';

const CompanyContext = createContext({});

export function CompanyProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      // Como ainda não temos isolamento completo de multi-tenant na UI, 
      // puxamos a primeira configuração disponível. (No futuro, filtraremos por company_id do usuário)
      const { data, error } = await supabase
        .from('company_settings')
        .select('*, companies(nome, documento)')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // Ignora erro de 0 rows
        throw error;
      }
      
      if (data) {
        setSettings(data);
        
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
    try {
      if (!settings?.company_id) return { error: 'Nenhuma empresa ativa' };
      
      const { error } = await supabase
        .from('company_settings')
        .update(updates)
        .eq('company_id', settings.company_id);

      if (error) throw error;
      
      setSettings(prev => ({ ...prev, ...updates }));
      
      if (updates.primary_color) {
        document.documentElement.style.setProperty('--primary', updates.primary_color);
      }
      return { success: true };
    } catch (err) {
      console.error(err);
      logError(err, 'CompanyContext - updateSettings');
      return { error: err.message };
    }
  };

  return (
    <CompanyContext.Provider value={{ settings, updateSettings, loading, reloadSettings: fetchSettings }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
