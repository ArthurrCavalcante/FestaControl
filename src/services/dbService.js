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
export const archiveFotoCatalogo = (id) => archiveRecord('catalogo_fotos', 'id', id, 'catalogo_foto');
export const archiveMultipleFotosCatalogo = (ids) => archiveRecord('catalogo_fotos', 'id', ids, 'catalogo_foto');

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
