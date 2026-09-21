import { CreditCard, LayoutDashboard } from 'lucide-react'
import { FormasPagamento } from './FormasPagamento'
import { EmConstrucao } from '@/shared/components/EmConstrucao'

export const rotasGeral = {
  secao: null,
  itens: [
    { caminho: '/', titulo: 'Painel', icone: LayoutDashboard, elemento: <EmConstrucao titulo="Painel" sprint={7} /> },
  ],
}

export const rotasConfiguracoes = {
  secao: 'Configurações',
  itens: [
    { caminho: '/configuracoes/formas-pagamento', titulo: 'Formas de pagamento', icone: CreditCard, elemento: <FormasPagamento /> },
  ],
}
