import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Produto } from '@/api/entities';
import { Capsula } from '@/api/entities';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Plus, Minus, Package } from 'lucide-react';
import ImageUploader from './ImageUploader';
import { toast } from 'sonner';

export default function CapsulaForm({ capsula, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    imagem_capa_url: '',
    produto_ids: [],
    produtos_quantidades: {},
    ativa: true,
  });
  const [allProdutos, setAllProdutos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (capsula) {
      let quantidades = {};
      try {
        // JSONB pode vir como objeto ou string
        if (typeof capsula.produtos_quantidades === 'string') {
          quantidades = JSON.parse(capsula.produtos_quantidades);
        } else if (typeof capsula.produtos_quantidades === 'object' && capsula.produtos_quantidades !== null) {
          quantidades = capsula.produtos_quantidades;
        }
      } catch (e) {
        console.error('Erro ao fazer parse de produtos_quantidades:', e);
        quantidades = {};
      }

      setFormData({
        nome: capsula.nome || '',
        descricao: capsula.descricao || '',
        imagem_capa_url: capsula.imagem_capa_url || '',
        produto_ids: capsula.produto_ids || [],
        produtos_quantidades: quantidades,
        ativa: capsula.ativa !== undefined ? capsula.ativa : true,
      });
    }

    const loadProdutos = async () => {
      try {
        const produtosList = await Produto.list();
        setAllProdutos(produtosList);
      } catch (error) {
      }
    };
    loadProdutos();
  }, [capsula]);

  const handleProductSelection = (productId) => {
    setFormData(prev => {
      const newProductIds = prev.produto_ids.includes(productId)
        ? prev.produto_ids.filter(id => id !== productId)
        : [...prev.produto_ids, productId];

      // Se desmarcar, remover da quantidade
      const newQuantidades = { ...prev.produtos_quantidades };
      if (!newProductIds.includes(productId)) {
        delete newQuantidades[productId];
      } else if (!newQuantidades[productId]) {
        // Verificar se produto tem variantes
        const produto = allProdutos.find(p => p.id === productId);
        if (produto?.tem_variantes_cor) {
          // Inicializar com array vazio de variantes
          newQuantidades[productId] = { variantes: [] };
        } else {
          // Definir quantidade padrão de 1
          newQuantidades[productId] = 1;
        }
      }

      return {
        ...prev,
        produto_ids: newProductIds,
        produtos_quantidades: newQuantidades
      };
    });
  };

  const handleQuantidadeChange = (productId, quantidade) => {
    const qtd = Math.max(1, parseInt(quantidade) || 1);
    setFormData(prev => ({
      ...prev,
      produtos_quantidades: {
        ...prev.produtos_quantidades,
        [productId]: qtd
      }
    }));
  };

  const filteredProdutos = allProdutos.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.produto_ids.length === 0) {
      toast.info('Selecione ao menos um produto para a cápsula.');
      return;
    }
    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        // Supabase JSONB aceita objetos JavaScript diretamente
        produtos_quantidades: formData.produtos_quantidades
      };

      if (capsula) {
        await Capsula.update(capsula.id, dataToSave);
      } else {
        await Capsula.create(dataToSave);
      }
      onSuccess();
    } catch (error) {
      toast.error('Falha ao salvar a cápsula.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-slate-100 border-0 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff]">
      <CardHeader>
        <CardTitle className="text-2xl text-gray-800">{capsula ? 'Editar Cápsula' : 'Nova Cápsula'}</CardTitle>
        <CardDescription>Crie uma coleção de produtos para seus clientes com quantidades mínimas.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Coluna 1: Infos e Imagem */}
            <div className="md:col-span-1 space-y-6">
              <div>
                <Label htmlFor="nome" className="font-medium">Nome da Cápsula</Label>
                <Input id="nome" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} required className="bg-slate-100 shadow-neumorphic-inset" />
              </div>
              <div>
                <Label htmlFor="descricao" className="font-medium">Descrição</Label>
                <Textarea id="descricao" value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} className="bg-slate-100 shadow-neumorphic-inset" />
              </div>
              <div>
                <Label className="font-medium">Imagem de Capa</Label>
                <ImageUploader
                  images={formData.imagem_capa_url ? [formData.imagem_capa_url] : []}
                  onImagesChange={(images) => setFormData({...formData, imagem_capa_url: images[0] || ''})}
                  maxImages={1}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="ativa" checked={formData.ativa} onCheckedChange={checked => setFormData({...formData, ativa: checked})} />
                <Label htmlFor="ativa">Cápsula Ativa</Label>
              </div>
            </div>

            {/* Coluna 2: Seleção de Produtos com Quantidade */}
            <div className="md:col-span-2">
              <Label className="font-medium text-lg">Selecionar Produtos e Quantidades Mínimas ({formData.produto_ids.length})</Label>
              <div className="mt-2 relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Buscar produto..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-100 shadow-neumorphic-inset"
                />
              </div>
              <ScrollArea className="h-96 mt-4 p-4 rounded-lg bg-slate-100 shadow-neumorphic-inset">
                <div className="space-y-3">
                  {filteredProdutos.map(produto => {
                    const isSelected = formData.produto_ids.includes(produto.id);
                    const qtdData = formData.produtos_quantidades[produto.id];
                    // Para produtos sem variantes, qtdData é um número
                    // Para produtos com variantes, qtdData é um objeto { variantes: [...] }
                    const quantidade = typeof qtdData === 'number' ? qtdData : 1;

                    return (
                      <div key={produto.id} className="p-3 rounded-md bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`prod-${produto.id}`}
                            checked={isSelected}
                            onCheckedChange={() => handleProductSelection(produto.id)}
                          />
                          <div className="w-12 h-12 rounded-md bg-gray-200 flex items-center justify-center flex-shrink-0">
                            {produto.fotos?.[0] ? (
                              <img
                                src={produto.fotos[0]}
                                alt={produto.nome}
                                className="w-full h-full rounded-md object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentElement.innerHTML = '<svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>';
                                }}
                              />
                            ) : (
                              <Package className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <label htmlFor={`prod-${produto.id}`} className="cursor-pointer font-medium">
                              {produto.nome}
                            </label>
                            <div className="text-xs text-gray-500">{produto.marca}</div>
                            
                            {isSelected && (
                              <div className="mt-2 space-y-2">
                                {/* Se produto tem variantes de cor, mostrar seleção por cor */}
                                {produto.tem_variantes_cor && (() => {
                                  let variantes = [];
                                  try {
                                    variantes = typeof produto.variantes_cor === 'string'
                                      ? JSON.parse(produto.variantes_cor)
                                      : produto.variantes_cor || [];
                                  } catch (e) {
                                    variantes = [];
                                  }

                                  if (variantes.length > 0) {
                                    const quantidadesVariantes = formData.produtos_quantidades[produto.id]?.variantes || [];

                                    return (
                                      <div className="space-y-2 bg-gray-50 p-2 rounded">
                                        <Label className="text-xs font-semibold">Quantidades por Cor:</Label>
                                        {variantes.map((variante) => {
                                          const qtdVariante = quantidadesVariantes.find(v => v.cor_id === variante.id)?.quantidade || 0;

                                          return (
                                            <div key={variante.id} className="flex items-center gap-2">
                                              <div
                                                className="w-4 h-4 rounded-full border border-gray-300"
                                                style={{ backgroundColor: variante.cor_codigo_hex || variante.cor_hex || '#000' }}
                                                title={variante.cor_nome}
                                              />
                                              <span className="text-xs min-w-[80px]">{variante.cor_nome}</span>
                                              <div className="flex items-center gap-1">
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  className="h-6 w-6 p-0"
                                                  onClick={() => {
                                                    const newQuantidadesVariantes = qtdVariante > 0
                                                      ? quantidadesVariantes.map(v =>
                                                          v.cor_id === variante.id
                                                            ? { ...v, quantidade: Math.max(0, v.quantidade - 1) }
                                                            : v
                                                        ).filter(v => v.quantidade > 0)
                                                      : quantidadesVariantes;

                                                    setFormData(prev => ({
                                                      ...prev,
                                                      produtos_quantidades: {
                                                        ...prev.produtos_quantidades,
                                                        [produto.id]: {
                                                          variantes: newQuantidadesVariantes
                                                        }
                                                      }
                                                    }));
                                                  }}
                                                >
                                                  <Minus className="w-3 h-3" />
                                                </Button>
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  value={qtdVariante}
                                                  onChange={(e) => {
                                                    const newQtd = parseInt(e.target.value) || 0;
                                                    let newQuantidadesVariantes = [...quantidadesVariantes];

                                                    if (newQtd === 0) {
                                                      newQuantidadesVariantes = newQuantidadesVariantes.filter(v => v.cor_id !== variante.id);
                                                    } else {
                                                      const existingIndex = newQuantidadesVariantes.findIndex(v => v.cor_id === variante.id);
                                                      if (existingIndex >= 0) {
                                                        newQuantidadesVariantes[existingIndex].quantidade = newQtd;
                                                      } else {
                                                        newQuantidadesVariantes.push({
                                                          cor_id: variante.id,
                                                          cor_nome: variante.cor_nome,
                                                          cor_hex: variante.cor_codigo_hex || variante.cor_hex,
                                                          quantidade: newQtd
                                                        });
                                                      }
                                                    }

                                                    setFormData(prev => ({
                                                      ...prev,
                                                      produtos_quantidades: {
                                                        ...prev.produtos_quantidades,
                                                        [produto.id]: {
                                                          variantes: newQuantidadesVariantes
                                                        }
                                                      }
                                                    }));
                                                  }}
                                                  className="w-14 h-6 text-center text-xs"
                                                />
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  className="h-6 w-6 p-0"
                                                  onClick={() => {
                                                    let newQuantidadesVariantes = [...quantidadesVariantes];
                                                    const existingIndex = newQuantidadesVariantes.findIndex(v => v.cor_id === variante.id);

                                                    if (existingIndex >= 0) {
                                                      newQuantidadesVariantes[existingIndex].quantidade++;
                                                    } else {
                                                      newQuantidadesVariantes.push({
                                                        cor_id: variante.id,
                                                        cor_nome: variante.cor_nome,
                                                        cor_hex: variante.cor_codigo_hex || variante.cor_hex,
                                                        quantidade: 1
                                                      });
                                                    }

                                                    setFormData(prev => ({
                                                      ...prev,
                                                      produtos_quantidades: {
                                                        ...prev.produtos_quantidades,
                                                        [produto.id]: {
                                                          variantes: newQuantidadesVariantes
                                                        }
                                                      }
                                                    }));
                                                  }}
                                                >
                                                  <Plus className="w-3 h-3" />
                                                </Button>
                                              </div>
                                              <span className="text-xs text-gray-500">
                                                {produto.tipo_venda === 'grade' ? 'grades' : 'un'}
                                              </span>
                                            </div>
                                          );
                                        })}
                                        <div className="text-xs text-gray-600 mt-1 pt-1 border-t">
                                          Total: {quantidadesVariantes.reduce((sum, v) => sum + v.quantidade, 0)} {produto.tipo_venda === 'grade' ? 'grades' : 'unidades'}
                                        </div>
                                      </div>
                                    );
                                  }
                                })()}

                                {/* Se não tem variantes, mostrar quantidade simples */}
                                {!produto.tem_variantes_cor && (
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs">Qtd. Mínima:</Label>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => handleQuantidadeChange(produto.id, quantidade - 1)}
                                      >
                                        <Minus className="w-3 h-3" />
                                      </Button>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={quantidade}
                                        onChange={(e) => handleQuantidadeChange(produto.id, e.target.value)}
                                        className="w-16 h-7 text-center"
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => handleQuantidadeChange(produto.id, quantidade + 1)}
                                      >
                                        <Plus className="w-3 h-3" />
                                      </Button>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {produto.tipo_venda === 'grade' ? 'grades' : 'unidades'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="ghost" onClick={onCancel} className="text-gray-700">Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-neumorphic-button active:shadow-neumorphic-button-inset">
              {loading ? 'Salvando...' : 'Salvar Cápsula'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}