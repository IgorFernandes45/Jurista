import { CreditCard, LayoutDashboard } from 'lucide-react'
import { FormasPagamento } from './FormasPagamento'
import { Painel } from './Painel'

export const rotasGeral = {
  secao: null,
  itens: [
    { caminho: '/', titulo: 'Painel', icone: LayoutDashboard, elemento: <Painel /> },
  ],
}

export const rotasConfiguracoes = {
  secao: 'Configurações',
  itens: [
    { caminho: '/configuracoes/formas-pagamento', titulo: 'Formas de pagamento', icone: CreditCard, elemento: <FormasPagamento /> },
  ],
}
