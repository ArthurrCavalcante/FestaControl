import { supabase } from '../supabaseClient';

/**
 * Função global para registrar atividades no banco (Auditoria)
 */
export const logActivity = async (action, entityType, entityId = null, details = {}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Se não estiver logado, não loga

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details
    });
  } catch (error) {
    console.error('Erro ao registrar log de atividade:', error);
  }
};

/**
 * Funções de Soft Delete (Archiving)
 * Todas atualizam o deleted_at e deleted_by em vez de deletar fisicamente.
 */

export const archiveRecord = async (table, idField, idValue, entityType, description = '') => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Suporte para array de IDs (batch delete)
    const isBatch = Array.isArray(idValue);
    
    let query = supabase.from(table).update({
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id
    });
    
    if (isBatch) {
      query = query.in(idField, idValue);
    } else {
      query = query.eq(idField, idValue);
    }
    
    const { error } = await query;
    if (error) throw error;
    
    if (isBatch) {
      logActivity('DELETED_BATCH', entityType, null, { count: idValue.length, ids: idValue, description });
    } else {
      logActivity('DELETED', entityType, idValue, description ? { description } : {});
    }
    return { success: true };
  } catch (error) {
    console.error(`Erro ao arquivar registro na tabela ${table}:`, error);
    return { error };
  }
};

export const archiveLead = (id) => archiveRecord('leads', 'id', id, 'lead');
export const archiveDeal = (id) => archiveRecord('deals', 'id', id, 'deal');
export const archiveEvent = (dealId) => archiveRecord('events', 'deal_id', dealId, 'event', 'Evento cancelado (Deal ID)');
export const deleteFotoCatalogo = async (id, path) => {
  try {
    const { error: dbError } = await supabase.from('catalogo_fotos').delete().eq('id', id);
    if (dbError) throw dbError;
    
    if (path) {
      const { error: storageError } = await supabase.storage.from('Catalogo').remove([path]);
      if (storageError) console.error('Erro ao deletar do storage:', storageError);
    }
    
    logActivity('HARD_DELETE', 'catalogo_foto', id, { path });
    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar foto:', error);
    return { error };
  }
};

export const deleteMultipleFotosCatalogo = async (ids, paths) => {
  try {
    const { error: dbError } = await supabase.from('catalogo_fotos').delete().in('id', ids);
    if (dbError) throw dbError;
    
    if (paths && paths.length > 0) {
      // Filter out null/undefined paths just in case
      const validPaths = paths.filter(p => p);
      if (validPaths.length > 0) {
        const { error: storageError } = await supabase.storage.from('Catalogo').remove(validPaths);
        if (storageError) console.error('Erro ao deletar do storage:', storageError);
      }
    }
    
    logActivity('HARD_DELETE_BATCH', 'catalogo_foto', null, { count: ids.length, ids });
    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar fotos:', error);
    return { error };
  }
};

/**
 * Função global para capturar erros críticos (Monitoramento Pragmático)
 */
export const logError = async (error, screen = 'Desconhecida') => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('error_logs').insert({
      user_id: user?.id,
      screen,
      error_message: error?.message || String(error),
      stack: error?.stack || null
    });
  } catch (e) {
    // Falha silenciosa para não quebrar a aplicação durante o log
    console.error('Falha crítica ao gravar erro:', e);
  }
};

/**
 * Funções do CRM (Anotações, Arquivos e Timeline Unificada)
 */

export const addDealNote = async (dealId, companyId, texto, tipo = 'NORMAL') => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('deal_notes').insert({
      deal_id: dealId,
      company_id: companyId,
      texto,
      tipo,
      user_id: user?.id
    });
    if (error) throw error;
    
    // Log da atividade
    await logActivity('NOTE_ADDED', 'deal', dealId, { tipo });
    return { success: true };
  } catch (error) {
    console.error('Erro ao adicionar nota:', error);
    return { error };
  }
};

export const uploadDealFile = async (dealId, companyId, file, tipo = 'Documento') => {
  try {
    // Upload para o bucket CRM
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    // Estrutura solicitada: companies/{company_id}/deals/{deal_id}/
    const filePath = `companies/${companyId}/deals/${dealId}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('crm')
      .upload(filePath, file);
      
    if (uploadError) throw uploadError;
    
    // Registrar na tabela deal_files
    const { error: dbError } = await supabase.from('deal_files').insert({
      deal_id: dealId,
      nome_arquivo: file.name,
      caminho_storage: filePath,
      tipo
    });
    
    if (dbError) throw dbError;
    
    await logActivity('FILE_ATTACHED', 'deal', dealId, { nome: file.name, tipo });
    return { success: true };
  } catch (error) {
    console.error('Erro ao fazer upload do arquivo:', error);
    return { error };
  }
};

export const createDealFileSignedUrls = async (paths) => {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return {};

  const { data, error } = await supabase.storage.from('crm').createSignedUrls(uniquePaths, 300);
  if (error) throw error;
  return Object.fromEntries((data || []).filter(item => item.signedUrl).map(item => [item.path, item.signedUrl]));
};

export const fetchUnifiedTimeline = async (dealId) => {
  try {
    // Buscar Anotações (não joinar com profiles via user_id pois o schema não tem FK para profiles)
    const { data: notes } = await supabase.from('deal_notes').select('*').eq('deal_id', dealId);
    // Buscar Arquivos
    const { data: files } = await supabase.from('deal_files').select('*').eq('deal_id', dealId);
    // Buscar Logs de Atividade
    const { data: logs } = await supabase.from('activity_logs').select('*').eq('entity_id', dealId);
    
    const timeline = [];
    
    (notes || []).forEach(n => {
      timeline.push({
        id: `note_${n.id}`,
        type: 'NOTE',
        date: new Date(n.created_at),
        content: n.texto,
        badge: n.tipo,
        author: 'Usuário',
        original: n
      });
    });
    
    (files || []).forEach(f => {
      timeline.push({
        id: `file_${f.id}`,
        type: 'FILE',
        date: new Date(f.created_at),
        content: `Arquivo anexado: ${f.nome_arquivo}`,
        badge: f.tipo,
        path: f.caminho_storage,
        original: f
      });
    });
    
    (logs || []).forEach(l => {
      let content = '';
      if (l.action === 'STATUS_CHANGED') {
        content = `Status alterado de ${l.details?.from || 'Novo'} para ${l.details?.to}`;
      } else if (l.action === 'PIPELINE_MOVED') {
        content = `Card movido para ${l.details?.to}`;
      } else if (l.action === 'UPDATED') {
        content = `Orçamento atualizado`;
      } else if (l.action === 'NOTE_ADDED') {
        return; // Pula os logs de nota pra não duplicar com as próprias notas na timeline
      } else if (l.action === 'FILE_ATTACHED') {
        return; // Pula logs de arquivo
      } else {
        content = `Atividade: ${l.action}`;
      }
      
      timeline.push({
        id: `log_${l.id}`,
        type: 'ACTIVITY',
        date: new Date(l.created_at),
        content: content,
        original: l
      });
    });
    
    // Ordernar do mais recente pro mais antigo
    return timeline.sort((a, b) => b.date - a.date);
  } catch (error) {
    console.error('Erro ao buscar timeline:', error);
    return [];
  }
};

export const fetchThemeHistory = async (temaId) => {
  if (!temaId) return [];
  try {
    const { data, error } = await supabase
      .from('deals')
      .select('id, valor_total, created_at, leads(nome)')
      .eq('tema_id', temaId)
      .neq('status_funil', 'CANCELADO')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar histórico do tema:', error);
    return [];
  }
};
