import { Boxes, History, Package, ShoppingCart } from 'lucide-react'
import { DetalheVenda } from './DetalheVenda'
import { Movimentos } from './Movimentos'
import { NovaVenda } from './NovaVenda'
import { Produtos } from './Produtos'
import { Vendas } from './Vendas'

export const rotasEstoque = {
  secao: 'Estoque & Vendas',
  itens: [
    { caminho: '/estoque/produtos', titulo: 'Produtos', icone: Package, elemento: <Produtos /> },
    { caminho: '/estoque/nova-venda', titulo: 'Nova venda', icone: ShoppingCart, elemento: <NovaVenda /> },
    { caminho: '/estoque/vendas', titulo: 'Histórico de vendas', icone: History, elemento: <Vendas /> },
    { caminho: '/estoque/movimentos', titulo: 'Estoque', icone: Boxes, elemento: <Movimentos /> },
  ],
}

// Rotas que existem mas não aparecem no menu
export const rotasEstoqueExtras = [
  { caminho: '/estoque/vendas/:id', elemento: <DetalheVenda /> },
  { caminho: '/estoque/vendas/:id/editar', elemento: <NovaVenda /> },
]
