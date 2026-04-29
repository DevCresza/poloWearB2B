
import { useState, useEffect } from 'react';
import { Produto } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { User } from '@/api/entities';
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
import { toast } from 'sonner';
import ProductVariantsManager from './ProductVariantsManager'; // New import
import { Switch } from '@/components/ui/switch'; // New import
import { Package, DollarSign, Palette, Ruler, Video, Calendar, AlertTriangle, Save, X } from 'lucide-react';

export default function ProductForm({ produto, onSuccess, onCancel }) {
  const [submitting, setSubmitting] = useState(false); // Renamed from 'loading'
  const [fornecedores, setFornecedores] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isUserFornecedor, setIsUserFornecedor] = useState(false);
  const [userFornecedorId, setUserFornecedorId] = useState(null);
  
  const [formData, setFormData] = useState(produto || {
    nome: '',
    descricao: '',
    marca: 'Polo Wear',
    fornecedor_id: '',
    referencia_fornecedor: '',
    referencia_polo: '',
    tipo_venda: 'grade',
    categoria: '',
    genero: '',
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
    disponivel_franqueado: true,
    disponivel_multimarca: false,
    preco_peca_multimarca: 0,
    preco_grade_multimarca: 0,
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
    visivel_apenas_capsulas: false,
    controla_estoque: true, // Kept as default true, checkbox removed
    permite_venda_sem_estoque: false,
    data_lancamento: ''
  });

  // `corAtual` and `tamanhoSelecionado` state were related to the old color management or general size selection.
  // `tamanhoSelecionado` is still relevant for grade configuration. `corAtual` and related functions are removed.
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState([]);

  const categorias = [
    'Camisetas', 'Polos', 'Camisas', 'Shorts', 'Bermudas', 'Calças',
    'Vestidos', 'Blusas', 'Regatas', 'Coletes', 'Saias', 'Jaquetas',
    'Meias', 'Acessórios', 'Calçados', 'Chinelos', 'Garrafas', 'Perfumes'
  ];

  const generos = ['Feminino', 'Masculino', 'Unissex'];

  // Grades por tipo de categoria
  const tamanhosRoupa = ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', 'G4', 'G5'];
  const tamanhosCalcaBermuda = ['36', '38', '40', '42', '44', '46', '48', '50', '52', '54'];
  const tamanhosCalcados = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43'];

  const categoriasCalcaBermuda = ['Calças', 'Bermudas'];
  const categoriasCalcados = ['Calçados', 'Chinelos'];

  // Selecionar grade baseada na categoria
  const getTamanhosPorCategoria = (categoria) => {
    if (categoriasCalcaBermuda.includes(categoria)) return tamanhosCalcaBermuda;
    if (categoriasCalcados.includes(categoria)) return tamanhosCalcados;
    return tamanhosRoupa;
  };

  const tamanhos = getTamanhosPorCategoria(formData.categoria);

  // Função para ordenar tamanhos de acordo com a ordem padrão
  const ordenarTamanhos = (tamanhosParaOrdenar) => {
    return tamanhosParaOrdenar.sort((a, b) => {
      const indexA = tamanhos.indexOf(a);
      const indexB = tamanhos.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b, undefined, { numeric: true });
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

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

        // Handle double-encoded JSON (string inside JSONB)
        if (typeof grade === 'string') {
          grade = JSON.parse(grade);
        }
      } catch (e) {
      }

      try {
        fotos = typeof produto.fotos === 'string'
          ? JSON.parse(produto.fotos)
          : produto.fotos || fotos;

        // Handle double-encoded JSON (string inside JSONB)
        if (typeof fotos === 'string') {
          fotos = JSON.parse(fotos);
        }
      } catch (e) {
      }

      try {
        variantes = typeof produto.variantes_cor === 'string'
          ? JSON.parse(produto.variantes_cor)
          : produto.variantes_cor || variantes;

        // Handle double-encoded JSON (string inside JSONB)
        if (typeof variantes === 'string') {
          variantes = JSON.parse(variantes);
        }

        // Converter cor_hex antigo para cor_codigo_hex (compatibilidade)
        // E garantir que fotos_urls seja um array válido (pode estar double-encoded)
        if (variantes && Array.isArray(variantes)) {
          variantes = variantes.map(v => {
            let fotosUrls = v.fotos_urls || [];

            // Handle double-encoded fotos_urls
            if (typeof fotosUrls === 'string') {
              try {
                fotosUrls = JSON.parse(fotosUrls);
              } catch (_e) {
                fotosUrls = [];
              }
            }

            return {
              ...v,
              cor_codigo_hex: v.cor_codigo_hex || v.cor_hex || '#000000',
              fotos_urls: Array.isArray(fotosUrls) ? fotosUrls : []
            };
          });

          // Consolidar fotos das variantes no array principal de fotos
          variantes.forEach(variante => {
            if (variante.fotos_urls && Array.isArray(variante.fotos_urls)) {
              variante.fotos_urls.forEach(fotoUrl => {
                // Verificar se foto já existe
                const photoExists = fotos.some(p => {
                  const existingUrl = typeof p === 'string' ? p : p.url;
                  return existingUrl === fotoUrl;
                });

                if (!photoExists && fotos.length < 20) {
                  // Adicionar como objeto com metadados da cor
                  fotos.push({
                    url: fotoUrl,
                    cor_nome: variante.cor_nome,
                    cor_codigo_hex: variante.cor_codigo_hex
                  });
                }
              });
            }
          });
        }
      } catch (e) {
      }

      setFormData({
        ...produto,
        fornecedor_id: produto.fornecedor_id || '', // Garantir que o fornecedor_id seja preservado
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
      // Ordenar tamanhos ao carregar produto existente
      const tamanhosOrdenados = ordenarTamanhos([...(grade.tamanhos_disponiveis || [])]);
      setTamanhoSelecionado(tamanhosOrdenados);
    }
  }, [produto]);

  const loadFornecedores = async () => {
    try {
      // Carregar usuário atual
      const user = await User.me();
      setCurrentUser(user);

      // Verificar se é usuário fornecedor
      if (user.tipo_negocio === 'fornecedor') {
        setIsUserFornecedor(true);

        // Buscar o fornecedor associado ao usuário
        // Primeiro tenta pelo fornecedor_id direto no usuário, depois pelo responsavel_user_id
        let fornecedor = null;
        if (user.fornecedor_id) {
          try {
            fornecedor = await Fornecedor.get(user.fornecedor_id);
          } catch (_e) { /* fornecedor_id inválido, tenta fallback */ }
        }
        if (!fornecedor) {
          const fornecedoresDoUsuario = await Fornecedor.filter({ responsavel_user_id: user.id });
          fornecedor = fornecedoresDoUsuario?.[0] || null;
        }

        if (fornecedor) {
          setFornecedores([fornecedor]);
          setUserFornecedorId(fornecedor.id);

          // Se for novo produto, pré-selecionar o fornecedor automaticamente
          if (!produto) {
            setFormData(prev => ({
              ...prev,
              fornecedor_id: fornecedor.id
            }));
          }
        } else {
          toast.error('Nenhum fornecedor associado ao seu usuário. Contate o administrador.');
          setFornecedores([]);
        }
      } else {
        // Admin vê todos os fornecedores
        const fornecedoresList = await Fornecedor.list();
        setFornecedores(fornecedoresList);
      }
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

    // Ordenar tamanhos automaticamente em ordem crescente (PP, P, M, G, GG...)
    const tamanhosOrdenados = ordenarTamanhos([...novosTamanhos]);

    setTamanhoSelecionado(tamanhosOrdenados);
    setFormData(prev => ({
      ...prev,
      grade_configuracao: {
        ...prev.grade_configuracao,
        tamanhos_disponiveis: tamanhosOrdenados
      }
    }));
    calcularTotalPecas(tamanhosOrdenados, formData.grade_configuracao.quantidades_por_tamanho);
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
      preco_grade_completa: total * (prev.preco_por_peca || 0),
      preco_grade_multimarca: total * (prev.preco_peca_multimarca || 0)
    }));
  };

  const calcularPrecoGrade = (precoPorPeca) => {
    setFormData(prev => ({
      ...prev,
      preco_por_peca: parseFloat(precoPorPeca) || 0,
      preco_grade_completa: (parseFloat(precoPorPeca) || 0) * prev.total_pecas_grade
    }));
  };

  const calcularMargemLucro = (sugerido, venda) => {
    const sugeridoNum = parseFloat(sugerido) || 0;
    const vendaNum = parseFloat(venda) || 0;

    if (vendaNum > 0 && sugeridoNum > 0) {
      const roi = ((sugeridoNum - vendaNum) / vendaNum) * 100;
      setFormData(prev => ({ ...prev, margem_lucro: parseFloat(roi.toFixed(2)) }));
    }
  };

  const sugerirPrecoComMarkup = (venda, markupDesejado) => {
    const vendaNum = parseFloat(venda) || 0;
    const markupNum = parseFloat(markupDesejado) || 0;

    if (vendaNum > 0 && markupNum > 0) {
      const precoSugerido = vendaNum * markupNum;
      setFormData(prev => ({
        ...prev,
        custo_por_peca: parseFloat(precoSugerido.toFixed(2)),
        margem_lucro: parseFloat((((precoSugerido - vendaNum) / vendaNum) * 100).toFixed(2))
      }));
    }
  };

  // Removed adicionarCor and removerCor as color management moves to ProductVariantsManager

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validações obrigatórias
      if (!formData.nome) {
        toast.error('Por favor, preencha o nome do produto.');
        setSubmitting(false);
        return;
      }

      if (!formData.fornecedor_id) {
        toast.error('Por favor, selecione um fornecedor.');
        setSubmitting(false);
        return;
      }

      if (!formData.categoria) {
        toast.error('Por favor, selecione uma categoria.');
        setSubmitting(false);
        return;
      }

      if (!formData.disponivel_franqueado && !formData.disponivel_multimarca) {
        toast.error('Selecione ao menos um perfil de cliente (Franqueado ou Multimarca).');
        setSubmitting(false);
        return;
      }

      if (formData.disponivel_franqueado && (!formData.preco_por_peca || formData.preco_por_peca <= 0)) {
        toast.error('Informe o preço de venda para Franqueado (maior que zero).');
        setSubmitting(false);
        return;
      }

      if (formData.disponivel_multimarca && (!formData.preco_peca_multimarca || formData.preco_peca_multimarca <= 0)) {
        toast.error('Informe o preço de venda para Multimarca (maior que zero).');
        setSubmitting(false);
        return;
      }

      if (formData.tem_variantes_cor) {
        if (!formData.variantes_cor || formData.variantes_cor.length === 0) {
          toast.error('Adicione pelo menos uma variante de cor, ou desative "Produto tem variantes de cor".');
          setSubmitting(false);
          return;
        }
        // Converter cor_hex para cor_codigo_hex se necessário (compatibilidade)
        const variantesNormalizadas = formData.variantes_cor.map(v => ({
          ...v,
          cor_codigo_hex: v.cor_codigo_hex || v.cor_hex || '#000000'
        }));

        const variantesInvalidas = variantesNormalizadas.filter(v => !v.cor_nome || !v.cor_codigo_hex);
        if (variantesInvalidas.length > 0) {
          toast.error('Todas as variantes precisam ter um nome e um código HEX de cor.');
          setSubmitting(false);
          return;
        }

        // Atualizar formData com variantes normalizadas
        formData.variantes_cor = variantesNormalizadas;
      } else if (formData.estoque_atual_grades < 0) {
        toast.error('O estoque atual não pode ser negativo.');
        setSubmitting(false);
        return;
      }

      // Preparar dados para envio (JSONB aceita objetos diretamente, não precisa stringify)
      const dataToSave = {
        ...formData,
        grade_configuracao: formData.grade_configuracao,
        fotos: formData.fotos,
        variantes_cor: formData.tem_variantes_cor ? formData.variantes_cor : null,
        // Se tem variantes e disponibilidade é pronta_entrega, calcular estoque
        // Caso contrário, usar 0 ou o estoque informado
        estoque_atual_grades: formData.tem_variantes_cor && formData.disponibilidade === 'pronta_entrega'
          ? formData.variantes_cor.reduce((sum, v) => sum + (v.estoque_grades || 0), 0)
          : formData.disponibilidade === 'pronta_entrega'
            ? formData.estoque_atual_grades
            : 0,
        // Set controla_estoque to true only for pronta_entrega
        controla_estoque: formData.disponibilidade === 'pronta_entrega',
        // Convert empty date strings to null (PostgreSQL DATE columns don't accept empty strings)
        data_inicio_venda: formData.data_inicio_venda || null,
        data_limite_venda: formData.data_limite_venda || null,
        data_prevista_entrega: formData.data_prevista_entrega || null,
        data_lancamento: formData.data_lancamento || null
      };

      // Remover campos que não devem ser enviados na criação/atualização
      const { id, created_at, updated_at, ...cleanData } = dataToSave;

      // Remover campos undefined ou null que causariam erro no banco
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === undefined) {
          delete cleanData[key];
        }
      });

      // Verificar se é edição (produto existente com ID válido) ou criação
      const isEditing = produto && produto.id && typeof produto.id === 'string' && produto.id.length > 0;

      if (isEditing) {
        await Produto.update(produto.id, cleanData);
      } else {
        await Produto.create(cleanData);
      }
      
      toast.success('Produto salvo com sucesso!');
      onSuccess();
    } catch (error) {
      toast.error(`Erro ao salvar produto. Verifique os campos e tente novamente. ${error.message || ''}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-slate-100 rounded-3xl shadow-neumorphic">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Package className="w-6 h-6" />
              {produto?.id ? 'Editar Produto' : 'Novo Produto'}
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
          </div>
          {produto?.id && (produto?.created_at || produto?.updated_at) && (
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
              {produto?.created_at && (
                <span>
                  📅 Criado em: <strong>{new Date(produto.created_at).toLocaleString('pt-BR')}</strong>
                </span>
              )}
              {produto?.updated_at && (
                <span>
                  🔄 Última modificação: <strong>{new Date(produto.updated_at).toLocaleString('pt-BR')}</strong>
                </span>
              )}
            </div>
          )}
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
                  <Select
                    value={formData.fornecedor_id || undefined}
                    onValueChange={(value) => setFormData({...formData, fornecedor_id: value})}
                    disabled={isUserFornecedor}
                  >
                    <SelectTrigger className={isUserFornecedor ? 'bg-gray-100' : ''}>
                      <SelectValue placeholder="Selecione o fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome_fantasia || f.razao_social || f.nome_marca}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isUserFornecedor && (
                    <p className="text-xs text-gray-500">Fornecedor associado à sua conta</p>
                  )}
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

                <div className="space-y-2">
                  <Label htmlFor="genero">Gênero</Label>
                  <Select value={formData.genero || ''} onValueChange={(value) => setFormData({...formData, genero: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gênero" />
                    </SelectTrigger>
                    <SelectContent>
                      {generos.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
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
                        <SelectItem value="pre_venda">Pré-Venda</SelectItem>
                        <SelectItem value="sob_encomenda">Sob Encomenda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(formData.disponibilidade === 'pre_venda' || formData.disponibilidade === 'sob_encomenda') && (
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
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Selecione os Tamanhos Disponíveis:</h4>
                        {tamanhoSelecionado.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTamanhoSelecionado([]);
                              setFormData(prev => ({
                                ...prev,
                                grade_configuracao: {
                                  ...prev.grade_configuracao,
                                  tamanhos_disponiveis: [],
                                  quantidades_por_tamanho: {}
                                }
                              }));
                              setTotalPecas(0);
                            }}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            Desmarcar Todos
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                        {tamanhos.map(tamanho => (
                          <button
                            key={tamanho}
                            type="button"
                            onClick={() => handleTamanhoChange(tamanho, !tamanhoSelecionado.includes(tamanho))}
                            className={`
                              h-12 w-full rounded-lg font-semibold text-base transition-all duration-200
                              ${tamanhoSelecionado.includes(tamanho)
                                ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                              }
                            `}
                          >
                            {tamanho}
                          </button>
                        ))}
                      </div>
                    </div>

                    {tamanhoSelecionado.length > 0 && (
                      <div className="bg-white rounded-lg p-6 space-y-4">
                        <h4 className="font-semibold">Quantidade por Tamanho:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                          {ordenarTamanhos([...tamanhoSelecionado]).map(tamanho => (
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
                  Precificação
                </h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="custo_por_peca">Preço de Venda Sugerido (R$)</Label>
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
                    <Label htmlFor="preco_por_peca">Preço Franqueado por Peça (R$)</Label>
                    <Input
                      id="preco_por_peca"
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!formData.disponivel_franqueado}
                      value={formData.preco_por_peca || 0}
                      onChange={(e) => {
                        calcularPrecoGrade(e.target.value);
                        calcularMargemLucro(formData.custo_por_peca, e.target.value);
                      }}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                  <h4 className="font-semibold text-blue-900">Disponibilidade por Perfil de Cliente</h4>
                  <p className="text-xs text-blue-700">Defina para quais perfis este produto está disponível e seus respectivos preços.</p>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-2 bg-white rounded-lg border p-3">
                      <Checkbox
                        id="disp_franqueado"
                        checked={formData.disponivel_franqueado}
                        onCheckedChange={(checked) => setFormData({ ...formData, disponivel_franqueado: !!checked })}
                      />
                      <div className="flex-1">
                        <Label htmlFor="disp_franqueado" className="cursor-pointer font-medium">Franqueado</Label>
                        <p className="text-xs text-gray-500">Usa preço da seção acima (Preço Franqueado por Peça)</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-white rounded-lg border p-3">
                      <Checkbox
                        id="disp_multimarca"
                        checked={formData.disponivel_multimarca}
                        onCheckedChange={(checked) => setFormData({ ...formData, disponivel_multimarca: !!checked })}
                      />
                      <div className="flex-1">
                        <Label htmlFor="disp_multimarca" className="cursor-pointer font-medium">Multimarca</Label>
                        <p className="text-xs text-gray-500">Somente pagamento à vista (sem boleto)</p>
                      </div>
                    </div>
                  </div>

                  {formData.disponivel_multimarca && (
                    <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-blue-200">
                      <div className="space-y-2">
                        <Label htmlFor="preco_peca_multimarca">Preço Multimarca por Peça (R$) *</Label>
                        <Input
                          id="preco_peca_multimarca"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={formData.preco_peca_multimarca || 0}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            setFormData(prev => ({
                              ...prev,
                              preco_peca_multimarca: v,
                              preco_grade_multimarca: v * (prev.total_pecas_grade || 0)
                            }));
                          }}
                        />
                      </div>
                      {formData.tipo_venda === 'grade' && (
                        <div className="space-y-2">
                          <Label>Preço Multimarca por Grade (R$)</Label>
                          <div className="bg-white border rounded px-3 py-2 text-lg font-bold text-blue-700">
                            R$ {(formData.preco_grade_multimarca || 0).toFixed(2)}
                          </div>
                          <p className="text-xs text-gray-500">
                            {formData.total_pecas_grade} peças × R$ {(formData.preco_peca_multimarca || 0).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
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

                {formData.custo_por_peca > 0 && formData.preco_por_peca > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-900">Markup (multiplicador):</span>
                      <span className="text-2xl font-bold text-purple-600">
                        {(formData.custo_por_peca / formData.preco_por_peca).toFixed(2)}×
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-900">ROI do lojista:</span>
                      <span className="text-2xl font-bold text-purple-600">
                        {formData.margem_lucro}%
                      </span>
                    </div>
                    <p className="text-sm text-purple-700">
                      Ganho por peça: R$ {(formData.custo_por_peca - formData.preco_por_peca).toFixed(2)}
                    </p>
                  </div>
                )}

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-semibold">Calculadora de Markup</h4>
                  <p className="text-sm text-gray-600">
                    Insira o multiplicador desejado para calcular o preço sugerido ao lojista:
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Markup Desejado (×)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 2.5"
                        onBlur={(e) => sugerirPrecoComMarkup(formData.preco_por_peca, e.target.value)}
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
                  <Label htmlFor="video_url">URL do Vídeo (YouTube ou Instagram Reels)</Label>
                  <Input
                    id="video_url"
                    type="url"
                    value={formData.video_url || ''}
                    onChange={(e) => setFormData({...formData, video_url: e.target.value})}
                    placeholder="https://www.youtube.com/watch?v=... ou https://www.instagram.com/reel/..."
                  />
                  <p className="text-sm text-gray-500">
                    Cole o link do YouTube ou de um Reels do Instagram. O vídeo aparece na galeria do produto.
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Fotos do Produto</h3>
                  <ImageUploader
                    images={formData.fotos}
                    onImagesChange={(fotos) => setFormData(prev => ({...prev, fotos}))}
                    maxImages={20}
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
                  {formData.disponibilidade === 'pronta_entrega' ? (
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
                  ) : (
                    <div className="mt-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                          Este produto está em <strong>Pré-Venda/Sob Encomenda</strong>. O estoque não é controlado para produtos neste modo.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* New: Product Variants Manager */}
          {formData.tem_variantes_cor && (
            <ProductVariantsManager
              variantes={formData.variantes_cor}
              onChange={(variantes) => setFormData(prev => ({ ...prev, variantes_cor: variantes }))}
              gradeConfig={formData.grade_configuracao}
              disponibilidade={formData.disponibilidade}
              onPhotoAdded={(photoData) => {
                // Adiciona a foto das variantes também ao array principal de fotos
                // Usar forma funcional para evitar race condition com onChange
                setFormData(prev => {
                  const currentPhotos = prev.fotos || [];
                  const photoUrl = typeof photoData === 'string' ? photoData : photoData.url;
                  const photoExists = currentPhotos.some(p => {
                    const existingUrl = typeof p === 'string' ? p : p.url;
                    return existingUrl === photoUrl;
                  });

                  if (!photoExists && currentPhotos.length < 20) {
                    return { ...prev, fotos: [...currentPhotos, photoData] };
                  }
                  return prev;
                });
              }}
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
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    ativo: checked,
                    visivel_apenas_capsulas: checked ? false : formData.visivel_apenas_capsulas
                  })}
                />
                <label
                  htmlFor="ativo"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Produto Ativo no Catálogo
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="visivel_apenas_capsulas"
                  checked={formData.visivel_apenas_capsulas || false}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    visivel_apenas_capsulas: checked,
                    ativo: checked ? false : formData.ativo
                  })}
                />
                <label
                  htmlFor="visivel_apenas_capsulas"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Visível Apenas em Cápsulas
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
