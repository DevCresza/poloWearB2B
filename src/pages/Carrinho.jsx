import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Pedido } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ShoppingCart, Trash2, Plus, Minus, Package, AlertTriangle, 
  CheckCircle, CreditCard, ArrowRight, Building, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

export default function Carrinho() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [carrinho, setCarrinho] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [finalizando, setFinalizando] = useState({});
  const [metodoPagamento, setMetodoPagamento] = useState({});
  const [observacoes, setObservacoes] = useState({});

  useEffect(() => {
    loadData();
    loadCarrinho();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const fornecedoresList = await Fornecedor.list();
      setFornecedores(fornecedoresList || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadCarrinho = () => {
    const carrinhoSalvo = localStorage.getItem('carrinho');
    if (carrinhoSalvo) {
      setCarrinho(JSON.parse(carrinhoSalvo));
    }
  };

  const salvarCarrinho = (novoCarrinho) => {
    setCarrinho(novoCarrinho);
    localStorage.setItem('carrinho', JSON.stringify(novoCarrinho));
  };

  // Helper para parsear fotos do produto (vem como JSON string do banco)
  const getPrimeiraFoto = (item) => {
    try {
      if (!item.fotos) return null;
      const fotos = typeof item.fotos === 'string' ? JSON.parse(item.fotos) : item.fotos;
      return fotos && fotos.length > 0 ? fotos[0] : null;
    } catch (e) {
      return null;
    }
  };

  const removerItem = (produtoId, corSelecionada = null) => {
    const novoCarrinho = carrinho.filter(item => {
      if (corSelecionada) {
        return !(item.id === produtoId && item.cor_selecionada?.cor_nome === corSelecionada.cor_nome);
      }
      return item.id !== produtoId;
    });
    salvarCarrinho(novoCarrinho);
  };

  const atualizarQuantidade = (produtoId, novaQuantidade, corSelecionada = null) => {
    if (novaQuantidade <= 0) {
      removerItem(produtoId, corSelecionada);
      return;
    }

    const novoCarrinho = carrinho.map(item => {
      const match = corSelecionada 
        ? item.id === produtoId && item.cor_selecionada?.cor_nome === corSelecionada.cor_nome
        : item.id === produtoId && !item.cor_selecionada;
      
      return match ? { ...item, quantidade: novaQuantidade } : item;
    });
    salvarCarrinho(novoCarrinho);
  };

  const limparCarrinho = () => {
    if (confirm('Deseja realmente limpar todo o carrinho?')) {
      salvarCarrinho([]);
    }
  };

  const agruparPorFornecedor = () => {
    const grupos = {};
    carrinho.forEach(item => {
      if (!grupos[item.fornecedor_id]) {
        grupos[item.fornecedor_id] = {
          fornecedor_id: item.fornecedor_id,
          itens: [],
          total: 0
        };
      }
      grupos[item.fornecedor_id].itens.push(item);
      const preco = item.tipo_venda === 'grade' 
        ? item.preco_grade_completa 
        : item.preco_por_peca;
      grupos[item.fornecedor_id].total += preco * item.quantidade;
    });
    return Object.values(grupos);
  };

  const getMetodosPagamentoDisponiveis = (fornecedorId) => {
    const fornecedor = fornecedores.find(f => f.id === fornecedorId);
    const metodos = [
      { value: 'pix', label: 'PIX' },
      { value: 'cartao_credito', label: 'Cartão de Crédito' },
      { value: 'boleto', label: 'Boleto' },
      { value: 'transferencia', label: 'Transferência Bancária' }
    ];

    if (fornecedor && fornecedor.clientes_boleto_faturado &&
        user && fornecedor.clientes_boleto_faturado.includes(user.id)) {
      metodos.push({ value: 'boleto_faturado', label: 'Boleto Faturado (30 dias)' });
    }

    return metodos;
  };

  const finalizarCompraPorFornecedor = async (fornecedorId) => {
    if (!user.endereco_completo || !user.cep || !user.cidade || !user.estado) {
      alert('Por favor, cadastre seu endereço de entrega completo no seu perfil antes de finalizar o pedido.');
      return;
    }

    if (!metodoPagamento[fornecedorId]) {
      alert('Por favor, selecione um método de pagamento para este fornecedor.');
      return;
    }

    setFinalizando(prev => ({ ...prev, [fornecedorId]: true }));

    try {
      const grupo = agruparPorFornecedor().find(g => g.fornecedor_id === fornecedorId);
      if (!grupo) {
        throw new Error('Grupo de fornecedor não encontrado');
      }

      const fornecedor = fornecedores.find(f => f.id === fornecedorId);
      if (fornecedor && fornecedor.pedido_minimo_valor > 0) {
        if (grupo.total < fornecedor.pedido_minimo_valor) {
          alert(
            `O pedido para ${fornecedor.nome_marca} não atingiu o valor mínimo de R$ ${fornecedor.pedido_minimo_valor.toFixed(2)}. ` +
            `Valor atual: R$ ${grupo.total.toFixed(2)}`
          );
          setFinalizando(prev => ({ ...prev, [fornecedorId]: false }));
          return;
        }
      }

      const itensPedido = grupo.itens.map(item => ({
        produto_id: item.id,
        nome: item.nome,
        marca: item.marca,
        referencia: item.referencia_polo || item.referencia_fornecedor || '',
        tipo_venda: item.tipo_venda,
        quantidade: item.quantidade,
        preco: item.tipo_venda === 'grade' ? item.preco_grade_completa : item.preco_por_peca,
        total: (item.tipo_venda === 'grade' ? item.preco_grade_completa : item.preco_por_peca) * item.quantidade,
        foto: getPrimeiraFoto(item),
        grade_selecionada: item.grade_configuracao || null,
        cor_selecionada: item.cor_selecionada || null
      }));

      // Construir objeto de endereço a partir dos campos do usuário
      const enderecoEntrega = {
        endereco: user.endereco_completo,
        cep: user.cep,
        cidade: user.cidade,
        estado: user.estado,
        destinatario: user.full_name,
        telefone: user.telefone || user.whatsapp
      };

      const pedido = await Pedido.create({
        comprador_user_id: user.id,
        fornecedor_id: fornecedorId,
        itens: JSON.stringify(itensPedido),
        valor_total: grupo.total,
        valor_final: grupo.total, // Valor final sem desconto ou frete
        status: 'novo_pedido',
        status_pagamento: 'pendente',
        metodo_pagamento: metodoPagamento[fornecedorId],
        endereco_entrega: enderecoEntrega,
        observacoes: observacoes[fornecedorId] || '',
        observacoes_comprador: observacoes[fornecedorId] || ''
      });

      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 30);

      await Carteira.create({
        pedido_id: pedido.id,
        cliente_user_id: user.id,
        tipo: 'a_pagar', // Cliente vai pagar
        descricao: `Pedido #${pedido.id.substring(0, 8)} - ${fornecedor?.nome_fantasia || fornecedor?.nome_marca}`,
        valor: grupo.total,
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        status: 'pendente',
        categoria: 'Pedido'
      });

      try {
        await base44.functions.invoke('notificarPedidoFornecedor', { pedidoId: pedido.id });
      } catch (notifError) {
      }

      const novoCarrinho = carrinho.filter(item => item.fornecedor_id !== fornecedorId);
      salvarCarrinho(novoCarrinho);

      const fornecedorNome = fornecedor?.nome_marca || 'Fornecedor';
      const contatoFornecedor = fornecedor?.contato_envio_whatsapp || fornecedor?.contato_comercial_whatsapp || 'Não disponível';
      const emailFornecedor = fornecedor?.contato_envio_email || fornecedor?.contato_comercial_email || 'Não disponível';
      
      alert(
        `✅ Pedido para ${fornecedorNome} criado com sucesso!\n\n` +
        `📧 Email: ${emailFornecedor}\n` +
        `📱 WhatsApp: ${contatoFornecedor}\n\n` +
        `O fornecedor foi notificado automaticamente e entrará em contato em breve.`
      );

      if (novoCarrinho.length === 0) {
        navigate(createPageUrl('MeusPedidos'));
      }
    } catch (error) {
      alert('Erro ao processar o pedido. Tente novamente.');
    } finally {
      setFinalizando(prev => ({ ...prev, [fornecedorId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const grupos = agruparPorFornecedor();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <Button 
              variant="ghost" 
              onClick={() => navigate(createPageUrl('Catalogo'))}
              className="mb-2 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Continuar Comprando
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8" />
              Meu Carrinho
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              {carrinho.length} {carrinho.length === 1 ? 'item' : 'itens'} no carrinho
            </p>
          </div>

          {carrinho.length > 0 && (
            <Button variant="outline" onClick={limparCarrinho} className="w-full sm:w-auto">
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar Carrinho
            </Button>
          )}
        </div>

        {carrinho.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
              <ShoppingCart className="w-20 h-20 sm:w-24 sm:h-24 text-gray-400 mb-4" />
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 text-center">
                Seu carrinho está vazio
              </h2>
              <p className="text-gray-600 mb-6 text-center text-sm sm:text-base">
                Adicione produtos do catálogo para começar a comprar
              </p>
              <Button onClick={() => navigate(createPageUrl('Catalogo'))} className="bg-blue-600">
                <Package className="w-4 h-4 mr-2" />
                Ir para o Catálogo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* Alerta sobre endereço */}
            {(!user?.endereco_completo || !user?.cep || !user?.cidade || !user?.estado) && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 text-sm sm:text-base">
                  <strong>Atenção:</strong> Você precisa cadastrar seu endereço de entrega completo no seu perfil antes de finalizar os pedidos.
                </AlertDescription>
              </Alert>
            )}

            {/* Lista de Produtos por Fornecedor */}
            {grupos.map((grupo, index) => {
              const fornecedor = fornecedores.find(f => f.id === grupo.fornecedor_id);
              const valorMinimo = fornecedor?.pedido_minimo_valor || 0;
              const atingiuMinimo = grupo.total >= valorMinimo;
              const metodosPagamento = getMetodosPagamentoDisponiveis(grupo.fornecedor_id);

              return (
                <Card key={index} className="overflow-hidden">
                  <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building className="w-5 h-5" />
                        <span className="text-lg sm:text-xl">{fornecedor?.nome_marca || 'Fornecedor'}</span>
                      </div>
                      <Badge variant="outline" className="text-sm">
                        {grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}
                      </Badge>
                    </CardTitle>
                    {valorMinimo > 0 && (
                      <Alert className={`mt-3 ${atingiuMinimo ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
                        {atingiuMinimo ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                        <AlertDescription className={`text-sm ${atingiuMinimo ? 'text-green-800' : 'text-yellow-800'}`}>
                          {atingiuMinimo ? (
                            `Valor mínimo atingido (R$ ${valorMinimo.toFixed(2)})`
                          ) : (
                            `Valor mínimo: R$ ${valorMinimo.toFixed(2)} (Faltam R$ ${(valorMinimo - grupo.total).toFixed(2)})`
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    {/* Produtos */}
                    <div className="space-y-4">
                      {grupo.itens.map((item, itemIndex) => {
                        const preco = item.tipo_venda === 'grade' 
                          ? item.preco_grade_completa 
                          : item.preco_por_peca;
                        const itemKey = `${item.id}_${item.cor_selecionada?.cor_nome || 'default'}`;

                        return (
                          <div key={itemKey} className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                            {getPrimeiraFoto(item) ? (
                              <img
                                src={getPrimeiraFoto(item)}
                                alt={item.nome}
                                className="w-full sm:w-24 h-48 sm:h-24 object-cover rounded-md"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full sm:w-24 h-48 sm:h-24 bg-gray-200 rounded-md flex items-center justify-center">
                                <Package className="w-8 h-8 text-gray-400" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-base sm:text-lg text-gray-900 line-clamp-2">{item.nome}</h3>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline">{item.marca}</Badge>
                                <Badge variant="outline">
                                  {item.tipo_venda === 'grade' 
                                    ? `Grade ${item.total_pecas_grade} pç` 
                                    : 'Unitário'}
                                </Badge>
                                {item.cor_selecionada && (
                                  <Badge variant="outline">{item.cor_selecionada.cor_nome}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-2">
                                R$ {preco.toFixed(2)} cada
                              </p>
                            </div>

                            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-between gap-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removerItem(item.id, item.cor_selecionada)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => atualizarQuantidade(item.id, item.quantidade - 1, item.cor_selecionada)}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <span className="w-12 text-center font-semibold">
                                  {item.quantidade}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => atualizarQuantidade(item.id, item.quantidade + 1, item.cor_selecionada)}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>

                              <div className="text-right">
                                <p className="text-lg font-bold text-green-600">
                                  R$ {(preco * item.quantidade).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Separator />

                    {/* Total e Checkout por Fornecedor */}
                    <div className="space-y-4 bg-blue-50 p-4 sm:p-6 rounded-lg border border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-lg">Total:</span>
                        <span className="text-2xl sm:text-3xl font-bold text-green-600">
                          R$ {grupo.total.toFixed(2)}
                        </span>
                      </div>

                      <div>
                        <Label className="flex items-center gap-2 mb-2">
                          <CreditCard className="w-4 h-4" />
                          Método de Pagamento *
                        </Label>
                        <Select 
                          value={metodoPagamento[grupo.fornecedor_id] || ''} 
                          onValueChange={(value) => setMetodoPagamento(prev => ({ ...prev, [grupo.fornecedor_id]: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {metodosPagamento.map(metodo => (
                              <SelectItem key={metodo.value} value={metodo.value}>
                                {metodo.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {metodosPagamento.length === 2 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Opção Boleto Faturado não disponível para sua conta
                          </p>
                        )}
                      </div>

                      <div>
                        <Label className="mb-2 block">Observações (Opcional)</Label>
                        <Textarea
                          value={observacoes[grupo.fornecedor_id] || ''}
                          onChange={(e) => setObservacoes(prev => ({ ...prev, [grupo.fornecedor_id]: e.target.value }))}
                          placeholder="Adicione observações sobre seu pedido..."
                          rows={3}
                        />
                      </div>

                      <Button
                        onClick={() => finalizarCompraPorFornecedor(grupo.fornecedor_id)}
                        disabled={
                          finalizando[grupo.fornecedor_id] ||
                          !atingiuMinimo ||
                          !metodoPagamento[grupo.fornecedor_id] ||
                          !user?.endereco_completo ||
                          !user?.cep ||
                          !user?.cidade ||
                          !user?.estado
                        }
                        className="w-full h-12 sm:h-14 bg-green-600 hover:bg-green-700 text-base sm:text-lg font-semibold"
                      >
                        {finalizando[grupo.fornecedor_id] ? (
                          <>Processando...</>
                        ) : (
                          <>
                            Finalizar Pedido - {fornecedor?.nome_marca}
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </>
                        )}
                      </Button>

                      {!atingiuMinimo && (
                        <p className="text-xs text-center text-yellow-700">
                          Adicione mais R$ {(valorMinimo - grupo.total).toFixed(2)} para atingir o valor mínimo deste fornecedor
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}