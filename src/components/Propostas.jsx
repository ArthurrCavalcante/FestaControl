import { useEffect, useMemo, useState } from 'react';
import { Copy, FilePlus2, Plus, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import styles from './Saas.module.css';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const blankItem = () => ({ description: '', quantity: 1, unit_price: '', unit_cost: '', acervo_id: '' });

export default function Propostas() {
  const [proposals, setProposals] = useState([]);
  const [deals, setDeals] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState({});
  const [form, setForm] = useState({ deal_id: '', customer_name: '', event_date: '', event_address: '', theme: '', valid_until: '', discount: 0, terms: 'O evento será confirmado após o pagamento do sinal.', items: [blankItem()] });

  const load = async () => {
    const [{ data: response }, { data: dealRows }, { data: inventoryRows }] = await Promise.all([
      supabase.functions.invoke('proposal-service', { method: 'GET' }),
      supabase.from('deals').select('id, tema, data_festa, endereco, leads(nome, telefone)').order('created_at', { ascending: false }),
      supabase.from('acervo').select('id, nome').eq('ativo', true).order('nome'),
    ]);
    setProposals(response?.proposals ?? []);
    setDeals(dealRows ?? []);
    setInventory(inventoryRows ?? []);
  };

  useEffect(() => { load(); }, []);
  const total = useMemo(() => form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0) - Number(form.discount || 0), [form]);

  const selectDeal = (dealId) => {
    const deal = deals.find((row) => row.id === dealId);
    setForm((current) => ({
      ...current, deal_id: dealId, customer_name: deal?.leads?.nome || '', event_date: deal?.data_festa || '',
      event_address: deal?.endereco || '', theme: deal?.tema || '',
    }));
  };
  const updateItem = (index, key, value) => setForm((current) => ({
    ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
  }));

  const createProposal = async (event) => {
    event.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('proposal-service', { body: { action: 'create', ...form } });
    setBusy(false);
    if (error) return toast.error(error.message);
    setLinks((current) => ({ ...current, [data.proposal.id]: `${window.location.origin}/proposta/${data.token}` }));
    setShowForm(false);
    setForm({ deal_id: '', customer_name: '', event_date: '', event_address: '', theme: '', valid_until: '', discount: 0, terms: 'O evento será confirmado após o pagamento do sinal.', items: [blankItem()] });
    toast.success('Proposta criada. Revise e envie quando estiver pronta.');
    await load();
  };

  const sendProposal = async (proposalId) => {
    const { data, error } = await supabase.functions.invoke('proposal-service', { body: { action: 'send', proposal_id: proposalId } });
    if (error) return toast.error(error.message);
    const link = `${window.location.origin}/proposta/${data.token}`;
    setLinks((current) => ({ ...current, [proposalId]: link }));
    await navigator.clipboard.writeText(link);
    toast.success('Link enviado para a área de transferência.');
    await load();
  };

  const confirmDeposit = async (proposal) => {
    const amount = window.prompt('Valor do sinal recebido:');
    if (!amount) return;
    const { error } = await supabase.functions.invoke('proposal-service', {
      body: { action: 'deposit_received', proposal_id: proposal.id, amount: Number(String(amount).replace(',', '.')), method: 'PIX' },
    });
    if (error) return toast.error(error.message);
    toast.success('Sinal registrado, evento confirmado e acervo reservado.');
    await load();
  };

  return (
    <section className={styles.shell}>
      <div className={styles.topbar}>
        <div><h2>Propostas</h2><p className={styles.muted}>Aceite, sinal e margem por versão.</p></div>
        <button className={styles.button} onClick={() => setShowForm((value) => !value)}><FilePlus2 size={18} /> Nova proposta</button>
      </div>

      {showForm ? (
        <form className={styles.form} onSubmit={createProposal}>
          <div className={styles.grid}>
            <label className={styles.field}>Negócio<select value={form.deal_id} onChange={(event) => selectDeal(event.target.value)}><option value="">Sem negócio vinculado</option>{deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.leads?.nome || 'Cliente'} · {deal.tema || 'Sem tema'}</option>)}</select></label>
            <label className={styles.field}>Cliente<input required minLength="2" value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} /></label>
            <label className={styles.field}>Data do evento<input type="date" value={form.event_date} onChange={(event) => setForm({ ...form, event_date: event.target.value })} /></label>
            <label className={styles.field}>Validade<input type="date" value={form.valid_until} onChange={(event) => setForm({ ...form, valid_until: event.target.value })} /></label>
            <label className={styles.field}>Tema<input value={form.theme} onChange={(event) => setForm({ ...form, theme: event.target.value })} /></label>
            <label className={styles.field}>Endereço<input value={form.event_address} onChange={(event) => setForm({ ...form, event_address: event.target.value })} /></label>
          </div>
          <h3>Itens</h3>
          {form.items.map((item, index) => (
            <div className={styles.grid} key={index}>
              <label className={styles.field}>Descrição<input required value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} /></label>
              <label className={styles.field}>Peça do acervo<select value={item.acervo_id} onChange={(event) => updateItem(index, 'acervo_id', event.target.value)}><option value="">Não vinculada</option>{inventory.map((row) => <option key={row.id} value={row.id}>{row.nome}</option>)}</select></label>
              <label className={styles.field}>Quantidade<input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} /></label>
              <label className={styles.field}>Preço unitário<input type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => updateItem(index, 'unit_price', event.target.value)} /></label>
              <label className={styles.field}>Custo unitário<input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => updateItem(index, 'unit_cost', event.target.value)} /></label>
              {form.items.length > 1 ? <button type="button" className={styles.buttonSecondary} onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={17} /> Remover</button> : null}
            </div>
          ))}
          <div className={styles.actions}><button type="button" className={styles.buttonSecondary} onClick={() => setForm({ ...form, items: [...form.items, blankItem()] })}><Plus size={17} /> Adicionar item</button></div>
          <div className={styles.grid}>
            <label className={styles.field}>Desconto<input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value })} /></label>
            <div><span className={styles.muted}>Total</span><div className={styles.total}>{currency.format(Math.max(total, 0))}</div></div>
          </div>
          <label className={styles.field}>Condições<textarea value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></label>
          <div className={styles.actions}><button className={styles.button} disabled={busy}>{busy ? 'Criando...' : 'Criar proposta'}</button><button type="button" className={styles.buttonSecondary} onClick={() => setShowForm(false)}>Cancelar</button></div>
        </form>
      ) : null}

      <div className={styles.list} style={{ marginTop: 24 }}>
        {proposals.length ? proposals.map((proposal) => (
          <article className={styles.row} key={proposal.id}>
            <div><strong>{proposal.customer_name}</strong> <span className={styles.status}>{proposal.status}</span><p className={styles.muted}>v{proposal.version} · {currency.format(proposal.total)} · margem estimada {currency.format(proposal.total - proposal.estimated_cost)}</p></div>
            <div className={styles.actions}>
              {links[proposal.id] ? <button className={styles.buttonSecondary} title="Copiar link" onClick={() => navigator.clipboard.writeText(links[proposal.id])}><Copy size={17} /></button> : null}
              {['draft', 'sent', 'viewed'].includes(proposal.status) ? <button className={styles.buttonSecondary} onClick={() => sendProposal(proposal.id)}><Send size={17} /> Gerar link</button> : null}
              {proposal.status === 'accepted' ? <button className={styles.button} onClick={() => confirmDeposit(proposal)}>Registrar sinal</button> : null}
            </div>
          </article>
        )) : <div className={styles.row}>Nenhuma proposta criada.</div>}
      </div>
    </section>
  );
}
