import React, { useState, useEffect } from 'react';
import { Package, Search, Plus, Edit2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabaseClient';
import Button from './ui/Button';
import Modal from './ui/Modal';
import styles from './Acervo.module.css';

export default function Acervo() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    categoria: 'Tema',
    localizacao: '',
    apelidos: '',
    observacoes: '',
    quantidade_total: 1,
    ativo: true
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('acervo')
      .select('*')
      .order('nome', { ascending: true });
      
    if (!error && data) {
      setItems(data);
    } else {
      console.error('Erro ao buscar acervo:', error);
    }
    setLoading(false);
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setIsEditing(true);
      setCurrentId(item.id);
      setFormData({
        nome: item.nome || '',
        categoria: item.categoria || 'Tema',
        localizacao: item.localizacao || '',
        apelidos: item.apelidos ? item.apelidos.join(', ') : '',
        observacoes: item.observacoes || '',
        quantidade_total: item.quantidade_total || 1,
        ativo: item.ativo
      });
    } else {
      setIsEditing(false);
      setCurrentId(null);
      setFormData({
        nome: '',
        categoria: 'Tema',
        localizacao: '',
        apelidos: '',
        observacoes: '',
        quantidade_total: 1,
        ativo: true
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Convert apelidos string to array
    const apelidosArray = formData.apelidos
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const payload = {
      nome: formData.nome,
      categoria: formData.categoria,
      localizacao: formData.localizacao,
      apelidos: apelidosArray,
      observacoes: formData.observacoes,
      quantidade_total: Number(formData.quantidade_total),
      ativo: formData.ativo
    };

    if (isEditing) {
      const { error } = await supabase
        .from('acervo')
        .update(payload)
        .eq('id', currentId);
      if (!error) fetchItems();
    } else {
      const { error } = await supabase
        .from('acervo')
        .insert(payload);
      if (!error) fetchItems();
    }
    
    setIsSaving(false);
    setShowModal(false);
  };

  const handleToggleActive = async (id, currentStatus) => {
    const { error } = await supabase
      .from('acervo')
      .update({ ativo: !currentStatus })
      .eq('id', id);
    if (!error) fetchItems();
  };

  const categories = ['Todas', ...new Set(items.map(i => i.categoria))];
  
  const filteredItems = items.filter(i => {
    const matchesSearch = i.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (i.apelidos && i.apelidos.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()))) ||
                          (i.localizacao && i.localizacao.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'Todas' || i.categoria === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}><Package size={28} color="var(--primary)" /> Inventário (Acervo)</h2>
          <p className={styles.subtitle}>Gerencie temas, painéis, peças e onde estão guardados.</p>
        </div>
        <Button icon={Plus} onClick={() => handleOpenModal()}>Novo Item</Button>
      </header>

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <Search size={20} color="var(--gray-400)" />
          <input 
            type="text" 
            placeholder="Pesquisar por nome, localização ou apelido..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className={styles.filterSelect}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando inventário...</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Nome</th>
                <th>Categoria</th>
                <th>Qtd.</th>
                <th>Localização</th>
                <th>Apelidos (Tags)</th>
                <th className={styles.actionsColumn}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className={styles.emptyState}>Nenhum item encontrado.</td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className={!item.ativo ? styles.inactiveRow : ''}>
                    <td className={styles.statusCell}>
                      {item.ativo 
                        ? <span className={styles.badgeActive}><CheckCircle2 size={14}/> Ativo</span>
                        : <span className={styles.badgeInactive}><EyeOff size={14}/> Inativo</span>
                      }
                    </td>
                    <td className={styles.nomeCell}>
                      <strong>{item.nome}</strong>
                      {item.observacoes && <span className={styles.obsIcon} title={item.observacoes}><AlertCircle size={14}/></span>}
                    </td>
                    <td><span className={styles.categoryBadge}>{item.categoria}</span></td>
                    <td>{item.quantidade_total || 1}</td>
                    <td>{item.localizacao ? <span className={styles.locationBadge} style={{ display: 'inline-flex', alignItems: 'center' }}><Package size={14} style={{ marginRight: 4 }} /> {item.localizacao}</span> : '-'}</td>
                    <td className={styles.aliasesCell}>
                      {item.apelidos && item.apelidos.length > 0 
                        ? item.apelidos.map(a => <span key={a} className={styles.aliasTag}>{a}</span>)
                        : <span className={styles.emptyText}>-</span>}
                    </td>
                    <td className={styles.actionsCell}>
                      <button className={styles.actionBtn} onClick={() => handleOpenModal(item)} title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button 
                        className={styles.actionBtn} 
                        onClick={() => handleToggleActive(item.id, item.ativo)}
                        title={item.ativo ? "Desativar" : "Reativar"}
                      >
                        {item.ativo ? <EyeOff size={18} color="var(--gray-500)"/> : <Eye size={18} color="var(--primary)"/>}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal 
          title={isEditing ? 'Editar Item' : 'Novo Item no Acervo'} 
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.formRow}>
              <div className={styles.formGroup} style={{ flex: 2 }}>
                <label>Nome do Item *</label>
                <input 
                  type="text" 
                  required 
                  value={formData.nome} 
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  placeholder="Ex: Stitch"
                />
              </div>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label>Categoria *</label>
                <select 
                  required 
                  value={formData.categoria} 
                  onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                >
                  <option value="Tema">Tema</option>
                  <option value="Painel">Painel</option>
                  <option value="Mesa">Mesa</option>
                  <option value="Peça">Peça</option>
                  <option value="Kit">Kit Completo</option>
                </select>
              </div>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label>Quantidade disponível *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.quantidade_total}
                  onChange={(e) => setFormData({...formData, quantidade_total: e.target.value})}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Localização (Guarda)</label>
                <input 
                  type="text" 
                  value={formData.localizacao} 
                  onChange={(e) => setFormData({...formData, localizacao: e.target.value})}
                  placeholder="Ex: Papel 2, Prateleira A"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Apelidos (Separados por vírgula)</label>
                <input 
                  type="text" 
                  value={formData.apelidos} 
                  onChange={(e) => setFormData({...formData, apelidos: e.target.value})}
                  placeholder="Ex: Homem Aranha, Miranha, Spider"
                />
                <small>Ajuda na busca e na Inteligência Artificial.</small>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Observações</label>
              <textarea 
                value={formData.observacoes} 
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                placeholder="Detalhes extras sobre estado de conservação ou componentes inclusos."
                rows="2"
              />
            </div>
            
            <div className={styles.checkboxGroup}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={formData.ativo}
                  onChange={(e) => setFormData({...formData, ativo: e.target.checked})}
                />
                <span>Item Ativo (Visível para novos orçamentos)</span>
              </label>
            </div>

            <div className={styles.modalActions}>
              <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" loading={isSaving}>
                {isEditing ? 'Salvar Alterações' : 'Cadastrar Item'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
