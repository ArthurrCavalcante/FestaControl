import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import styles from './GeradorOrcamento.module.css';
import { toast } from 'react-hot-toast';
import { useCompany } from '../hooks/useCompany';

// UI
import Modal from './ui/Modal';
import Button from './ui/Button';

// Icons
import { 
  Calculator, 
  Package, 
  Truck, 
  CheckCircle2, 
  Copy, 
  MessageCircle, 
  PartyPopper,
  Save
} from 'lucide-react';

export default function GeradorOrcamento({ onClose, onAddLead, prefilledLead = null }) {
  const { settings } = useCompany();
  const [step, setStep] = useState(1); // 1: Cliente/Kit, 2: Resumo/Link
  
  const [nomeLead, setNomeLead] = useState(prefilledLead ? prefilledLead.nome : '');
  const [telefoneLead, setTelefoneLead] = useState(prefilledLead ? prefilledLead.telefone : '');
  const [kitEscolhido, setKitEscolhido] = useState('');
  const [dataFesta, setDataFesta] = useState('');
  const [enderecoFesta, setEnderecoFesta] = useState('');
  const [itensFesta, setItensFesta] = useState('');
  const [horaFesta, setHoraFesta] = useState('');
  const [temaFesta, setTemaFesta] = useState('');
  const [acervoTemas, setAcervoTemas] = useState([]);
  const [modalidade, setModalidade] = useState('PEGUE_MONTE');
  const [link, setLink] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [kits, setKits] = useState([]);

  useEffect(() => {
    const fetchKits = async () => {
      const { data, error } = await supabase.from('kits').select('*').eq('disponivel', true);
      if (!error && data) {
        setKits(data);
      }
    };
    const fetchAcervoTemas = async () => {
      const { data, error } = await supabase
        .from('acervo')
        .select('id, nome, apelidos')
        .eq('categoria', 'Tema')
        .eq('ativo', true);
      if (!error && data) {
        setAcervoTemas(data);
      }
    };
    fetchKits();
    fetchAcervoTemas();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const handleGerar = async () => {
    if (!nomeLead || !dataFesta) {
      toast.error('Por favor, preencha todos os campos obrigatórios (Nome e Data)!');
      return;
    }
    
    setIsSaving(true);
    const kit = kits.find(k => k.id === kitEscolhido);

    let currentLeadId = prefilledLead?.id;

    if (currentLeadId) {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ nome: nomeLead, telefone: telefoneLead || 'Não informado' })
        .eq('id', currentLeadId);
      
      if (updateError) {
        toast.error('Erro ao atualizar contato.');
        setIsSaving(false);
        return;
      }
    } else {
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .insert([{ nome: nomeLead, telefone: telefoneLead || 'Não informado', origem: 'Manual' }])
        .select()
        .single();

      if (leadError) {
        console.error('Erro ao criar lead:', leadError);
        toast.error('Erro ao criar lead no banco.');
        setIsSaving(false);
        return;
      }
      currentLeadId = leadData.id;
    }

    let finalTemaId = null;
    let finalTemaNome = temaFesta || (kit ? kit.nome : 'Tema a definir');

    if (temaFesta) {
      const match = acervoTemas.find(t => t.nome.toLowerCase() === temaFesta.toLowerCase() || (t.apelidos && t.apelidos.some(a => a.toLowerCase() === temaFesta.toLowerCase())));
      if (match) {
        finalTemaId = match.id;
        finalTemaNome = match.nome;
      }
    }

    const { error: dealError } = await supabase
      .from('deals')
      .insert([{
        lead_id: currentLeadId,
        status_funil: 'NOVOS',
        modalidade: modalidade,
        tema: finalTemaNome,
        tema_id: finalTemaId,
        valor_total: kit ? kit.preco : 0,
        data_festa: dataFesta,
        endereco: enderecoFesta,
        itens_selecionados: itensFesta
      }]);

    if (dealError) {
      console.error('Erro ao criar deal:', dealError);
      toast.error('Erro ao criar orçamento no banco.');
      setIsSaving(false);
      return;
    }
    
    const companyName = settings?.companies?.nome || 'FestaFlow';
    const msg = `Olá ${nomeLead}! 🥳\nAqui é da ${companyName}. Segue o orçamento para a sua festa:\n\n*Tema:* ${finalTemaNome}\n*Data:* ${dataFesta || 'A definir'} às ${horaFesta || 'A definir'}\n*Itens Inclusos:* ${itensFesta || 'Padrão do kit'}\n*Total:* R$ ${kit?.preco.toFixed(2) || '0.00'}\n\nPara confirmar a reserva e garantir a data, peço um sinal de 50%. Como prefere fazer?`;
    const zapLink = `https://wa.me/55${telefoneLead.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    setLink(zapLink);

    if(onAddLead) onAddLead();
    
    setIsSaving(false);
    toast.success('Orçamento gerado com sucesso!');
    setStep(2);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  return (
    <Modal 
      isOpen={true} 
      onClose={onClose} 
      title="Novo Orçamento Expresso" 
      icon={Calculator}
      maxWidth="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, paddingBottom: '1.5rem' }}>
          {step === 1 ? (
            <div className={styles.formGrid}>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nome do Lead *</label>
                <input 
                  type="text" 
                  value={nomeLead} 
                  onChange={(e) => setNomeLead(e.target.value)} 
                  placeholder="Ex: João Gomes" 
                  className={styles.formInput} 
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Telefone / WhatsApp</label>
                <input 
                  type="text" 
                  value={telefoneLead} 
                  onChange={(e) => setTelefoneLead(e.target.value)} 
                  placeholder="(85) 99999-9999" 
                  className={styles.formInput} 
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Kit Escolhido (Opcional)</label>
                <select 
                  value={kitEscolhido} 
                  onChange={(e) => setKitEscolhido(e.target.value)} 
                  className={styles.formSelect}
                >
                  <option value="">Selecione um pacote</option>
                  {kits.map(k => <option key={k.id} value={k.id}>{k.nome} - R${k.preco.toFixed(2)}</option>)}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tema da Festa (Opcional)</label>
                <input 
                  type="text" 
                  list="temas-datalist"
                  value={temaFesta} 
                  onChange={(e) => setTemaFesta(e.target.value)} 
                  placeholder="Ex: Safari, Princesas..." 
                  className={styles.formInput} 
                />
                <datalist id="temas-datalist">
                  {acervoTemas.map(tema => (
                    <option key={tema.id} value={tema.nome} />
                  ))}
                </datalist>
              </div>

              <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.formLabel}>Data da Festa *</label>
                  <input 
                    type="date" 
                    min={today} 
                    value={dataFesta} 
                    onChange={(e) => setDataFesta(e.target.value)} 
                    className={styles.formInput} 
                  />
                </div>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.formLabel}>Horário (Opcional)</label>
                  <input 
                    type="time" 
                    value={horaFesta} 
                    onChange={(e) => setHoraFesta(e.target.value)} 
                    className={styles.formInput} 
                  />
                </div>
              </div>

              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.formLabel}>Endereço da Festa / Local</label>
                <input 
                  type="text" 
                  value={enderecoFesta} 
                  onChange={(e) => setEnderecoFesta(e.target.value)} 
                  placeholder="Rua, Número, Bairro (ou 'A definir')" 
                  className={styles.formInput} 
                />
              </div>

              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.formLabel}>Móveis / Observações (Opcional)</label>
                <textarea 
                  value={itensFesta} 
                  onChange={(e) => setItensFesta(e.target.value)} 
                  placeholder="Ex: Adicionar 1 cilindro a mais..." 
                  className={styles.formTextarea}
                ></textarea>
              </div>

              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.formLabel}>Modalidade da Festa</label>
                <div className={styles.modalityGrid}>
                  <button 
                    className={`${styles.modalityBtn} ${modalidade === 'PEGUE_MONTE' ? styles.active : ''}`}
                    onClick={() => setModalidade('PEGUE_MONTE')} 
                  >
                    <Package className={styles.modalityIcon} size={28} />
                    Pegue e Monte
                  </button>
                  <button 
                    className={`${styles.modalityBtn} ${modalidade === 'FRETADA' ? styles.active : ''}`}
                    onClick={() => setModalidade('FRETADA')} 
                  >
                    <Truck className={styles.modalityIcon} size={28} />
                    Fretada
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.successState}>
              <div className={styles.successIconWrapper}>
                <PartyPopper size={40} />
              </div>
              <h2 className={styles.successTitle}>Orçamento Gerado!</h2>
              <p className={styles.successText}>
                O orçamento foi salvo no Pipeline. Envie a mensagem automática para o cliente no WhatsApp abaixo.
              </p>

              <div className={styles.linkBox}>
                <span className={styles.linkText}>{link}</span>
                <Button variant="secondary" icon={Copy} onClick={handleCopy}>
                  Copiar
                </Button>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <a href={link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" size="lg" icon={MessageCircle} style={{ background: '#25D366', border: 'none' }}>
                    Abrir no WhatsApp
                  </Button>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          {step === 1 ? (
            <>
              <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
              <Button variant="primary" icon={Save} onClick={handleGerar} disabled={isSaving}>
                {isSaving ? 'Gerando... ⏳' : 'Gerar Orçamento'}
              </Button>
            </>
          ) : (
            <Button variant="success" icon={CheckCircle2} onClick={onClose}>Concluir e Voltar</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
