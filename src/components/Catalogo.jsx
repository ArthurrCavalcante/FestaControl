import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import styles from './Catalogo.module.css';

import Button from './ui/Button';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import Spinner from './ui/Spinner';
import Skeleton from './ui/Skeleton';
import ErrorState from './ui/ErrorState';
import ConfirmDialog from './ui/ConfirmDialog';
import { toast } from 'react-hot-toast';
import { deleteFotoCatalogo, deleteMultipleFotosCatalogo, logActivity } from '../services/dbService';
import { 
  Image as ImageIcon, 
  CheckSquare, 
  Trash2, 
  Wand2, 
  Search, 
  Palette, 
  Download, 
  Share2, 
  Edit2, 
  X, 
  Plus,
  Save,
  ImagePlus,
  Loader2,
  Check
} from 'lucide-react';

const isVideo = (urlOrName) => {
  if (!urlOrName) return false;
  const lower = urlOrName.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.includes('video/');
};

export default function Catalogo() {
  const [fotos, setFotos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [novoTema, setNovoTema] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [previews, setPreviews] = useState([]);
  const [fotoExpandida, setFotoExpandida] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [modalEditTema, setModalEditTema] = useState('');
  const [modalEditDescricao, setModalEditDescricao] = useState('');
  const [selectedFotos, setSelectedFotos] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isFetchingFotos, setIsFetchingFotos] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  
  const fileInputRef = useRef(null);

  const fetchFotos = async () => {
    setIsFetchingFotos(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from('catalogo_fotos')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setFotos(data);
    } else if (error) {
      console.error('Erro ao buscar fotos:', error);
      setFetchError(error.message);
    }
    setIsFetchingFotos(false);
  };

  useEffect(() => {
    fetchFotos();
  }, []);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    files.forEach(file => {
      if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
        toast.error(`Arquivo inválido: ${file.name}. Envie apenas JPG, PNG, WEBP ou MP4/WEBM/MOV.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviews(prev => [...prev, { 
          id: Math.random().toString(36).substring(7),
          file, 
          url: ev.target.result,
          tema: '',
          descricao: '',
          analyzing: false
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (idToRemove) => {
    setPreviews(prev => prev.filter(p => p.id !== idToRemove));
  };

  const updatePreviewField = (id, field, value) => {
    setPreviews(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  // Comprime a imagem para no máximo 1024px de lado e qualidade 0.7 (reduz de ~5MB para ~100KB)
  const compressImageForAI = (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressed.split(',')[1]);
      };
      img.onerror = () => resolve(dataUrl.split(',')[1]); // fallback: usa original
      img.src = dataUrl;
    });
  };

  const handleAnalyzeAll = async () => {
    if (previews.length === 0) return;

    setAnalyzing(true);
    let updated = [...previews];
    
    // Filtra os que precisam de análise
    const itemsToAnalyze = [];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].tema) continue;
      
      if (updated[i].file.type.startsWith('video/')) {
        updated[i].descricao = 'Preencha manualmente para vídeos.';
        continue;
      }
      
      itemsToAnalyze.push({ index: i, url: updated[i].url });
      updated[i].analyzing = true;
    }
    
    setPreviews([...updated]);

    if (itemsToAnalyze.length === 0) {
      setAnalyzing(false);
      return;
    }

    setUploadProgress({ current: 1, total: 1 }); // Representa 1 lote

    // Busca os temas do acervo
    const { data: acervoData } = await supabase.from('acervo').select('nome, apelidos').eq('categoria', 'Tema').eq('ativo', true);
    let temasCadastrados = acervoData ? acervoData.map(t => ({ nome: t.nome, apelidos: t.apelidos || [] })) : [];

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    try {
      // Comprimir todas as imagens do lote
      const compressedImages = await Promise.all(itemsToAnalyze.map(item => compressImageForAI(item.url)));
      
      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-theme`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          imagesBase64: compressedImages,
          temasCadastrados: temasCadastrados
        })
      });

      if (response.status === 429) {
        throw new Error("Limite de IA excedido (429)");
      }
      if (!response.ok) {
        throw new Error(`Erro do servidor (${response.status})`);
      }
      
      const results = await response.json();
      
      // O backend agora deve retornar um array de resultados na mesma ordem
      if (Array.isArray(results)) {
        results.forEach((json, idx) => {
          const originalIndex = itemsToAnalyze[idx].index;
          let temaAI = json.tema || "";
          if (temaAI.toLowerCase() === "desconhecido" || temaAI === "tema não identificado") {
            temaAI = "";
          }
          updated[originalIndex].tema = temaAI;
          
          const partes = [];
          if (json.cores?.length) partes.push('Cores: ' + json.cores.join(', '));
          if (json.itens?.length) partes.push('Itens: ' + json.itens.join(', '));
          if (json._debug_raw) partes.push('RAW: ' + json._debug_raw.substring(0, 50));
          updated[originalIndex].descricao = partes.join('. ');
          updated[originalIndex].analyzing = false;
        });
      }
    } catch (e) {
      console.error("Erro IA no lote", e);
      itemsToAnalyze.forEach(item => {
        updated[item.index].descricao = e.message.includes("429") 
          ? "Limite de IA excedido. Tente novamente mais tarde." 
          : "Erro ao analisar com IA. Preencha manualmente.";
        updated[item.index].analyzing = false;
      });
    }

    setPreviews([...updated]);
    setAnalyzing(false);
  };

  const handleUploadAll = async () => {
    if (previews.length === 0) return;

    setUploading(true);
    try {
      for (const preview of previews) {
        const temaFinal = preview.tema.trim() || novoTema.trim() || 'Sem Tema';
        const descFinal = preview.descricao.trim() || novaDescricao.trim() || null;

        const fileExt = preview.file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `fotos/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('Catalogo').upload(filePath, preview.file);
        if (uploadError) {
          console.error('Erro no upload:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage.from('Catalogo').getPublicUrl(filePath);

        await supabase.from('catalogo_fotos').insert([{
          tema: temaFinal,
          descricao: descFinal,
          foto_url: urlData.publicUrl,
          foto_path: filePath
        }]);
      }

      setPreviews([]);
      setNovoTema('');
      setNovaDescricao('');
      setShowUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchFotos();
      toast.success('Fotos salvas com sucesso!');
    } catch (err) {
      console.error('Erro geral:', err);
      toast.error('Ocorreu um erro ao subir as fotos.');
    } finally {
      setUploading(false);
    }
  };

  const removeFoto = (foto) => {
    setConfirmAction({
      title: 'Deletar Foto',
      message: `Tem certeza que deseja deletar a foto do tema "${foto.tema}"? Essa ação não pode ser desfeita.`,
      confirmText: 'Deletar',
      onConfirm: async () => {
        setConfirmAction(null);
        const { error: deleteDbError } = await deleteFotoCatalogo(foto.id, foto.foto_path);
        if (deleteDbError) {
            console.error('Erro ao deletar:', deleteDbError);
            toast.error('Erro ao deletar foto.');
        } else {
            setFotoExpandida(null);
            setIsEditingModal(false);
            fetchFotos();
            toast.success('Foto removida!');
        }
      }
    });
  };

  const handleSaveModalEdit = async () => {
    if (!modalEditTema.trim()) return;
    try {
      const { error } = await supabase.from('catalogo_fotos').update({
        tema: modalEditTema.trim(),
        descricao: modalEditDescricao.trim() || null
      }).eq('id', fotoExpandida.id);

      if (error) throw error;

      setFotoExpandida({
        ...fotoExpandida,
        tema: modalEditTema.trim(),
        descricao: modalEditDescricao.trim() || null
      });
      setIsEditingModal(false);
      fetchFotos();
      toast.success('Edições salvas!');
    } catch (e) {
      console.error("Erro ao salvar edição:", e);
      toast.error("Erro ao salvar as edições.");
    }
  };

  const handleDeleteTheme = (tema) => {
    setConfirmAction({
      title: 'Apagar Álbum Inteiro',
      message: `Tem certeza que deseja apagar TODO o álbum "${tema}"? Todas as fotos serão perdidas e não poderão ser recuperadas.`,
      confirmText: 'Apagar Álbum',
      onConfirm: async () => {
        setConfirmAction(null);
        const fotosDoTema = fotos.filter(f => f.tema === tema);
        if (!fotosDoTema || fotosDoTema.length === 0) return;

        const ids = fotosDoTema.map(f => f.id);
        const paths = fotosDoTema.map(f => f.foto_path);

        const { error: deleteDbError } = await deleteMultipleFotosCatalogo(ids, paths);
        if (deleteDbError) {
            console.error('Erro ao deletar álbum:', deleteDbError);
            toast.error('Erro ao apagar álbum.');
        } else {
            fetchFotos();
            toast.success(`Álbum ${tema} apagado.`);
        }
      }
    });
  };

  const handleDownload = async (foto) => {
    try {
      const res = await fetch(foto.foto_url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = isVideo(foto.foto_url) ? 'mp4' : 'jpg';
      a.download = `${foto.tema.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch(e) {
      console.error(e);
      toast.error('Erro ao baixar a imagem.');
    }
  };

  const handleShare = async (foto) => {
    try {
      const res = await fetch(foto.foto_url);
      const blob = await res.blob();
      const ext = isVideo(foto.foto_url) ? 'mp4' : 'jpg';
      const file = new File([blob], `${foto.tema.replace(/[^a-z0-9]/gi, '_')}.${ext}`, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: foto.tema
        });
      } else {
        toast('Seu navegador não suporta compartilhamento nativo.', { icon: 'ℹ️' });
      }
    } catch (e) {
      console.error(e);
      if (e.name !== 'AbortError') toast.error('Erro ao processar a imagem.');
    }
  };

  const toggleSelection = (e, fotoId) => {
    e.stopPropagation();
    setSelectedFotos(prev => prev.includes(fotoId) ? prev.filter(id => id !== fotoId) : [...prev, fotoId]);
  };

  const handleDeleteSelected = () => {
    setConfirmAction({
      title: 'Deletar Múltiplas Fotos',
      message: `Tem certeza que deseja apagar as ${selectedFotos.length} fotos selecionadas? Essa ação é irreversível.`,
      confirmText: 'Apagar Seleção',
      onConfirm: async () => {
        setConfirmAction(null);
        const fotosToDelete = fotos.filter(f => selectedFotos.includes(f.id));
        const paths = fotosToDelete.map(f => f.foto_path);
        
        const { error: deleteDbError } = await deleteMultipleFotosCatalogo(selectedFotos, paths);

        if (deleteDbError) {
          console.error('Erro ao remover arquivos:', deleteDbError);
          toast.error('Erro ao apagar fotos.');
        } else {
          setSelectedFotos([]);
          setIsSelectionMode(false);
          fetchFotos();
          toast.success(`${selectedFotos.length} fotos apagadas.`);
        }
      }
    });
  };

  const fotosFiltradas = fotos.filter(f =>
    f.tema.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.descricao && f.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const temas = {};
  fotosFiltradas.forEach(f => {
    if (!temas[f.tema]) temas[f.tema] = [];
    temas[f.tema].push(f);
  });
  const temasOrdenados = Object.keys(temas).sort();

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h2><ImageIcon size={32} color="var(--primary)" /> Galeria de Temas</h2>
          <p>
            Suba fotos das suas festas e encontre qualquer tema em segundos.
            <span className={styles.titleCount}>{fotos.length} foto{fotos.length !== 1 ? 's' : ''}</span>
          </p>
        </div>
      </div>
        
      <div className={styles.stickyHeader}>
        <div className={styles.actionArea}>
          {isSelectionMode ? (
            <>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedFotos.length} selecionadas</span>
              <Button 
                variant="danger" 
                icon={Trash2} 
                onClick={handleDeleteSelected}
                disabled={selectedFotos.length === 0}
              >
                Apagar {selectedFotos.length}
              </Button>
              <Button variant="secondary" onClick={() => { setIsSelectionMode(false); setSelectedFotos([]); }}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button variant="secondary" icon={CheckSquare} onClick={() => setIsSelectionMode(true)}>
              Selecionar Várias
            </Button>
          )}
          
          <Button 
            variant={showUpload ? 'danger' : 'primary'} 
            icon={showUpload ? X : Plus}
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? 'Fechar' : 'Nova Foto'}
          </Button>
        </div>

        {/* Barra de Busca */}
        <div className={styles.searchBar}>
          <Search className={styles.searchIcon} size={24} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por tema... (Ex: Safari, Frozen)"
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Upload Panel */}
      {showUpload && (
        <div className={styles.uploadPanel}>
          <div className={styles.uploadHeader}>
            <div>
              <h3 className={styles.uploadTitle}><Wand2 size={24} /> Assistente de IA</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Selecione as fotos. A IA vai analisar cada uma e preencher os temas para você revisar.
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Button variant="secondary" icon={ImagePlus} onClick={() => fileInputRef.current?.click()}>
                Adicionar Fotos
              </Button>
              {previews.length > 0 && (
                <Button 
                  variant="primary" 
                  icon={analyzing ? Loader2 : Wand2} 
                  onClick={handleAnalyzeAll}
                  disabled={analyzing || uploading}
                  style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)', border: 'none' }}
                >
                  {analyzing ? `Processando ${uploadProgress.current}/${uploadProgress.total}...` : 'Auto-Preencher com IA'}
                </Button>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          {previews.length > 0 && (
            <div className={styles.previewGrid}>
              {previews.map((preview) => (
                <div key={preview.id} className={styles.previewItem}>
                  
                  <div className={styles.previewImage} style={preview.file.type.startsWith('video/') ? {} : { backgroundImage: `url(${preview.url})` }}>
                    {preview.file.type.startsWith('video/') && (
                      <video src={preview.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted loop autoPlay playsInline />
                    )}
                    {preview.analyzing && (
                      <div className={styles.analyzingOverlay}>
                        <Loader2 className="spin" size={32} />
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.previewFields}>
                    <div>
                      <label className={styles.inputLabel}>Tema</label>
                      <input
                        type="text"
                        value={preview.tema}
                        onChange={(e) => updatePreviewField(preview.id, 'tema', e.target.value)}
                        placeholder="Ex: Safari, Princesas..."
                        className={styles.textInput}
                      />
                    </div>
                    <div>
                      <label className={styles.inputLabel}>Descrição / Detalhes</label>
                      <input
                        type="text"
                        value={preview.descricao}
                        onChange={(e) => updatePreviewField(preview.id, 'descricao', e.target.value)}
                        placeholder="Cores e itens do kit..."
                        className={styles.textInput}
                      />
                    </div>
                  </div>

                  <button className={styles.removePreviewBtn} onClick={() => removeFile(preview.id)}>
                    <X size={16} />
                  </button>
                </div>
              ))}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <Button 
                  variant="success" 
                  size="lg"
                  icon={Save}
                  onClick={handleUploadAll}
                  disabled={uploading || analyzing}
                >
                  {uploading ? 'Salvando no Banco...' : 'Confirmar e Salvar Todas'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}



      {/* Galeria */}
      <div className={styles.galleryArea}>
        {isFetchingFotos ? (
          <div style={{ marginTop: '4rem', display: 'flex', justifyContent: 'center' }}>
            <Spinner size={36} label="Carregando galeria..." />
          </div>
        ) : fetchError ? (
          <div style={{ marginTop: '4rem' }}>
             <ErrorState 
                title="Não foi possível carregar a galeria" 
                description="Houve um problema de conexão com o servidor."
                onRetry={fetchFotos}
             />
          </div>
        ) : temasOrdenados.length === 0 ? (
          <div style={{ marginTop: '4rem' }}>
            <EmptyState 
              icon={ImageIcon}
              title={searchTerm ? 'Nenhum tema encontrado' : 'Sua galeria está vazia'}
              description={searchTerm 
                ? `Não encontramos fotos com o termo "${searchTerm}".` 
                : 'Clique em "Nova Foto" para adicionar imagens ao acervo!'}
            />
          </div>
        ) : (
          temasOrdenados.map(tema => (
            <div key={tema} className={styles.themeSection}>
              <div className={styles.themeHeader}>
                <h3 className={styles.themeTitle}>
                  <Palette size={24} color="var(--primary)" /> {tema}
                </h3>
                <Badge variant="primary">{temas[tema].length} foto{temas[tema].length !== 1 ? 's' : ''}</Badge>
                
                <Button 
                  variant="ghost" 
                  color="danger" 
                  icon={Trash2} 
                  onClick={() => handleDeleteTheme(tema)}
                  style={{ marginLeft: 'auto' }}
                >
                  Apagar Álbum
                </Button>
              </div>

              <div className={styles.photoGrid}>
                {temas[tema].map(foto => (
                  <div
                    key={foto.id}
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleSelection({ stopPropagation: () => {} }, foto.id);
                      } else {
                        setFotoExpandida(foto);
                        setModalEditTema(foto.tema);
                        setModalEditDescricao(foto.descricao || '');
                        setIsEditingModal(false);
                      }
                    }}
                    className={`${styles.photoCard} ${isSelectionMode ? styles.selectable : ''}`}
                    style={{ opacity: isSelectionMode && !selectedFotos.includes(foto.id) ? 0.6 : 1 }}
                  >
                    {isVideo(foto.foto_url) ? (
                      <video
                        src={foto.foto_url}
                        className={styles.photoImg}
                        muted loop playsInline
                        onMouseOver={e => e.target.play().catch(() => {})}
                        onMouseOut={e => { e.target.pause(); e.target.currentTime = 0; }}
                      />
                    ) : (
                      <img
                        src={foto.foto_url}
                        alt={foto.tema}
                        loading="lazy"
                        className={styles.photoImg}
                      />
                    )}
                    
                    {isSelectionMode && (
                      <div className={`${styles.selectionCheckbox} ${selectedFotos.includes(foto.id) ? styles.checked : styles.unchecked}`}>
                        {selectedFotos.includes(foto.id) && <Check size={16} />}
                      </div>
                    )}
                    {isSelectionMode && selectedFotos.includes(foto.id) && (
                      <div className={styles.selectedBorder}></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Lightbox Modal customizado para visualização de imagem em tela cheia */}
      {fotoExpandida && (
        <div className={styles.lightboxOverlay} onClick={() => setFotoExpandida(null)}>
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            {isVideo(fotoExpandida.foto_url) ? (
              <video
                src={fotoExpandida.foto_url}
                controls
                autoPlay
                className={styles.lightboxImg}
                style={{ maxHeight: '70vh', backgroundColor: '#000' }}
              />
            ) : (
              <img
                src={fotoExpandida.foto_url}
                alt={fotoExpandida.tema}
                className={styles.lightboxImg}
              />
            )}
            
            <div className={styles.lightboxInfo}>
              {isEditingModal ? (
                <div className={styles.editPanel}>
                  <div>
                    <label className={styles.editLabel}>Tema</label>
                    <input 
                      type="text" 
                      value={modalEditTema} 
                      onChange={e => setModalEditTema(e.target.value)}
                      className={styles.editInput}
                    />
                  </div>
                  <div>
                    <label className={styles.editLabel}>Observações / Descrição</label>
                    <textarea 
                      rows="3"
                      value={modalEditDescricao} 
                      onChange={e => setModalEditDescricao(e.target.value)}
                      className={styles.editInput}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <Button variant="secondary" onClick={() => setIsEditingModal(false)}>Cancelar</Button>
                    <Button variant="success" icon={Save} onClick={handleSaveModalEdit}>Salvar</Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className={styles.lightboxTitle}>
                    <Palette size={28} /> {fotoExpandida.tema}
                  </h2>
                  {fotoExpandida.descricao && (
                    <p className={styles.lightboxDesc}>{fotoExpandida.descricao}</p>
                  )}
                </>
              )}
              
              {!isEditingModal && (
                <div className={styles.lightboxActions}>
                  <Button variant="primary" icon={Download} onClick={() => handleDownload(fotoExpandida)}>
                    Arquivos
                  </Button>
                  <Button variant="primary" icon={Share2} onClick={() => handleShare(fotoExpandida)} style={{ background: 'var(--success)' }}>
                    Salvar/Compartilhar
                  </Button>
                  <Button variant="secondary" icon={Edit2} onClick={() => setIsEditingModal(true)}>
                    Editar
                  </Button>
                  <Button variant="danger" icon={Trash2} onClick={() => removeFoto(fotoExpandida)}>
                    Excluir
                  </Button>
                  <Button variant="secondary" icon={X} onClick={() => setFotoExpandida(null)}>
                    Fechar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog Global para a Galeria */}
      {confirmAction && (
        <ConfirmDialog 
          isOpen={true}
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
