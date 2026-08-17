import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertTriangle, CheckSquare, ClipboardList, Package, Plus, UserRound, WalletCards } from 'lucide-react';
import { supabase } from '../supabaseClient';
import Button from './ui/Button';
import Modal from './ui/Modal';

const panel = { background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' };
const field = { width: '100%', padding: '0.65rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-color)', color: 'var(--text-color)' };
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

export default function OperacaoEventos() {
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [reservas, setReservas] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
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
      .select('id, deal_id, data_evento, horario, endereco, status_operacional, deals(id, tema, valor_total, leads(nome))')
      .is('deleted_at', null)
      .order('data_evento', { ascending: true });
    if (error) toast.error('Não foi possível carregar os eventos.');
    else {
      setEvents(data || []);
      if (data?.[0]) setSelectedId((current) => current || data[0].id);
    }
    setLoading(false);
  }, []);

  const loadDetails = useCallback(async (event) => {
    if (!event) return;
    const [reservasResult, pagamentosResult, tarefasResult, acervoResult, disponibilidadeResult] = await Promise.all([
      supabase.from('acervo_reservas').select('id, quantidade, data_inicio, data_fim, status, observacoes, acervo(nome, categoria)').eq('event_id', event.id).order('created_at'),
      supabase.from('pagamentos').select('*').eq('event_id', event.id).order('vencimento'),
      supabase.from('event_tasks').select('*').eq('event_id', event.id).order('prazo'),
      supabase.from('acervo').select('id, nome, categoria, quantidade_total').eq('ativo', true).is('deleted_at', null).order('nome'),
      supabase.rpc('get_acervo_disponibilidade', { p_data: event.data_evento }),
    ]);
    if (reservasResult.error || pagamentosResult.error || tarefasResult.error || acervoResult.error || disponibilidadeResult.error) {
      toast.error('Não foi possível carregar todos os dados operacionais.');
      return;
    }
    setReservas(reservasResult.data || []);
    setPagamentos(pagamentosResult.data || []);
    setTarefas(tarefasResult.data || []);
    setAcervo(acervoResult.data || []);
    setDisponibilidade(Object.fromEntries((disponibilidadeResult.data || []).map((item) => [item.acervo_id, item])));
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { loadDetails(selectedEvent); }, [loadDetails, selectedEvent]);

  const paymentTotals = useMemo(() => ({
    total: pagamentos.reduce((sum, item) => sum + Number(item.valor), 0),
    paid: pagamentos.filter((item) => item.status === 'PAGO').reduce((sum, item) => sum + Number(item.valor), 0),
  }), [pagamentos]);

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
        <div style={{ ...panel, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
          <div><small>Cliente</small><strong style={{ display: 'block' }}>{selectedEvent.deals?.leads?.nome || 'Não informado'}</strong></div>
          <div><small>Data e horário</small><strong style={{ display: 'block' }}>{new Date(`${selectedEvent.data_evento}T12:00:00`).toLocaleDateString('pt-BR')} · {selectedEvent.horario}</strong></div>
          <div><small>Valor do evento</small><strong style={{ display: 'block' }}>{money(selectedEvent.deals?.valor_total)}</strong></div>
          <div><small>Recebido</small><strong style={{ display: 'block', color: 'var(--success)' }}>{money(paymentTotals.paid)}</strong></div>
        </div>

        <section style={{ ...panel, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}><h3 style={{ margin: 0, display: 'flex', gap: '0.4rem', alignItems: 'center' }}><Package size={19} /> Acervo reservado</h3><Button size="sm" icon={Plus} onClick={() => setModal('reserva')}>Reservar item</Button></div>
          {reservas.length === 0 ? <span style={{ color: 'var(--text-secondary)' }}>Nenhum item reservado ainda.</span> : reservas.map((item) => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.7rem' }}><span><strong>{item.acervo?.nome}</strong> · {item.quantidade} un. <small>({item.data_inicio} a {item.data_fim})</small></span><select value={item.status} onChange={(event) => update('acervo_reservas', item.id, { status: event.target.value })} style={{ ...field, width: '145px', padding: '0.3rem' }}><option value="RESERVADO">Reservado</option><option value="SEPARADO">Separado</option><option value="ENTREGUE">Entregue</option><option value="DEVOLVIDO">Devolvido</option><option value="MANUTENCAO">Manutenção</option><option value="CANCELADO">Cancelado</option></select></div>)}
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
