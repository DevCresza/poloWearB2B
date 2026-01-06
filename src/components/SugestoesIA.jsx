import { useState, useEffect } from 'react';
import { Produto } from '@/api/entities';
import { Pedido } from '@/api/entities';
import { User } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Clock, Star, ShoppingCart } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function SugestoesIA({ onAddToCart }) {
  const [sugestoes, setSugestoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadSugestoes();
  }, []);

  const loadSugestoes = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const [produtosList, pedidosList] = await Promise.all([
        Produto.list(),
        Pedido.filter({ comprador_user_id: currentUser.id })
      ]);

      // Análise de produtos já comprados
      const produtosComprados = new Map();
      const dataUltimaCompra = new Map();

      pedidosList.forEach(pedido => {
        try {
          const itens = JSON.parse(pedido.itens);
          itens.forEach(item => {
            produtosComprados.set(item.produto_id, true);
            const dataPedido = new Date(pedido.created_date);
            if (!dataUltimaCompra.has(item.produto_id) || dataPedido > dataUltimaCompra.get(item.produto_id)) {
              dataUltimaCompra.set(item.produto_id, dataPedido);
            }
          });
        } catch (_e) {
        }
      });

      // Produtos não comprados ou com compra há mais de 60 dias
      const hoje = new Date();
      const sessentaDiasAtras = new Date();
      sessentaDiasAtras.setDate(hoje.getDate() - 60);

      const produtosSugeridos = produtosList
        .filter(p => p.ativo && p.estoque_atual_grades > 0)
        .map(produto => {
          const jaComprou = produtosComprados.has(produto.id);
          const ultimaCompra = dataUltimaCompra.get(produto.id);
          
          let razao = '';
          let score = 0;

          if (!jaComprou) {
            razao = 'Você ainda não comprou este produto';
            score = 3;
          } else if (ultimaCompra && ultimaCompra < sessentaDiasAtras) {
            const diasDesdeUltimaCompra = Math.floor((hoje - ultimaCompra) / (1000 * 60 * 60 * 24));
            razao = `Última compra há ${diasDesdeUltimaCompra} dias`;
            score = 2;
          }

          // Aumentar score se for destaque ou estoque baixo
          if (produto.is_destaque) score += 1;
          if (produto.estoque_atual_grades <= produto.estoque_minimo_grades * 2) {
            razao += ' • Estoque limitado!';
            score += 1;
          }

          return { ...produto, razao, score };
        })
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      // Usar IA para enriquecer as sugestões
      if (produtosSugeridos.length > 0) {
        try {
          const prompt = `
Com base no histórico de compras do cliente e nos produtos disponíveis, 
gere uma descrição personalizada para cada sugestão de produto.

Produtos sugeridos:
${produtosSugeridos.map(p => `- ${p.nome} (${p.marca}): ${p.razao}`).join('\n')}

Para cada produto, forneça:
1. Um motivo personalizado (1 frase curta)
2. Um benefício de comprar agora (1 frase curta)

Retorne em JSON com formato:
[{"produto_nome": "...", "motivo": "...", "beneficio": "..."}]
          `;

          const iaResponse = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
              type: "object",
              properties: {
                sugestoes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      produto_nome: { type: "string" },
                      motivo: { type: "string" },
                      beneficio: { type: "string" }
                    }
                  }
                }
              }
            }
          });

          // Mesclar respostas da IA com produtos
          const sugestoesComIA = produtosSugeridos.map(produto => {
            const iaData = iaResponse.sugestoes?.find(s => s.produto_nome === produto.nome);
            return {
              ...produto,
              motivo_ia: iaData?.motivo || produto.razao,
              beneficio_ia: iaData?.beneficio || 'Aproveite enquanto está disponível!'
            };
          });

          setSugestoes(sugestoesComIA);
        } catch (_error) {
          setSugestoes(produtosSugeridos);
        }
      } else {
        setSugestoes([]);
      }
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <CardContent className="p-8 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-600 animate-pulse" />
          <p className="text-purple-800 font-medium">Gerando sugestões personalizadas com IA...</p>
        </CardContent>
      </Card>
    );
  }

  if (sugestoes.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-800">
          <Sparkles className="w-6 h-6" />
          Sugestões Personalizadas por IA
        </CardTitle>
        <p className="text-sm text-purple-600">
          Produtos selecionados especialmente para você com base no seu histórico de compras
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sugestoes.map((produto) => (
            <div
              key={produto.id}
              className="bg-white rounded-lg p-4 border-2 border-purple-200 hover:border-purple-400 transition-all hover:shadow-lg"
            >
              {produto.fotos && produto.fotos[0] && (
                <img
                  src={produto.fotos[0]}
                  alt={produto.nome}
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />
              )}

              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">{produto.nome}</h4>
                <Badge variant="outline" className="text-xs">{produto.marca}</Badge>

                <div className="flex items-start gap-2 text-xs text-purple-700 bg-purple-50 p-2 rounded">
                  <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{produto.motivo_ia}</span>
                </div>

                <div className="flex items-start gap-2 text-xs text-pink-700 bg-pink-50 p-2 rounded">
                  <Star className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{produto.beneficio_ia}</span>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-900">
                      R$ {produto.preco_grade_completa?.toFixed(2)}
                    </span>
                    <Badge className="bg-green-100 text-green-800 text-xs">
                      {produto.estoque_atual_grades} em estoque
                    </Badge>
                  </div>

                  <Button
                    onClick={() => onAddToCart(produto)}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    size="sm"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Adicionar ao Carrinho
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Button onClick={loadSugestoes} variant="outline" className="text-purple-600 border-purple-300">
            <Sparkles className="w-4 h-4 mr-2" />
            Gerar Novas Sugestões
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}