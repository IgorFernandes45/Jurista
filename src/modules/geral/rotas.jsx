import { BarChart3, CreditCard, LayoutDashboard } from 'lucide-react'
import { FormasPagamento } from './FormasPagamento'
import { Painel } from './Painel'
import { Relatorios } from './Relatorios'

export const rotasGeral = {
  secao: null,
  itens: [
    { caminho: '/', titulo: 'Painel', icone: LayoutDashboard, elemento: <Painel /> },
    { caminho: '/relatorios', titulo: 'Relatórios', icone: BarChart3, elemento: <Relatorios /> },
  ],
}

export const rotasConfiguracoes = {
  secao: 'Configurações',
  itens: [
    { caminho: '/configuracoes/formas-pagamento', titulo: 'Formas de pagamento', icone: CreditCard, elemento: <FormasPagamento /> },
  ],
}
