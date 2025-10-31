
import React, { useState, useEffect } from 'react';
import { Produto } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImageUploader from './ImageUploader';
import ProductVariantsManager from './ProductVariantsManager'; // New import
import { Switch } from '@/components/ui/switch'; // New import
import { Package, DollarSign, Palette, Ruler, Video, Calendar, AlertTriangle, Save, X } from 'lucide-react';

export default function ProductForm({ produto, onSuccess, onCancel }) {
  const [submitting, setSubmitting] = useState(false); // Renamed from 'loading'
  const [fornecedores, setFornecedores] = useState([]);
  
  const [formData, setFormData] = useState(produto || {
    nome: '',
    descricao: '',
    marca: 'Polo Wear',
    fornecedor_id: '',
    referencia_fornecedor: '',
    referencia_polo: '',
    tipo_venda: 'grade',
    categoria: '',
    temporada: 'Atemporal',
    disponibilidade: 'pronta_entrega',
    data_inicio_venda: '',
    data_limite_venda: '', // New field
    data_prevista_entrega: '',
    video_url: '',
    grade_configuracao: {
      tamanhos_disponiveis: [],
      quantidades_por_tamanho: {} // Changed to empty object
    },
    preco_por_peca: 0,
    total_pecas_grade: 0,
    preco_grade_completa: 0,
    custo_por_peca: 0,
    margem_lucro: 0,
    pedido_minimo_grades: 1,
    estoque_atual_grades: 0,
    estoque_minimo_grades: 0,
    fotos: [],
    tem_variantes_cor: false, // New field
    variantes_cor: [], // New field
    is_destaque: false,
    ativo: true,
    controla_estoque: true, // Kept as default true, checkbox removed
    permite_venda_sem_estoque: false,
    data_lancamento: ''
  });

  // `corAtual` and `tamanhoSelecionado` state were related to the old color management or general size selection.
  // `tamanhoSelecionado` is still relevant for grade configuration. `corAtual` and related functions are removed.
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState([]);

  const categorias = [
    'Camisetas', 'Polos', 'Shorts', 'Calças',
    'Vestidos', 'Blusas', 'Jaquetas', 'Acessórios'
  ];

  const tamanhos = ['PP', 'P', 'M', 'G', 'GG', 'XG', '2G', '3G', 'EG'];

  useEffect(() => {
    loadFornecedores();
    if (produto) {
      // Parse JSON strings from 'produto' object if they exist
      let grade = { tamanhos_disponiveis: [], quantidades_por_tamanho: {} };
      let fotos = [];
      let variantes = [];
      
      try {
        grade = typeof produto.grade_configuracao === 'string' 
          ? JSON.parse(produto.grade_configuracao) 
          : produto.grade_configuracao || grade;
      } catch (e) {
        console.error('Erro ao parsear grade:', e);
      }

      try {
        fotos = typeof produto.fotos === 'string' 
          ? JSON.parse(produto.fotos) 
          : produto.fotos || fotos;
      } catch (e) {
        console.error('Erro ao parsear fotos:', e);
      }

      try {
        variantes = typeof produto.variantes_cor === 'string' 
          ? JSON.parse(produto.variantes_cor) 
          : produto.variantes_cor || variantes;
      } catch (e) {
        console.error('Erro ao parsear variantes:', e);
      }

      setFormData({
        ...produto,
        grade_configuracao: grade,
        fotos: fotos,
        variantes_cor: variantes,
        tem_variantes_cor: produto.tem_variantes_cor || false,
        // Ensure date fields are correctly formatted for input type="date"
        data_inicio_venda: produto.data_inicio_venda ? new Date(produto.data_inicio_venda).toISOString().split('T')[0] : '',
        data_limite_venda: produto.data_limite_venda ? new Date(produto.data_limite_venda).toISOString().split('T')[0] : '',
        data_prevista_entrega: produto.data_prevista_entrega ? new Date(produto.data_prevista_entrega).toISOString().split('T')[0] : '',
        data_lancamento: produto.data_lancamento ? new Date(produto.data_lancamento).toISOString().split('T')[0] : ''
      });
      setTamanhoSelecionado(grade.tamanhos_disponiveis || []);
    }
  }, [produto]);

  const loadFornecedores = async () => {
    try {
      const fornecedoresList = await Fornecedor.list();
      setFornecedores(fornecedoresList);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
    }
  };

  const handleTamanhoChange = (tamanho, checked) => {
    let novosTamanhos;
    if (checked) {
      novosTamanhos = [...tamanhoSelecionado, tamanho];
    } else {
      novosTamanhos = tamanhoSelecionado.filter(t => t !== tamanho);
      // Zerar quantidade se desmarcar
      setFormData(prev => ({
        ...prev,
        grade_configuracao: {
          ...prev.grade_configuracao,
          quantidades_por_tamanho: {
            ...prev.grade_configuracao.quantidades_por_tamanho,
            [tamanho]: 0
          }
        }
      }));
    }
    setTamanhoSelecionado(novosTamanhos);
    setFormData(prev => ({
      ...prev,
      grade_configuracao: {
        ...prev.grade_configuracao,
        tamanhos_disponiveis: novosTamanhos
      }
    }));
    calcularTotalPecas(novosTamanhos, formData.grade_configuracao.quantidades_por_tamanho);
  };

  const handleQuantidadeTamanho = (tamanho, quantidade) => {
    const novasQuantidades = {
      ...formData.grade_configuracao.quantidades_por_tamanho,
      [tamanho]: parseInt(quantidade) || 0
    };
    
    setFormData(prev => ({
      ...prev,
      grade_configuracao: {
        ...prev.grade_configuracao,
        quantidades_por_tamanho: novasQuantidades
      }
    }));
    
    calcularTotalPecas(tamanhoSelecionado, novasQuantidades);
  };

  const calcularTotalPecas = (tamanhos, quantidades) => {
    const total = tamanhos.reduce((sum, tam) => sum + (quantidades[tam] || 0), 0);
    setFormData(prev => ({
      ...prev,
      total_pecas_grade: total,
      preco_grade_completa: total * (prev.preco_por_peca || 0)
    }));
  };

  const calcularPrecoGrade = (precoPorPeca) => {
    setFormData(prev => ({
      ...prev,
      preco_por_peca: parseFloat(precoPorPeca) || 0,
      preco_grade_completa: (parseFloat(precoPorPeca) || 0) * prev.total_pecas_grade
    }));
  };

  const calcularMargemLucro = (custo, preco) => {
    const custoNum = parseFloat(custo) || 0;
    const precoNum = parseFloat(preco) || 0;
    
    if (custoNum > 0) {
      const margem = ((precoNum - custoNum) / custoNum) * 100;
      setFormData(prev => ({ ...prev, margem_lucro: parseFloat(margem.toFixed(2)) }));
    }
  };

  const sugerirPrecoComMargem = (custo, margemDesejada) => {
    const custoNum = parseFloat(custo) || 0;
    const margemNum = parseFloat(margemDesejada) || 0;
    
    if (custoNum > 0 && margemNum > 0) {
      const precoSugerido = custoNum * (1 + margemNum / 100);
      setFormData(prev => ({
        ...prev,
        preco_por_peca: parseFloat(precoSugerido.toFixed(2)),
        preco_grade_completa: parseFloat((precoSugerido * prev.total_pecas_grade).toFixed(2))
      }));
    }
  };

  // Removed adicionarCor and removerCor as color management moves to ProductVariantsManager

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validações
      if (!formData.nome || !formData.fornecedor_id) {
        alert('Preencha os campos obrigatórios: Nome do Produto e Fornecedor.');
        return;
      }

      if (formData.tem_variantes_cor) {
        if (!formData.variantes_cor || formData.variantes_cor.length === 0) {
          alert('Adicione pelo menos uma variante de cor, ou desative "Produto tem variantes de cor".');
          return;
        }
        const variantesInvalidas = formData.variantes_cor.filter(v => !v.cor_nome || !v.cor_codigo_hex);
        if (variantesInvalidas.length > 0) {
          alert('Todas as variantes precisam ter um nome e um código HEX de cor.');
          return;
        }
      } else if (formData.estoque_atual_grades < 0) {
        alert('O estoque atual não pode ser negativo.');
        return;
      }

      // Preparar dados para envio (stringificar objetos JSON)
      const dataToSave = {
        ...formData,
        grade_configuracao: JSON.stringify(formData.grade_configuracao),
        fotos: JSON.stringify(formData.fotos),
        variantes_cor: formData.tem_variantes_cor ? JSON.stringify(formData.variantes_cor) : null,
        // Se tem variantes, o estoque geral é a soma das variantes
        estoque_atual_grades: formData.tem_variantes_cor
          ? formData.variantes_cor.reduce((sum, v) => sum + (v.estoque_grades || 0), 0)
          : formData.estoque_atual_grades,
        // Set controla_estoque to true if stock or variants are managed
        controla_estoque: true,
        // Convert empty date strings to null (PostgreSQL DATE columns don't accept empty strings)
        data_inicio_venda: formData.data_inicio_venda || null,
        data_limite_venda: formData.data_limite_venda || null,
        data_prevista_entrega: formData.data_prevista_entrega || null,
        data_lancamento: formData.data_lancamento || null
      };

      if (produto?.id) {
        await Produto.update(produto.id, dataToSave);
      } else {
        await Produto.create(dataToSave);
      }
      
      alert('Produto salvo com sucesso!');
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      alert('Erro ao salvar produto. Verifique os campos e tente novamente.' + (error.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-slate-100 rounded-3xl shadow-neumorphic">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Package className="w-6 h-6" />
            {produto ? 'Editar Produto' : 'Novo Produto'}
          </CardTitle>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              {submitting ? 'Salvando...' : 'Salvar Produto'}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-6"> {/* Updated grid-cols */}
              <TabsTrigger value="geral">Informações Gerais</TabsTrigger>
              <TabsTrigger value="grade">Grade & Tamanhos</TabsTrigger>
              <TabsTrigger value="precificacao">Precificação</TabsTrigger>
              {/* Removed Estoque tab trigger */}
              <TabsTrigger value="midia">Fotos & Vídeos</TabsTrigger>
            </TabsList>

            {/* Tab: Informações Gerais */}
            <TabsContent value="geral" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Produto *</Label>
                  <Input
                    id="nome"
                    required
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    placeholder="Ex: Camisa Polo Básica"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marca">Marca</Label>
                  <Input
                    id="marca"
                    value="Polo Wear"
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500">Todos os produtos são da marca Polo Wear</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao || ''}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  placeholder="Descreva o produto detalhadamente..."
                  rows={4}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fornecedor">Fornecedor *</Label>
                  <Select value={formData.fornecedor_id || ''} onValueChange={(value) => setFormData({...formData, fornecedor_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome_fantasia || f.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select value={formData.categoria || ''} onValueChange={(value) => setFormData({...formData, categoria: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="referencia_fornecedor">Ref. Fornecedor</Label>
                  <Input
                    id="referencia_fornecedor"
                    value={formData.referencia_fornecedor || ''}
                    onChange={(e) => setFormData({...formData, referencia_fornecedor: e.target.value})}
                    placeholder="Código do fornecedor"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referencia_polo">Ref. Polo Wear</Label>
                  <Input
                    id="referencia_polo"
                    value={formData.referencia_polo || ''}
                    onChange={(e) => setFormData({...formData, referencia_polo: e.target.value})}
                    placeholder="Código interno Polo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temporada">Temporada</Label>
                  <Select value={formData.temporada || 'Atemporal'} onValueChange={(value) => setFormData({...formData, temporada: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Verão">Verão</SelectItem>
                      <SelectItem value="Inverno">Inverno</SelectItem>
                      <SelectItem value="Outono">Outono</SelectItem>
                      <SelectItem value="Primavera">Primavera</SelectItem>
                      <SelectItem value="Atemporal">Atemporal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Disponibilidade
                </h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="disponibilidade">Tipo de Disponibilidade</Label>
                    <Select value={formData.disponibilidade || 'pronta_entrega'} onValueChange={(value) => setFormData({...formData, disponibilidade: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pronta_entrega">Pronta Entrega</SelectItem>
                        <SelectItem value="programacao">Programação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.disponibilidade === 'programacao' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="data_inicio_venda">Data Início Venda</Label>
                        <Input
                          id="data_inicio_venda"
                          type="date"
                          value={formData.data_inicio_venda || ''}
                          onChange={(e) => setFormData({...formData, data_inicio_venda: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="data_limite_venda">Data Limite Venda</Label> {/* New Field */}
                        <Input
                          id="data_limite_venda"
                          type="date"
                          value={formData.data_limite_venda || ''}
                          onChange={(e) => setFormData({...formData, data_limite_venda: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="data_prevista_entrega">Data Prevista Entrega</Label>
                        <Input
                          id="data_prevista_entrega"
                          type="date"
                          value={formData.data_prevista_entrega || ''}
                          onChange={(e) => setFormData({...formData, data_prevista_entrega: e.target.value})}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Removed "Cores Disponíveis" section from here */}
              
            </TabsContent>

            {/* Tab: Grade & Tamanhos */}
            <TabsContent value="grade" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Ruler className="w-5 h-5" />
                  Configuração de Grade
                </h3>

                <div className="space-y-2">
                  <Label>Tipo de Venda</Label>
                  <Select value={formData.tipo_venda || 'grade'} onValueChange={(value) => setFormData({...formData, tipo_venda: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grade">Grade Completa</SelectItem>
                      <SelectItem value="unitario">Venda Unitária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.tipo_venda === 'grade' && (
                  <>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Selecione os tamanhos disponíveis e defina a quantidade de cada um na grade.
                      </AlertDescription>
                    </Alert>

                    <div className="bg-white rounded-lg p-6 space-y-4">
                      <h4 className="font-semibold">Selecione os Tamanhos Disponíveis:</h4>
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                        {tamanhos.map(tamanho => (
                          <div key={tamanho} className="flex items-center space-x-2">
                            <Checkbox
                              id={`tam-${tamanho}`}
                              checked={tamanhoSelecionado.includes(tamanho)}
                              onCheckedChange={(checked) => handleTamanhoChange(tamanho, checked)}
                            />
                            <label
                              htmlFor={`tam-${tamanho}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {tamanho}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {tamanhoSelecionado.length > 0 && (
                      <div className="bg-white rounded-lg p-6 space-y-4">
                        <h4 className="font-semibold">Quantidade por Tamanho:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                          {tamanhoSelecionado.map(tamanho => (
                            <div key={tamanho} className="space-y-2">
                              <Label htmlFor={`qtd-${tamanho}`}>{tamanho}</Label>
                              <Input
                                id={`qtd-${tamanho}`}
                                type="number"
                                min="0"
                                value={formData.grade_configuracao.quantidades_por_tamanho[tamanho] || 0}
                                onChange={(e) => handleQuantidadeTamanho(tamanho, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-blue-900">Total de Peças na Grade:</span>
                            <span className="text-2xl font-bold text-blue-600">
                              {formData.total_pecas_grade} peças
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* Tab: Precificação */}
            <TabsContent value="precificacao" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Precificação e Margem
                </h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="custo_por_peca">Custo por Peça (R$)</Label>
                    <Input
                      id="custo_por_peca"
                      type="number"
                      step="0.01"
                      value={formData.custo_por_peca || 0}
                      onChange={(e) => {
                        setFormData({...formData, custo_por_peca: parseFloat(e.target.value) || 0});
                        calcularMargemLucro(e.target.value, formData.preco_por_peca);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preco_por_peca">Preço de Venda por Peça (R$) *</Label>
                    <Input
                      id="preco_por_peca"
                      type="number"
                      step="0.01"
                      required
                      value={formData.preco_por_peca || 0}
                      onChange={(e) => {
                        calcularPrecoGrade(e.target.value);
                        calcularMargemLucro(formData.custo_por_peca, e.target.value);
                      }}
                    />
                  </div>
                </div>

                {formData.tipo_venda === 'grade' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-green-900">Preço da Grade Completa:</span>
                      <span className="text-2xl font-bold text-green-600">
                        R$ {formData.preco_grade_completa.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      {formData.total_pecas_grade} peças × R$ {formData.preco_por_peca.toFixed(2)}
                    </p>
                  </div>
                )}

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-purple-900">Margem de Lucro:</span>
                    <span className="text-2xl font-bold text-purple-600">
                      {formData.margem_lucro}%
                    </span>
                  </div>
                  {formData.custo_por_peca > 0 && formData.preco_por_peca > 0 && (
                    <p className="text-sm text-purple-700">
                      Lucro por peça: R$ {(formData.preco_por_peca - formData.custo_por_peca).toFixed(2)}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-semibold">Calculadora de Margem</h4>
                  <p className="text-sm text-gray-600">
                    Insira a margem desejada para calcular o preço sugerido:
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Margem Desejada (%)</Label>
                      <Input
                        type="number"
                        step="1"
                        placeholder="Ex: 60"
                        onBlur={(e) => sugerirPrecoComMargem(formData.custo_por_peca, e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="pedido_minimo_grades">Pedido Mínimo (grades)</Label>
                  <Input
                    id="pedido_minimo_grades"
                    type="number"
                    min="1"
                    value={formData.pedido_minimo_grades || 1}
                    onChange={(e) => setFormData({...formData, pedido_minimo_grades: parseInt(e.target.value) || 1})}
                  />
                  <p className="text-sm text-gray-500">
                    Quantidade mínima de grades que o cliente deve comprar
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Removed Estoque TabContent */}

            {/* Tab: Fotos & Vídeos */}
            <TabsContent value="midia" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Vídeo do Produto
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="video_url">URL do Vídeo (YouTube)</Label>
                  <Input
                    id="video_url"
                    type="url"
                    value={formData.video_url || ''}
                    onChange={(e) => setFormData({...formData, video_url: e.target.value})}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <p className="text-sm text-gray-500">
                    Cole o link do vídeo do YouTube para exibição na página do produto
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Fotos do Produto</h3>
                  <ImageUploader
                    images={formData.fotos}
                    onImagesChange={(fotos) => setFormData({...formData, fotos})}
                    maxImages={10}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <Separator className="my-6" />

          {/* New: Controle de Estoque and Variants */}
          <Card>
            <CardHeader>
              <CardTitle>Controle de Estoque</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                <Switch
                  id="tem_variantes_cor_switch"
                  checked={formData.tem_variantes_cor}
                  onCheckedChange={(checked) => setFormData({ ...formData, tem_variantes_cor: checked })}
                />
                <label htmlFor="tem_variantes_cor_switch">
                  <span className="font-semibold">Produto tem variantes de cor com estoque separado</span>
                  <p className="text-sm text-gray-600">
                    Ative para gerenciar estoque por cor (Ex: Azul - 10 grades, Vermelho - 5 grades)
                  </p>
                </label>
              </div>

              {!formData.tem_variantes_cor && (
                <>
                  <div className="grid md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <Label htmlFor="estoque_atual_grades_single">Estoque Atual (Grades) *</Label>
                      <Input
                        id="estoque_atual_grades_single"
                        type="number"
                        value={formData.estoque_atual_grades || 0}
                        onChange={(e) => setFormData({ ...formData, estoque_atual_grades: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>

                    <div>
                      <Label htmlFor="estoque_minimo_grades_single">Estoque Mínimo (Grades)</Label>
                      <Input
                        id="estoque_minimo_grades_single"
                        type="number"
                        value={formData.estoque_minimo_grades || 0}
                        onChange={(e) => setFormData({ ...formData, estoque_minimo_grades: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                      <p className="text-sm text-gray-500">
                          Alerta será exibido quando o estoque atingir este valor
                        </p>
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
                      <Checkbox
                        id="permite_venda_sem_estoque_single"
                        checked={formData.permite_venda_sem_estoque}
                        onCheckedChange={(checked) => setFormData({ ...formData, permite_venda_sem_estoque: checked })}
                      />
                      <label
                        htmlFor="permite_venda_sem_estoque_single"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Permitir Pré-Venda
                      </label>
                    </div>
                  </div>

                  {formData.estoque_atual_grades <= formData.estoque_minimo_grades && (
                      <Alert className="border-yellow-200 bg-yellow-50 mt-4">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-800">
                          Estoque baixo! Considere reabastecer este produto.
                        </AlertDescription>
                      </Alert>
                    )}
                </>
              )}
            </CardContent>
          </Card>

          {/* New: Product Variants Manager */}
          {formData.tem_variantes_cor && (
            <ProductVariantsManager
              variantes={formData.variantes_cor}
              onChange={(variantes) => setFormData({ ...formData, variantes_cor: variantes })}
              gradeConfig={formData.grade_configuracao}
            />
          )}

          <Separator className="my-6" />

          {/* Configurações Finais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Configurações de Exibição</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_destaque"
                  checked={formData.is_destaque}
                  onCheckedChange={(checked) => setFormData({...formData, is_destaque: checked})}
                />
                <label
                  htmlFor="is_destaque"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Produto em Destaque
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({...formData, ativo: checked})}
                />
                <label
                  htmlFor="ativo"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Produto Ativo no Catálogo
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_lancamento">Data de Lançamento</Label>
              <Input
                id="data_lancamento"
                type="date"
                value={formData.data_lancamento || ''}
                onChange={(e) => setFormData({...formData, data_lancamento: e.target.value})}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
