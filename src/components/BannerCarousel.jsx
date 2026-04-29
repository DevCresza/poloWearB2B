import { useState, useEffect, useCallback } from 'react';
import { Banner } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import ImageEditor from '@/components/ImageEditor';

export default function BannerCarousel({ isAdmin = false }) {
  const [banners, setBanners] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showManager, setShowManager] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await Banner.filter({ ativo: true }, 'ordem');
      setBanners(list || []);
    } catch (_) {
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-rotate a cada 6s
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(t);
  }, [banners.length]);

  const next = () => setCurrentIdx(prev => (prev + 1) % banners.length);
  const prev = () => setCurrentIdx(prev => (prev - 1 + banners.length) % banners.length);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result);
      setShowEditor(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveCrop = async (blob) => {
    setUploading(true);
    try {
      const file = new File([blob], `banner-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const result = await UploadFile({ file });
      const url = result.url || result.file_url;
      if (editingBanner) {
        await Banner.update(editingBanner.id, { imagem_url: url });
      } else {
        await Banner.create({ imagem_url: url, ativo: true, ordem: banners.length });
      }
      toast.success('Banner salvo!');
      setShowEditor(false);
      setImageToCrop(null);
      setEditingBanner(null);
      load();
    } catch (err) {
      toast.error('Erro ao salvar banner: ' + (err.message || ''));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este banner?')) return;
    try {
      await Banner.delete(id);
      toast.success('Banner removido.');
      load();
      setCurrentIdx(0);
    } catch (err) {
      toast.error('Erro ao excluir.');
    }
  };

  if (loading) {
    return <div className="w-full aspect-[16/6] bg-gray-100 rounded-xl animate-pulse" />;
  }

  // Sem banners cadastrados
  if (banners.length === 0) {
    if (!isAdmin) return null;
    return (
      <div className="relative w-full aspect-[16/6] rounded-xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
        <div className="text-center space-y-3">
          <ImageIcon className="w-12 h-12 text-gray-400 mx-auto" />
          <p className="text-sm text-gray-600">Nenhum banner cadastrado</p>
          <Button onClick={() => setShowManager(true)} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-1" /> Adicionar banner
          </Button>
        </div>
        <ManagerDialog
          open={showManager}
          onClose={() => setShowManager(false)}
          banners={banners}
          onUpload={() => document.getElementById('banner-upload-input')?.click()}
          onEdit={(b) => { setEditingBanner(b); document.getElementById('banner-upload-input')?.click(); }}
          onDelete={handleDelete}
        />
        <input id="banner-upload-input" type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
        {showEditor && imageToCrop && (
          <ImageEditor
            open={showEditor}
            onClose={() => { setShowEditor(false); setImageToCrop(null); setEditingBanner(null); }}
            imageSrc={imageToCrop}
            aspectRatio={16/6}
            lockAspect={true}
            onSave={handleSaveCrop}
          />
        )}
      </div>
    );
  }

  const current = banners[currentIdx];

  return (
    <>
      <div className="relative w-full aspect-[16/6] rounded-xl overflow-hidden bg-gray-200 shadow-md group">
        <img src={current.imagem_url} alt={current.titulo || 'Banner'} className="w-full h-full object-cover" />
        {(current.titulo || current.subtitulo) && (
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent flex items-center">
            <div className="px-8 sm:px-12 max-w-xl text-white">
              {current.titulo && (
                <h2 className="text-3xl sm:text-5xl font-bold leading-tight mb-2">{current.titulo}</h2>
              )}
              {current.subtitulo && (
                <p className="text-sm sm:text-base opacity-90">{current.subtitulo}</p>
              )}
            </div>
          </div>
        )}

        {/* Setas */}
        {banners.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronLeft className="w-5 h-5 text-gray-800" />
            </button>
            <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-5 h-5 text-gray-800" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {banners.map((_, i) => (
                <button key={i} onClick={() => setCurrentIdx(i)} className={`h-1.5 rounded-full transition-all ${i === currentIdx ? 'bg-white w-6' : 'bg-white/50 w-2'}`} />
              ))}
            </div>
          </>
        )}

        {/* Botões admin */}
        {isAdmin && (
          <div className="absolute top-3 right-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowManager(true)} className="bg-white/90 hover:bg-white text-gray-900 shadow">
              <Pencil className="w-4 h-4 mr-1" /> Gerenciar banners
            </Button>
          </div>
        )}
      </div>

      <ManagerDialog
        open={showManager}
        onClose={() => setShowManager(false)}
        banners={banners}
        onUpload={() => { setEditingBanner(null); document.getElementById('banner-upload-input')?.click(); }}
        onEdit={(b) => { setEditingBanner(b); document.getElementById('banner-upload-input')?.click(); }}
        onDelete={handleDelete}
        onSaveMeta={async (id, meta) => {
          await Banner.update(id, meta);
          toast.success('Banner atualizado.');
          load();
        }}
      />
      <input id="banner-upload-input" type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

      {showEditor && imageToCrop && (
        <ImageEditor
          open={showEditor}
          onClose={() => { setShowEditor(false); setImageToCrop(null); setEditingBanner(null); }}
          imageSrc={imageToCrop}
          aspectRatio={16/6}
          lockAspect={true}
          onSave={handleSaveCrop}
        />
      )}
    </>
  );
}

function ManagerDialog({ open, onClose, banners, onUpload, onEdit, onDelete, onSaveMeta }) {
  const [editFields, setEditFields] = useState({});

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Banners da Home</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Button onClick={onUpload} className="w-full bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Adicionar novo banner (imagem 16:6)
          </Button>
          {banners.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-4">Nenhum banner cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {banners.map(b => {
                const fields = editFields[b.id] || { titulo: b.titulo || '', subtitulo: b.subtitulo || '' };
                return (
                  <div key={b.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex gap-3 items-start">
                      <img src={b.imagem_url} alt={b.titulo} className="w-32 aspect-[16/6] object-cover rounded shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Título (opcional)"
                          value={fields.titulo}
                          onChange={(e) => setEditFields(prev => ({ ...prev, [b.id]: { ...fields, titulo: e.target.value } }))}
                        />
                        <Input
                          placeholder="Subtítulo (opcional)"
                          value={fields.subtitulo}
                          onChange={(e) => setEditFields(prev => ({ ...prev, [b.id]: { ...fields, subtitulo: e.target.value } }))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => onEdit(b)}>
                        <ImageIcon className="w-4 h-4 mr-1" /> Trocar imagem
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onSaveMeta && onSaveMeta(b.id, fields)}>
                        Salvar texto
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(b.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
