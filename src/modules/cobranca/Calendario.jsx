import { ChevronLeft, ChevronRight, HandCoins } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Badge, Card, PageHeader } from '@/shared/components/Page'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { cn } from '@/shared/lib/cn'
import { formatarData, formatarMoeda } from '@/shared/lib/format'
import { SITUACOES } from './juros'
import { ModalPagamento } from './ModalPagamento'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const iso = (data) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`
}

// verde = em dia, amarelo = vence hoje ou em breve, vermelho = atrasada
const COR_PONTO = {
  em_dia: 'bg-green-500',
  vence_em_breve: 'bg-amber-500',
  vence_hoje: 'bg-amber-500',
  atrasada: 'bg-red-500',
  paga: 'bg-slate-300',
}

export function Calendario() {
  const hoje = new Date()
  const [mes, setMes] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() })
  const [diaSelecionado, setDiaSelecionado] = useState(iso(hoje))
  const [recebendo, setRecebendo] = useState(null)

  const primeiroDia = new Date(mes.ano, mes.mes, 1)
  const ultimoDia = new Date(mes.ano, mes.mes + 1, 0)

  const { dados, carregando, recarregar } = useConsulta(
    () =>
      supabase
        .from('parcelas_resumo')
        .select('*')
        .gte('vencimento', iso(primeiroDia))
        .lte('vencimento', iso(ultimoDia))
        .order('vencimento'),
    [mes.ano, mes.mes],
  )

  const parcelas = dados ?? []
  const porDia = parcelas.reduce((mapa, p) => {
    ;(mapa[p.vencimento] ??= []).push(p)
    return mapa
  }, {})

  const doDia = porDia[diaSelecionado] ?? []

  function mudarMes(delta) {
    const nova = new Date(mes.ano, mes.mes + delta, 1)
    setMes({ ano: nova.getFullYear(), mes: nova.getMonth() })
  }

  async function abrirRecebimento(parcela) {
    const { data } = await supabase.from('dividas_resumo').select('*').eq('id', parcela.divida_id).maybeSingle()
    if (data) setRecebendo({ divida: data, parcela })
  }

  // células vazias antes do dia 1, para alinhar com o dia da semana
  const celulas = [
    ...Array(primeiroDia.getDay()).fill(null),
    ...Array.from({ length: ultimoDia.getDate() }, (_, i) => new Date(mes.ano, mes.mes, i + 1)),
  ]

  return (
    <>
      <PageHeader titulo="Calendário" descricao="Vencimentos do mês. Clique num dia para ver os detalhes." />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" icon={ChevronLeft} onClick={() => mudarMes(-1)} aria-label="Mês anterior" />
          <p className="text-sm font-semibold text-slate-800">
            {MESES[mes.mes]} de {mes.ano}
          </p>
          <Button variant="ghost" icon={ChevronRight} onClick={() => mudarMes(1)} aria-label="Próximo mês" />
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {DIAS.map((d) => (
            <div key={d} className="pb-1 text-xs font-medium text-slate-400">
              {d}
            </div>
          ))}

          {celulas.map((data, i) => {
            if (!data) return <div key={`vazio-${i}`} />
            const chave = iso(data)
            const doDiaLista = porDia[chave] ?? []
            const total = doDiaLista.reduce((s, p) => s + Number(p.total_atualizado), 0)
            const ehHoje = chave === iso(hoje)
            const selecionado = chave === diaSelecionado

            return (
              <button
                key={chave}
                onClick={() => setDiaSelecionado(chave)}
                className={cn(
                  'flex min-h-16 flex-col items-center rounded-lg border p-1 text-xs transition-colors',
                  selecionado ? 'border-brand-500 bg-brand-50' : 'border-transparent hover:bg-slate-50',
                  ehHoje && !selecionado && 'border-slate-300',
                )}
              >
                <span className={cn('font-medium', ehHoje ? 'text-brand-700' : 'text-slate-700')}>
                  {data.getDate()}
                </span>
                {doDiaLista.length > 0 && (
                  <>
                    <span className="mt-1 flex flex-wrap justify-center gap-0.5">
                      {doDiaLista.slice(0, 4).map((p) => (
                        <span key={p.id} className={cn('size-1.5 rounded-full', COR_PONTO[p.situacao])} />
                      ))}
                    </span>
                    <span className="mt-1 hidden text-[10px] text-slate-500 sm:block">{formatarMoeda(total)}</span>
                  </>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green-500" /> em dia
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" /> vence hoje ou em breve
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-500" /> atrasada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-slate-300" /> paga
          </span>
        </div>
      </Card>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">{formatarData(diaSelecionado)}</h2>

        {carregando ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : doDia.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Nenhum vencimento neste dia.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {doDia.map((p) => {
              const situacao = SITUACOES[p.situacao] ?? SITUACOES.em_dia
              return (
                <Card key={p.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/cobranca/dividas/${p.divida_id}`} className="font-medium text-brand-700 hover:underline">
                        {p.devedor_nome}
                      </Link>
                      <Badge cor={situacao.cor}>
                        {situacao.rotulo}
                        {p.dias_atraso > 0 ? ` · ${p.dias_atraso}d` : ''}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {p.divida_descricao || 'Cobrança'}
                      {p.divida_tipo !== 'a_vista' ? ` · parcela ${p.numero}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-slate-900">{formatarMoeda(p.total_atualizado)}</p>
                    {!p.pago && (
                      <Button size="sm" icon={HandCoins} onClick={() => abrirRecebimento(p)}>
                        Receber
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {recebendo && (
        <ModalPagamento
          divida={recebendo.divida}
          parcela={recebendo.parcela}
          onFechar={() => setRecebendo(null)}
          onSalvo={() => {
            setRecebendo(null)
            recarregar()
          }}
        />
      )}
    </>
  )
}
