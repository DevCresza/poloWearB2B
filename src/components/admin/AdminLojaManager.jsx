import { useState, useEffect, useCallback } from 'react';
import { Loja, User } from '@/api/entities';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { consultarCep, formatCepForDisplay } from '@/lib/cepHelpers';
import {
  Store, Plus, Pencil, Power, Ban, ShieldCheck, MapPin,
  Loader2, AlertTriangle, Lock, Unlock
} from 'lucide-react';

const emptyForm = {
  nome: '', nome_fantasia: '', cnpj: '', codigo_cliente: '',
  endereco_completo: '', cidade: '', estado: '', cep: '', telefone: ''
};

export default function AdminLojaManager({ open, onOpenChange, userId, userName, onLojasChanged }) {
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [showBloqueioModal, setShowBloqueioModal] = useState(false);
  const [bloqueioTarget, setBloqueioTarget] = useState(null); // loja or 'all'
  const [motivoBloqueio, setMotivoBloqueio] = useState('');
  const [processando, setProcessando] = useState(false);

  const loadLojas = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const list = await Loja.filter({ user_id: userId });
      setLojas(list || []);
    } catch (_err) {
      toast.error('Erro ao carregar lojas.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open && userId) loadLojas();
  }, [open, userId, loadLojas]);

  const abrirForm = (loja = null) => {
    if (loja) {
      setEditando(loja);
      setFormData({
        nome: loja.nome || '',
        nome_fantasia: loja.nome_fantasia || '',
        cnpj: loja.cnpj || '',
        codigo_cliente: loja.codigo_cliente || '',
        endereco_completo: loja.endereco_completo || '',
        cidade: loja.cidade || '',
        estado: loja.estado || '',
        cep: loja.cep || '',
        telefone: loja.telefone || ''
      });
    } else {
      setEditando(null);
      setFormData({ ...emptyForm });
    }
    setShowForm(true);
  };

  const handleCepChange = async (cep) => {
    setFormData(prev => ({ ...prev, cep }));
    const clean = cep.replace(/\D/g, '');
    if (clean.length === 8) {
      setBuscandoCep(true);
      try {
        const endereco = await consultarCep(clean);
        setFormData(prev => ({
          ...prev,
          cep: formatCepForDisplay(clean),
          endereco_completo: endereco.endereco_completo,
          cidade: endereco.cidade,
          estado: endereco.estado
        }));
      } catch (_err) {
        toast.error('CEP não encontrado.');
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  const handleSalvar = async () => {
    if (!formData.nome.trim()) {
      toast.info('Informe o nome/razão social da loja.');
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        await Loja.update(editando.id, formData);
        toast.success('Loja atualizada.');
      } else {
        await Loja.create({ ...formData, user_id: userId, ativa: true });
        toast.success('Loja cadastrada.');
      }
      setShowForm(false);
      await loadLojas();
      onLojasChanged?.();
    } catch (_err) {
      toast.error('Erro ao salvar loja.');
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleAtiva = async (loja) => {
    const novaAtiva = !loja.ativa;
    const acao = novaAtiva ? 'reativar' : 'desativar';
    if (!novaAtiva && !confirm(`Deseja desativar a loja "${loja.nome_fantasia || loja.nome}"?`)) return;
    try {
      await Loja.update(loja.id, { ativa: novaAtiva });
      toast.success(`Loja ${novaAtiva ? 'reativada' : 'desativada'}.`);
      await loadLojas();
      onLojasChanged?.();
    } catch (_err) {
      toast.error(`Erro ao ${acao} loja.`);
    }
  };

  const abrirBloqueio = (target) => {
    setBloqueioTarget(target);
    setMotivoBloqueio('');
    setShowBloqueioModal(true);
  };

  const handleBloquear = async () => {
    if (!motivoBloqueio.trim()) {
      toast.info('Informe o motivo do bloqueio.');
      return;
    }
    setProcessando(true);
    try {
      const agora = new Date().toISOString();
      if (bloqueioTarget === 'all') {
        // Block all lojas + user global
        for (const loja of lojas) {
          await Loja.update(loja.id, {
            bloqueada: true,
            motivo_bloqueio: motivoBloqueio,
            data_bloqueio: agora
          });
        }
        await User.update(userId, {
          bloqueado: true,
          motivo_bloqueio: motivoBloqueio,
          data_bloqueio: agora
        });
        toast.success('Todas as lojas e conta do cliente bloqueadas.');
      } else {
        // Block single loja
        await Loja.update(bloqueioTarget.id, {
          bloqueada: true,
          motivo_bloqueio: motivoBloqueio,
          data_bloqueio: agora
        });
        toast.success(`Loja "${bloqueioTarget.nome_fantasia || bloqueioTarget.nome}" bloqueada.`);
      }
      setShowBloqueioModal(false);
      await loadLojas();
      onLojasChanged?.();
    } catch (_err) {
      toast.error('Erro ao bloquear.');
    } finally {
      setProcessando(false);
    }
  };

  const handleDesbloquear = async (loja) => {
    setProcessando(true);
    try {
      await Loja.update(loja.id, {
        bloqueada: false,
        motivo_bloqueio: null,
        data_bloqueio: null
      });
      toast.success(`Loja "${loja.nome_fantasia || loja.nome}" desbloqueada.`);
      await loadLojas();
      onLojasChanged?.();
    } catch (_err) {
      toast.error('Erro ao desbloquear loja.');
    } finally {
      setProcessando(false);
    }
  };

  const handleDesbloquearTodas = async () => {
    if (!confirm('Desbloquear todas as lojas e a conta do cliente?')) return;
    setProcessando(true);
    try {
      for (const loja of lojas) {
        if (loja.bloqueada) {
          await Loja.update(loja.id, {
            bloqueada: false,
            motivo_bloqueio: null,
            data_bloqueio: null
          });
        }
      }
      await User.update(userId, {
        bloqueado: false,
        motivo_bloqueio: null,
        data_bloqueio: null
      });
      toast.success('Todas as lojas e conta do cliente desbloqueadas.');
      await loadLojas();
      onLojasChanged?.();
    } catch (_err) {
      toast.error('Erro ao desbloquear.');
    } finally {
      setProcessando(false);
    }
  };

  const bloqueadasCount = lojas.filter(l => l.bloqueada).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Store className="w-5 h-5 text-blue-600" />
              Lojas de {userName}
            </DialogTitle>
          </DialogHeader>

          {/* Actions header */}
          <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
            <Button onClick={() => abrirForm()} size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" /> Adicionar Loja
            </Button>
            <div className="flex-1" />
            {lojas.length > 0 && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => abrirBloqueio('all')}
                  disabled={processando}
                >
                  <Lock className="w-4 h-4 mr-1" /> Bloquear Todas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDesbloquearTodas}
                  disabled={processando || bloqueadasCount === 0}
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  <Unlock className="w-4 h-4 mr-1" /> Desbloquear Todas
                </Button>
              </>
            )}
          </div>

          {/* Lojas list */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : lojas.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Nenhuma loja cadastrada para este cliente</p>
                <Button onClick={() => abrirForm()} variant="outline">
                  <Plus className="w-4 h-4 mr-2" /> Cadastrar primeira loja
                </Button>
              </div>
            ) : (
              lojas.map(loja => (
                <Card key={loja.id} className={`${!loja.ativa ? 'opacity-60' : ''} ${loja.bloqueada ? 'border-red-300' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                          <Store className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span className="truncate">{loja.nome_fantasia || loja.nome}</span>
                          {!loja.ativa && <Badge className="bg-gray-200 text-gray-700">Desativada</Badge>}
                          {loja.bloqueada && <Badge className="bg-red-100 text-red-800">Bloqueada</Badge>}
                        </h4>
                        {loja.nome_fantasia && loja.nome !== loja.nome_fantasia && (
                          <p className="text-xs text-gray-500 ml-6">{loja.nome}</p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirForm(loja)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${loja.ativa ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}
                          onClick={() => handleToggleAtiva(loja)}
                          title={loja.ativa ? 'Desativar' : 'Reativar'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                        {loja.bloqueada ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-800"
                            onClick={() => handleDesbloquear(loja)}
                            disabled={processando}
                            title="Desbloquear"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                            onClick={() => abrirBloqueio(loja)}
                            disabled={processando}
                            title="Bloquear"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600 ml-6">
                      {loja.cnpj && <p><span className="text-gray-400">CNPJ:</span> {loja.cnpj}</p>}
                      {loja.codigo_cliente && <p><span className="text-gray-400">Código:</span> {loja.codigo_cliente}</p>}
                      {(loja.cidade || loja.estado) && (
                        <p className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {loja.cidade}{loja.estado ? `/${loja.estado}` : ''}
                        </p>
                      )}
                      {loja.telefone && <p><span className="text-gray-400">Tel:</span> {loja.telefone}</p>}
                      {loja.bloqueada && loja.motivo_bloqueio && (
                        <p className="text-red-600 text-xs mt-1">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          {loja.motivo_bloqueio}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600" />
              {editando ? 'Editar Loja' : 'Nova Loja'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Razão Social *</Label>
                <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <Label>Nome Fantasia</Label>
                <Input value={formData.nome_fantasia} onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={formData.cnpj} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Código do Cliente</Label>
                <Input value={formData.codigo_cliente} onChange={(e) => setFormData({ ...formData, codigo_cliente: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  CEP {buscandoCep && <Loader2 className="w-3 h-3 animate-spin" />}
                </Label>
                <Input value={formData.cep} onChange={(e) => handleCepChange(e.target.value)} maxLength={9} placeholder="00000-000" className="mt-1" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <Label>Endereço Completo</Label>
                <Textarea value={formData.endereco_completo} onChange={(e) => setFormData({ ...formData, endereco_completo: e.target.value })} rows={2} className="mt-1" />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
                {salvando ? 'Salvando...' : editando ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bloqueio Modal */}
      <Dialog open={showBloqueioModal} onOpenChange={setShowBloqueioModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="w-5 h-5" />
              {bloqueioTarget === 'all' ? 'Bloquear Todas as Lojas' : `Bloquear Loja`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {bloqueioTarget !== 'all' && bloqueioTarget && (
              <p className="text-sm text-gray-600">
                Loja: <strong>{bloqueioTarget.nome_fantasia || bloqueioTarget.nome}</strong>
              </p>
            )}
            {bloqueioTarget === 'all' && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 text-sm">
                  Isso bloqueará todas as {lojas.length} lojas e a conta global do cliente <strong>{userName}</strong>.
                </AlertDescription>
              </Alert>
            )}
            <div>
              <Label>Motivo do Bloqueio *</Label>
              <Textarea
                value={motivoBloqueio}
                onChange={(e) => setMotivoBloqueio(e.target.value)}
                placeholder="Informe o motivo do bloqueio..."
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowBloqueioModal(false)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={handleBloquear}
                disabled={processando || !motivoBloqueio.trim()}
              >
                {processando ? 'Bloqueando...' : 'Confirmar Bloqueio'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
