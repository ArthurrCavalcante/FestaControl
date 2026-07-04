import React, { useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { toast } from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import { FileText, Copy, UploadCloud, Users, AlertCircle } from 'lucide-react';

export default function ImportarClientesModal({ onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('paste'); // 'paste' ou 'upload'
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState(null);



  // Normaliza o número de telefone (remove não-números, adiciona +55 e garante DDD)
  const formatPhone = (phone) => {
    let num = phone.replace(/\D/g, '');
    if (num.length === 0) return null;
    if (num.length === 8 || num.length === 9) num = '85' + num; // Assume DDD 85 se não tiver (exemplo para Ceará)
    if (num.length === 10 || num.length === 11) num = '55' + num;
    if (num.length > 13) num = num.substring(0, 13);
    return `+${num}`;
  };

  const processText = async (text) => {
    const lines = text.split('\n');
    const parsedContacts = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Quebra por vírgula, ponto e vírgula ou tab, ignorando aspas duplas iniciais/finais
      const parts = line.split(/[,;\t]/).map(p => p.replace(/^"|"$/g, '').trim());
      
      let nome = '';
      let telefoneRaw = '';

      for (let part of parts) {
        if (!part) continue;
        
        // Se tem 8+ números, consideramos telefone (pega o primeiro que achar)
        const numCount = (part.match(/\d/g) || []).length;
        if (numCount >= 8 && !telefoneRaw) {
          telefoneRaw = part;
        } 
        // Se tem letras e não é telefone, é o nome
        else if (part.match(/[A-Za-z]/) && !nome && numCount < 5) {
          // Ignora cabeçalhos comuns de planilhas
          const lower = part.toLowerCase();
          if (!lower.includes('phone') && !lower.includes('name') && lower !== 'nome' && lower !== 'telefone') {
             nome = part;
          }
        }
      }

      if (nome && telefoneRaw) {
        const telefoneFormated = formatPhone(telefoneRaw);
        if (telefoneFormated) {
          parsedContacts.push({ nome, telefone: telefoneFormated });
        }
      }
    }

    if (parsedContacts.length === 0) {
      toast.error('Não encontramos nenhum contato válido. Verifique o formato do arquivo ou texto.');
      return;
    }

    setIsProcessing(true);
    // Deduplicação (checar no banco se o telefone já existe)
    const phones = parsedContacts.map(c => c.telefone);
    const { data: existingLeads, error } = await supabase
      .from('leads')
      .select('telefone')
      .in('telefone', phones);

    const existingPhones = new Set((existingLeads || []).map(l => l.telefone));
    
    let novos = [];
    let duplicados = 0;

    // Deduplica localmente primeiro
    const localPhones = new Set();

    parsedContacts.forEach(contact => {
      if (existingPhones.has(contact.telefone) || localPhones.has(contact.telefone)) {
        duplicados++;
      } else {
        novos.push(contact);
        localPhones.add(contact.telefone);
      }
    });

    setPreviewData({
      total: parsedContacts.length,
      novos,
      duplicados
    });
    
    setIsProcessing(false);
  };

  const handlePreview = () => {
    if (rawText.trim() === '') {
      toast.error('Cole alguns contatos primeiro.');
      return;
    }
    processText(rawText);
  };

  const handleImport = async () => {
    if (!previewData || previewData.novos.length === 0) {
      toast.error('Nenhum contato novo para importar.');
      return;
    }

    setIsProcessing(true);
    const payload = previewData.novos.map(c => ({
      nome: c.nome,
      telefone: c.telefone,
      origem: 'Importação'
    }));

    const { error } = await supabase.from('leads').insert(payload);

    if (error) {
      console.error(error);
      toast.error('Erro ao salvar no banco de dados.');
      setIsProcessing(false);
    } else {
      toast.success(`${previewData.novos.length} contatos importados com sucesso!`);
      onSuccess();
    }
  };

  return (
    <Modal title="Importação em Massa" onClose={onClose}>
      
      {!previewData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '500px', maxWidth: '100%' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Traga seus contatos do WhatsApp e agendas antigas para o FestaFlow.
          </p>

          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <Button 
              variant={activeTab === 'paste' ? 'primary' : 'ghost'} 
              icon={Copy} 
              onClick={() => setActiveTab('paste')}
            >
              Colar Texto
            </Button>
            <Button 
              variant={activeTab === 'upload' ? 'primary' : 'ghost'} 
              icon={UploadCloud} 
              onClick={() => setActiveTab('upload')}
            >
              Upload Planilha CSV
            </Button>
          </div>

          {activeTab === 'paste' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Cole sua lista aqui (Um por linha)</label>
              <div style={{ background: 'var(--surface-hover)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong>Formato aceito:</strong> Nome, Telefone <br/>
                <em>Exemplo:</em> <br/>
                Maria da Silva, 11999999999 <br/>
                João Souza - (85) 98888-8888
              </div>
              <textarea 
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Cole os contatos aqui..."
                rows={8}
                style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', resize: 'vertical' }}
              />
            </div>
          )}

          {activeTab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', border: '2px dashed var(--border-color)', borderRadius: '12px', background: 'var(--surface-color)' }}>
              <UploadCloud size={48} color="var(--text-secondary)" />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, margin: '0 0 0.5rem 0' }}>Selecione o arquivo CSV</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Google Contacts, Planilha Excel ou WhatsApp.</p>
              </div>
              <input 
                type="file" 
                accept=".csv,.txt"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setRawText(ev.target.result);
                    processText(ev.target.result);
                  };
                  reader.readAsText(file);
                }}
                style={{ marginTop: '1rem' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            {activeTab === 'paste' && (
              <Button variant="primary" onClick={handlePreview} loading={isProcessing}>
                Analisar Texto Colado
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '500px', maxWidth: '100%' }}>
          <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'var(--surface-hover)', borderRadius: '12px' }}>
            <Users size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{previewData.total} Contatos Lidos</h3>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{previewData.novos.length}</span>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Prontos para importar</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>{previewData.duplicados}</span>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Duplicados (Ignorados)</p>
              </div>
            </div>
          </div>

          {previewData.duplicados > 0 && (
            <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: 'var(--warning-light, rgba(245,158,11,0.1))', color: '#b45309', borderRadius: '8px', alignItems: 'center' }}>
              <AlertCircle size={20} />
              <p style={{ fontSize: '0.85rem', margin: 0 }}>Os contatos duplicados já existem na sua base e não serão inseridos novamente para evitar bagunça.</p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <Button variant="ghost" onClick={() => setPreviewData(null)}>Voltar e Editar</Button>
            <Button variant="primary" onClick={handleImport} loading={isProcessing} disabled={previewData.novos.length === 0}>
              Confirmar Importação
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
