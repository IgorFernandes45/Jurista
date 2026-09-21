import { AlertTriangle, ArrowRight, Boxes, CalendarClock, HandCoins, ShoppingCart, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/modules/auth/AuthProvider'
import { Card, PageHeader } from '@/shared/components/Page'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { cn } from '@/shared/lib/cn'
import { formatarMoeda } from '@/shared/lib/format'

function Indicador({ titulo, valor, detalhe, icone: Icone, cor = 'padrao', para }) {
  const cores = {
    padrao: 'text-slate-900',
    verde: 'text-green-700',
    vermelho: 'text-red-600',
    amarelo: 'text-amber-600',
  }

  const conteudo = (
    <Card className={cn('h-full transition-colors', para && 'hover:border-brand-300')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{titulo}</p>
        {Icone && <Icone className="size-4 shrink-0 text-slate-300" />}
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', cores[cor])}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </Card>
  )

  return para ? <Link to={para}>{conteudo}</Link> : conteudo
}

export function Painel() {
  const { perfil, usuario } = useAuth()
  const nome = (perfil?.nome || usuario?.user_metadata?.nome || '').split(' ')[0]

  const { dados, carregando, erro } = useConsulta(() => supabase.rpc('painel'))

  if (carregando) return <p className="text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="text-sm text-red-600">Não foi possível carregar o painel.</p>

  const { vendas, estoque, cobranca, recebido_mes: recebidoMes } = dados

  return (
    <>
      <PageHeader
        titulo={nome ? `Olá, ${nome}` : 'Painel'}
        descricao="Resumo de hoje nos dois módulos."
      />

      <h2 className="mb-3 text-sm font-semibold text-slate-700">Cobrança</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          titulo="Em atraso"
          valor={formatarMoeda(cobranca.atrasado)}
          detalhe={`${cobranca.qtd_atrasadas} dívida(s), já com juros`}
          icone={AlertTriangle}
          cor={Number(cobranca.atrasado) > 0 ? 'vermelho' : 'padrao'}
          para="/cobranca/alertas"
        />
        <Indicador
          titulo="Vence hoje"
          valor={formatarMoeda(cobranca.vence_hoje)}
          detalhe={`${cobranca.qtd_vence_hoje} dívida(s)`}
          icone={CalendarClock}
          cor={Number(cobranca.vence_hoje) > 0 ? 'amarelo' : 'padrao'}
          para="/cobranca/calendario"
        />
        <Indicador
          titulo="Próximos 7 dias"
          valor={formatarMoeda(cobranca.proximos_7)}
          detalhe={`${cobranca.qtd_proximos_7} dívida(s)`}
          icone={CalendarClock}
          para="/cobranca/calendario"
        />
        <Indicador
          titulo="Total a receber"
          valor={formatarMoeda(cobranca.a_receber)}
          detalhe={`Recebido no mês: ${formatarMoeda(recebidoMes)}`}
          icone={HandCoins}
          para="/cobranca/recebimentos"
        />
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-slate-700">Estoque e vendas</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          titulo="Vendas de hoje"
          valor={formatarMoeda(vendas.hoje_total)}
          detalhe={`${vendas.hoje_qtd} venda(s)`}
          icone={ShoppingCart}
          cor="verde"
          para="/estoque/vendas"
        />
        <Indicador
          titulo="Vendas do mês"
          valor={formatarMoeda(vendas.mes_total)}
          detalhe={`${vendas.mes_qtd} venda(s)`}
          icone={TrendingUp}
          para="/estoque/vendas"
        />
        <Indicador
          titulo="Estoque baixo"
          valor={String(estoque.em_alerta)}
          detalhe={
            Number(estoque.negativos) > 0
              ? `${estoque.negativos} produto(s) com estoque negativo`
              : 'produto(s) no mínimo ou abaixo'
          }
          icone={Boxes}
          cor={Number(estoque.em_alerta) > 0 ? 'amarelo' : 'padrao'}
          para="/cobranca/alertas"
        />
        <Card className="flex h-full flex-col justify-center gap-2">
          <Link
            to="/estoque/nova-venda"
            className="flex items-center justify-between rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Nova venda <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/cobranca/nova-divida"
            className="flex items-center justify-between rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Nova dívida <ArrowRight className="size-4" />
          </Link>
        </Card>
      </div>
    </>
  )
}
