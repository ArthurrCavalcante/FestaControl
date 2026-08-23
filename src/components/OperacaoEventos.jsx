import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertTriangle, CheckSquare, ClipboardList, Package, Plus, TriangleAlert, UserRound, WalletCards } from 'lucide-react';
import { supabase } from '../supabaseClient';
import Button from './ui/Button';
import Modal from './ui/Modal';
import operationStyles from './OperacaoEventos.module.css';

const panel = { background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' };
const field = { width: '100%', padding: '0.65rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-color)', color: 'var(--text-color)' };
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

export default function OperacaoEventos() {
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [reservas, setReservas] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [custos, setCustos] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [acervo, setAcervo] = useState([]);
  const [disponibilidade, setDisponibilidade] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const selectedEvent = events.find((event) => event.id === selectedId);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('id, company_id, deal_id, data_evento, horario, endereco, status_operacional, deals(id, tema, valor_total, leads(nome))')
      .is('deleted_at', null)
      .order('data_evento', { ascending: true });
    if (error) toast.error('Não foi possível carregar os eventos.');
    else {
      setEvents(data || []);
      const today = new Date().toISOString().slice(0, 10);
      const nextEvent = data?.find((event) => event.data_evento >= today) || data?.[0];
      if (nextEvent) setSelectedId((current) => current || nextEvent.id);
    }
    setLoading(false);
  }, []);

  const loadDetails = useCallback(async (event) => {
    if (!event) return;
    const [reservasResult, pagamentosResult, tarefasResult, acervoResult, disponibilidadeResult, custosResult, incidentesResult] = await Promise.all([
      supabase.from('acervo_reservas').select('id, quantidade, data_inicio, data_fim, status, observacoes, acervo(nome, categoria)').eq('event_id', event.id).order('created_at'),
      supabase.from('pagamentos').select('*').eq('event_id', event.id).order('vencimento'),
      supabase.from('event_tasks').select('*').eq('event_id', event.id).order('prazo'),
      supabase.from('acervo').select('id, nome, categoria, quantidade_total').eq('ativo', true).is('deleted_at', null).order('nome'),
      supabase.rpc('get_acervo_disponibilidade', { p_data: event.data_evento }),
      supabase.from('event_costs').select('*').eq('event_id', event.id).order('created_at'),
      supabase.from('inventory_incidents').select('*, inventory_movements(quantity)').eq('event_id', event.id).order('created_at', { ascending: false }),
    ]);
    if (reservasResult.error || pagamentosResult.error || tarefasResult.error || acervoResult.error || disponibilidadeResult.error || custosResult.error || incidentesResult.error) {
      toast.error('Não foi possível carregar todos os dados operacionais.');
      return;
    }
    setReservas(reservasResult.data || []);
    setPagamentos(pagamentosResult.data || []);
    setTarefas(tarefasResult.data || []);
    setAcervo(acervoResult.data || []);
    setDisponibilidade(Object.fromEntries((disponibilidadeResult.data || []).map((item) => [item.acervo_id, item])));
    setCustos(custosResult.data || []);
    setIncidentes(incidentesResult.data || []);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { loadDetails(selectedEvent); }, [loadDetails, selectedEvent]);

  const paymentTotals = useMemo(() => ({
    total: pagamentos.reduce((sum, item) => sum + Number(item.valor), 0),
    paid: pagamentos.filter((item) => item.status === 'PAGO').reduce((sum, item) => sum + Number(item.valor), 0),
  }), [pagamentos]);
  const costTotals = useMemo(() => ({
    estimated: custos.reduce((sum, item) => sum + Number(item.estimated_amount || 0), 0),
    actual: custos.reduce((sum, item) => sum + Number(item.actual_amount ?? item.estimated_amount ?? 0), 0),
  }), [custos]);

  const refresh = async () => {
    await loadEvents();
    await loadDetails(selectedEvent);
  };

  const saveReserva = async (form) => {
    setSaving(true);
    const { error } = await supabase.rpc('criar_reserva_acervo', {
      p_event_id: selectedEvent.id,
      p_acervo_id: form.acervo_id,
      p_quantidade: Number(form.quantidade),
      p_data_inicio: form.data_inicio,
      p_data_fim: form.data_fim,
      p_observacoes: form.observacoes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message.includes('indisponível') ? 'Item indisponível para esse período.' : 'Não foi possível criar a reserva.');
    toast.success('Item reservado para o evento.');
    setModal(null);
    await refresh();
  };

  const savePagamento = async (form) => {
    setSaving(true);
    const { error } = await supabase.from('pagamentos').insert({
      deal_id: selectedEvent.deal_id,
      event_id: selectedEvent.id,
      descricao: form.descricao || 'Pagamento',
      tipo: form.tipo,
      valor: Number(form.valor),
      vencimento: form.vencimento || null,
      metodo: form.metodo || null,
      observacoes: form.observacoes || null,
    });
    setSaving(false);
    if (error) return toast.error('Não foi possível agendar o pagamento.');
    toast.success('Pagamento agendado.');
    setModal(null);
    await refresh();
  };

  const saveTarefa = async (form) => {
    setSaving(true);
    const { error } = await supabase.from('event_tasks').insert({
      event_id: selectedEvent.id,
      titulo: form.titulo,
      etapa: form.etapa,
      responsavel: form.responsavel || null,
      prazo: form.prazo ? new Date(`${form.prazo}T12:00:00`).toISOString() : null,
      observacoes: form.observacoes || null,
    });
    setSaving(false);
    if (error) return toast.error('Não foi possível criar a tarefa.');
    toast.success('Tarefa adicionada.');
    setModal(null);
    await refresh();
  };

  const saveCusto = async (form) => {
    setSaving(true);
    const { error } = await supabase.from('event_costs').insert({
      event_id: selectedEvent.id,
      category: form.category,
      description: form.description,
      estimated_amount: Number(form.estimated_amount || 0),
      actual_amount: form.actual_amount === '' ? null : Number(form.actual_amount),
    });
    setSaving(false);
    if (error) return toast.error('Não foi possível registrar a despesa.');
    toast.success('Despesa registrada.');
    setModal(null);
    await refresh();
  };

  const updateReservationStatus = async (reservation, status) => {
    const { error } = await supabase.from('acervo_reservas').update({ status }).eq('id', reservation.id);
    if (error) return toast.error('Não foi possível atualizar o item.');
    const movementType = status === 'ENTREGUE' ? 'outbound' : status === 'DEVOLVIDO' ? 'returned' : status === 'MANUTENCAO' ? 'damaged' : null;
    if (movementType) {
      await supabase.from('inventory_movements').insert({
        event_id: selectedEvent.id, reservation_id: reservation.id, movement_type: movementType, quantity: reservation.quantidade,
      });
    }
    await refresh();
  };

  const saveIncident = async (form) => {
    setSaving(true);
    try {
      const movementType = form.incident_type === 'loss' ? 'lost' : 'damaged';
      const { data: movement, error: movementError } = await supabase.from('inventory_movements').insert({
        event_id: selectedEvent.id,
        reservation_id: form.reservation_id || null,
        movement_type: movementType,
        quantity: Number(form.quantity),
        notes: form.description,
      }).select('id').single();
      if (movementError) throw movementError;

      let photoPath = null;
      if (form.photo) {
        const safeName = form.photo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        photoPath = `companies/${selectedEvent.company_id}/deals/${selectedEvent.deal_id}/incidents/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('crm').upload(photoPath, form.photo, { upsert: false });
        if (uploadError) throw uploadError;
      }
      const { error: incidentError } = await supabase.from('inventory_incidents').insert({
        event_id: selectedEvent.id,
        movement_id: movement.id,
        incident_type: form.incident_type,
        description: form.description,
        charge_amount: Number(form.charge_amount || 0),
        photo_path: photoPath,
      });
      if (incidentError) throw incidentError;
      toast.success(form.incident_type === 'loss' ? 'Item perdido registrado.' : 'Avaria registrada.');
      setModal(null);
      await refresh();
    } catch {
      toast.error('Não foi possível registrar a ocorrência.');
    } finally {
      setSaving(false);
    }
  };

  const update = async (table, id, values) => {
    const { error } = await supabase.from(table).update(values).eq('id', id);
    if (error) toast.error('Não foi possível salvar a alteração.');
    else await refresh();
  };

  if (loading) return <div style={{ padding: '2rem' }}>Carregando operação...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', alignItems: 'end' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', gap: '0.5rem', alignItems: 'center' }}><ClipboardList color="var(--primary)" /> Central Operacional</h2>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)' }}>Acervo reservado, financeiro e tarefas da equipe em um só lugar.</p>
        </div>
        <div style={{ minWidth: 'min(100%, 350px)' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Evento</label>
          <select style={field} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {events.length === 0 && <option value="">Nenhum evento confirmado</option>}
            {events.map((event) => <option key={event.id} value={event.id}>{new Date(`${event.data_evento}T12:00:00`).toLocaleDateString('pt-BR')} · {event.deals?.leads?.nome || 'Cliente'} · {event.deals?.tema || 'Tema a definir'}</option>)}
          </select>
        </div>
      </header>

      {!selectedEvent ? <div style={panel}>Confirme um orçamento para começar a organizar sua operação.</div> : <>
        <div className={operationStyles.summaryGrid} style={panel}>
          <div className={operationStyles.summaryItem}><span>Cliente</span><strong>{selectedEvent.deals?.leads?.nome || 'Não informado'}</strong></div>
          <div className={operationStyles.summaryItem}><span>Data e horário</span><strong>{new Date(`${selectedEvent.data_evento}T12:00:00`).toLocaleDateString('pt-BR')} · {selectedEvent.horario}</strong></div>
          <div className={operationStyles.summaryItem}><span>Valor do evento</span><strong>{money(selectedEvent.deals?.valor_total)}</strong></div>
          <div className={operationStyles.summaryItem}><span>Recebido</span><strong style={{ color: 'var(--success)' }}>{money(paymentTotals.paid)}</strong></div>
          <div className={operationStyles.summaryItem}><span>Custo real</span><strong>{money(costTotals.actual)}</strong></div>
          <div className={operationStyles.summaryItem}><span>Margem</span><strong style={{ color: Number(selectedEvent.deals?.valor_total || 0) - costTotals.actual >= 0 ? 'var(--success)' : 'var(--danger)' }}>{money(Number(selectedEvent.deals?.valor_total || 0) - costTotals.actual)} · {Number(selectedEvent.deals?.valor_total || 0) > 0 ? `${Math.round(((Number(selectedEvent.deals?.valor_total || 0) - costTotals.actual) / Number(selectedEvent.deals?.valor_total || 0)) * 100)}%` : '0%'}</strong></div>
        </div>

        <section style={{ ...panel, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}><h3 style={{ margin: 0, display: 'flex', gap: '0.4rem', alignItems: 'center' }}><Package size={19} /> Acervo reservado</h3><Button size="sm" icon={Plus} onClick={() => setModal('reserva')}>Reservar item</Button></div>
          {reservas.length === 0 ? <span style={{ color: 'var(--text-secondary)' }}>Nenhum item reservado ainda.</span> : reservas.map((item) => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.7rem' }}><span><strong>{item.acervo?.nome}</strong> · {item.quantidade} un. <small>({item.data_inicio} a {item.data_fim})</small></span><select value={item.status} onChange={(event) => updateReservationStatus(item, event.target.value)} style={{ ...field, width: '145px', padding: '0.3rem' }}><option value="RESERVADO">Reservado</option><option value="SEPARADO">Separado</option><option value="ENTREGUE">Entregue</option><option value="DEVOLVIDO">Devolvido</option><option value="MANUTENCAO">Manutenção</option><option value="CANCELADO">Cancelado</option></select></div>)}
        </section>

        <section style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}><h3 style={{ margin: 0, display: 'flex', gap: '0.4rem', alignItems: 'center' }}><WalletCards size={19} /> Custos e margem</h3><div style={{ display: 'flex', gap: '.5rem' }}><Button size="sm" icon={Plus} onClick={() => setModal('custo')}>Despesa</Button><Button size="sm" variant="secondary" icon={TriangleAlert} onClick={() => setModal('incidente')}>Avaria ou perda</Button></div></div>
          <p style={{ color: 'var(--text-secondary)' }}>Estimado: {money(costTotals.estimated)} · Real: {money(costTotals.actual)}</p>
          {custos.map((item) => <div key={item.id} style={{ borderTop: '1px solid var(--border-color)', padding: '0.7rem 0', display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem' }}><span><strong>{item.description}</strong><small style={{ display: 'block' }}>{item.category} · estimado {money(item.estimated_amount)}</small></span><label style={{ fontSize: '.75rem' }}>Real<input type="number" min="0" step="0.01" defaultValue={item.actual_amount ?? ''} onBlur={(event) => update('event_costs', item.id, { actual_amount: event.target.value === '' ? null : Number(event.target.value) })} style={{ ...field, width: 120, padding: '.35rem' }} /></label></div>)}
          {incidentes.map((item) => <div key={item.id} style={{ borderTop: '1px solid var(--border-color)', padding: '0.7rem 0' }}><strong>{item.incident_type === 'loss' ? 'Perda' : 'Avaria'}:</strong> {item.description} · cobrança {money(item.charge_amount)}{item.photo_path ? ' · foto privada anexada' : ''}</div>)}
          {!custos.length && !incidentes.length ? <span style={{ color: 'var(--text-secondary)' }}>Nenhuma despesa ou ocorrência registrada.</span> : null}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <section style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}><h3 style={{ margin: 0, display: 'flex', gap: '0.4rem', alignItems: 'center' }}><WalletCards size={19} /> Financeiro</h3><Button size="sm" icon={Plus} onClick={() => setModal('pagamento')}>Pagamento</Button></div>
            <p style={{ color: 'var(--text-secondary)' }}>Programado: {money(paymentTotals.total)} · Recebido: {money(paymentTotals.paid)}</p>
            {pagamentos.map((item) => <div key={item.id} style={{ borderTop: '1px solid var(--border-color)', padding: '0.7rem 0', display: 'flex', justifyContent: 'space-between', gap: '0.6rem' }}><span><strong>{item.descricao}</strong><small style={{ display: 'block' }}>{item.vencimento ? `Vence em ${new Date(`${item.vencimento}T12:00:00`).toLocaleDateString('pt-BR')}` : 'Sem vencimento'} · {money(item.valor)}</small></span><Button size="sm" variant={item.status === 'PAGO' ? 'secondary' : 'success'} onClick={() => update('pagamentos', item.id, item.status === 'PAGO' ? { status: 'PENDENTE', pago_em: null } : { status: 'PAGO', pago_em: new Date().toISOString() })}>{item.status === 'PAGO' ? 'Pago' : 'Marcar pago'}</Button></div>)}
            {pagamentos.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>Nenhuma cobrança cadastrada.</span>}
          </section>

          <section style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}><h3 style={{ margin: 0, display: 'flex', gap: '0.4rem', alignItems: 'center' }}><CheckSquare size={19} /> Equipe e checklist</h3><Button size="sm" icon={Plus} onClick={() => setModal('tarefa')}>Tarefa</Button></div>
            {tarefas.map((item) => <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderTop: '1px solid var(--border-color)', padding: '0.7rem 0', cursor: 'pointer' }}><input type="checkbox" checked={item.status === 'CONCLUIDA'} onChange={(event) => update('event_tasks', item.id, event.target.checked ? { status: 'CONCLUIDA', concluida_em: new Date().toISOString() } : { status: 'PENDENTE', concluida_em: null })} /><span><strong style={{ textDecoration: item.status === 'CONCLUIDA' ? 'line-through' : 'none' }}>{item.titulo}</strong><small style={{ display: 'block' }}>{item.etapa} {item.responsavel ? `· ${item.responsavel}` : ''}</small></span></label>)}
            {tarefas.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>Nenhuma tarefa cadastrada.</span>}
          </section>
        </div>
      </>}

      {modal === 'reserva' && <ReservaModal acervo={acervo} disponibilidade={disponibilidade} event={selectedEvent} saving={saving} onClose={() => setModal(null)} onSave={saveReserva} />}
      {modal === 'pagamento' && <PagamentoModal saving={saving} onClose={() => setModal(null)} onSave={savePagamento} />}
      {modal === 'tarefa' && <TarefaModal event={selectedEvent} saving={saving} onClose={() => setModal(null)} onSave={saveTarefa} />}
      {modal === 'custo' && <CustoModal saving={saving} onClose={() => setModal(null)} onSave={saveCusto} />}
      {modal === 'incidente' && <IncidenteModal reservas={reservas} saving={saving} onClose={() => setModal(null)} onSave={saveIncident} />}
    </div>
  );
}

function ReservaModal({ acervo, disponibilidade, event, saving, onClose, onSave }) {
  const [form, setForm] = useState({ acervo_id: '', quantidade: 1, data_inicio: event.data_evento, data_fim: event.data_evento, observacoes: '' });
  const selected = disponibilidade[form.acervo_id];
  return <Modal title="Reservar item do acervo" icon={Package} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave(form); }} style={{ display: 'grid', gap: '0.8rem' }}><label>Item<select required style={field} value={form.acervo_id} onChange={(event) => setForm({ ...form, acervo_id: event.target.value })}><option value="">Selecione</option>{acervo.map((item) => { const stock = disponibilidade[item.id]; return <option key={item.id} value={item.id}>{item.nome} · disponível: {stock?.quantidade_disponivel ?? item.quantidade_total}</option>; })}</select></label>{selected && Number(selected.quantidade_disponivel) < 1 && <span style={{ color: 'var(--danger)', display: 'flex', gap: '0.4rem' }}><AlertTriangle size={17} /> Sem disponibilidade nesta data.</span>}<label>Quantidade<input required min="1" max={Math.max(1, Number(selected?.quantidade_disponivel || 1))} type="number" style={field} value={form.quantidade} onChange={(event) => setForm({ ...form, quantidade: event.target.value })} /></label><div style={{ display: 'flex', gap: '0.8rem' }}><label style={{ flex: 1 }}>Retirada<input type="date" required style={field} value={form.data_inicio} onChange={(event) => setForm({ ...form, data_inicio: event.target.value })} /></label><label style={{ flex: 1 }}>Devolução<input type="date" required style={field} value={form.data_fim} onChange={(event) => setForm({ ...form, data_fim: event.target.value })} /></label></div><label>Observações<textarea style={field} value={form.observacoes} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} /></label><Button type="submit" loading={saving}>Confirmar reserva</Button></form></Modal>;
}

function PagamentoModal({ saving, onClose, onSave }) {
  const [form, setForm] = useState({ descricao: 'Sinal', tipo: 'SINAL', valor: '', vencimento: '', metodo: '', observacoes: '' });
  return <Modal title="Agendar pagamento" icon={WalletCards} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave(form); }} style={{ display: 'grid', gap: '0.8rem' }}><label>Descrição<input required style={field} value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></label><label>Tipo<select style={field} value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })}><option value="SINAL">Sinal</option><option value="PARCELA">Parcela</option><option value="AJUSTE">Ajuste</option><option value="REEMBOLSO">Reembolso</option></select></label><label>Valor<input required min="0.01" step="0.01" type="number" style={field} value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} /></label><label>Vencimento<input type="date" style={field} value={form.vencimento} onChange={(event) => setForm({ ...form, vencimento: event.target.value })} /></label><label>Forma de pagamento<input style={field} placeholder="Pix, dinheiro, cartão..." value={form.metodo} onChange={(event) => setForm({ ...form, metodo: event.target.value })} /></label><Button type="submit" loading={saving}>Agendar</Button></form></Modal>;
}

function TarefaModal({ event, saving, onClose, onSave }) {
  const [form, setForm] = useState({ titulo: '', etapa: 'SEPARACAO', responsavel: '', prazo: event.data_evento, observacoes: '' });
  return <Modal title="Adicionar tarefa operacional" icon={UserRound} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave(form); }} style={{ display: 'grid', gap: '0.8rem' }}><label>Tarefa<input required style={field} value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} placeholder="Ex: Separar painel e cilindros" /></label><label>Etapa<select style={field} value={form.etapa} onChange={(event) => setForm({ ...form, etapa: event.target.value })}><option value="SEPARACAO">Separação</option><option value="ENTREGA">Entrega</option><option value="MONTAGEM">Montagem</option><option value="DESMONTAGEM">Desmontagem</option><option value="RETIRADA">Retirada</option><option value="FINANCEIRO">Financeiro</option></select></label><label>Responsável<input style={field} value={form.responsavel} onChange={(event) => setForm({ ...form, responsavel: event.target.value })} /></label><label>Prazo<input type="date" style={field} value={form.prazo} onChange={(event) => setForm({ ...form, prazo: event.target.value })} /></label><Button type="submit" loading={saving}>Adicionar tarefa</Button></form></Modal>;
}

function CustoModal({ saving, onClose, onSave }) {
  const [form, setForm] = useState({ category: 'material', description: '', estimated_amount: '', actual_amount: '' });
  return <Modal title="Registrar despesa" icon={WalletCards} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave(form); }} style={{ display: 'grid', gap: '0.8rem' }}><label>Categoria<select style={field} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="material">Material</option><option value="transport">Transporte</option><option value="staff">Equipe</option><option value="supplier">Terceiros</option><option value="loss">Perdas</option><option value="other">Outros</option></select></label><label>Descrição<input required style={field} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Estimativa<input required min="0" step="0.01" type="number" style={field} value={form.estimated_amount} onChange={(event) => setForm({ ...form, estimated_amount: event.target.value })} /></label><label>Valor real<input min="0" step="0.01" type="number" style={field} value={form.actual_amount} onChange={(event) => setForm({ ...form, actual_amount: event.target.value })} /></label><Button type="submit" loading={saving}>Registrar despesa</Button></form></Modal>;
}

function IncidenteModal({ reservas, saving, onClose, onSave }) {
  const [form, setForm] = useState({ reservation_id: '', incident_type: 'damage', quantity: 1, description: '', charge_amount: 0, photo: null });
  return <Modal title="Registrar avaria ou perda" icon={TriangleAlert} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave(form); }} style={{ display: 'grid', gap: '0.8rem' }}><label>Item reservado<select style={field} value={form.reservation_id} onChange={(event) => setForm({ ...form, reservation_id: event.target.value })}><option value="">Não vincular</option>{reservas.map((item) => <option key={item.id} value={item.id}>{item.acervo?.nome} · {item.quantidade} un.</option>)}</select></label><label>Ocorrência<select style={field} value={form.incident_type} onChange={(event) => setForm({ ...form, incident_type: event.target.value })}><option value="damage">Avaria</option><option value="loss">Item perdido</option></select></label><label>Quantidade<input required type="number" min="1" style={field} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label>Descrição<textarea required style={field} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Cobrança ao cliente<input type="number" min="0" step="0.01" style={field} value={form.charge_amount} onChange={(event) => setForm({ ...form, charge_amount: event.target.value })} /></label><label>Foto privada<input type="file" accept="image/*" style={field} onChange={(event) => setForm({ ...form, photo: event.target.files?.[0] || null })} /></label><Button type="submit" loading={saving}>Registrar ocorrência</Button></form></Modal>;
}
