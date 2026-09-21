import { AlertTriangle, CalendarClock, CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn } from '@/shared/lib/cn'
import { formatarData, formatarMoeda } from '@/shared/lib/format'

const CORES_SITUACAO = {
  em_dia: 'bg-green-100 text-green-700',
  vence_em_breve: 'bg-amber-100 text-amber-700',
  vence_hoje: 'bg-amber-100 text-amber-700',
  atrasada: 'bg-red-100 text-red-700',
  paga: 'bg-slate-100 text-slate-600',
  quitada: 'bg-slate-100 text-slate-600',
}

const ROTULOS_SITUACAO = {
  em_dia: 'Em dia',
  vence_em_breve: 'Vence em breve',
  vence_hoje: 'Vence hoje',
  atrasada: 'Atrasada',
  paga: 'Paga',
  quitada: 'Quitada',
}

// Página pública que o devedor abre pelo link, sem login e somente leitura
export function AreaDevedor() {
  const { token } = useParams()
  const [estado, setEstado] = useState({ carregando: true, dados: null, erro: false })

  useEffect(() => {
    // não queremos essa página em buscadores
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  useEffect(() => {
    let cancelado = false
    if (!supabase) return setEstado({ carregando: false, dados: null, erro: true })

    supabase.rpc('area_devedor', { p_token: token }).then(({ data, error }) => {
      if (cancelado) return
      setEstado({ carregando: false, dados: data ?? null, erro: Boolean(error) })
    })
    return () => {
      cancelado = true
    }
  }, [token])

  if (estado.carregando) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader2 className="size-8 animate-spin text-brand-600" />
      </div>
    )
  }

  if (estado.erro || !estado.dados) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <AlertTriangle className="mx-auto size-8 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold text-slate-900">Link inválido ou desativado</h1>
          <p className="mt-2 text-sm text-slate-600">
            Peça um link novo para quem enviou esta cobrança.
          </p>
        </div>
      </div>
    )
  }

  const { devedor, resumo, dividas, pagamentos, atualizado_em: atualizadoEm } = estado.dados
  const emAtraso = Number(resumo?.total_atrasado ?? 0) > 0
  const quitado = Number(resumo?.total_devido ?? 0) <= 0

  return (
    <div className="min-h-full bg-slate-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <div>
          <p className="text-sm text-slate-500">Olá,</p>
          <h1 className="text-2xl font-bold text-slate-900">{devedor.nome}</h1>
        </div>

        <div
          className={cn(
            'rounded-2xl border p-5',
            quitado ? 'border-green-200 bg-green-50' : emAtraso ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white',
          )}
        >
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Total em aberto hoje</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{formatarMoeda(resumo?.total_devido ?? 0)}</p>

          {quitado ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-green-700">
              <CheckCircle2 className="size-4" /> Não há valores em aberto. Obrigado!
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-1 text-sm">
              {resumo?.proximo_vencimento && (
                <p className="flex items-center gap-2 text-slate-700">
                  <CalendarClock className="size-4 text-slate-400" />
                  Próximo vencimento: <strong>{formatarData(resumo.proximo_vencimento)}</strong>
                </p>
              )}
              {emAtraso && (
                <p className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="size-4" />
                  Em atraso: <strong>{formatarMoeda(resumo.total_atrasado)}</strong> (já com juros)
                </p>
              )}
            </div>
          )}
        </div>

        {dividas?.map((d, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">{d.descricao || 'Cobrança'}</p>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', CORES_SITUACAO[d.situacao])}>
                {ROTULOS_SITUACAO[d.situacao] ?? d.situacao}
                {d.dias_atraso > 0 ? ` · ${d.dias_atraso} dia(s)` : ''}
              </span>
            </div>

            <dl className="mt-3 flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Valor em aberto</dt>
                <dd className="text-slate-800">{formatarMoeda(d.principal_restante)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Juros acumulados</dt>
                <dd className="text-slate-800">{formatarMoeda(d.juros_em_aberto)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-1">
                <dt className="font-medium text-slate-700">Total atualizado</dt>
                <dd className="font-semibold text-slate-900">{formatarMoeda(d.total_devido)}</dd>
              </div>
            </dl>

            {d.parcelas?.length > 1 && (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Parcelas</p>
                {d.parcelas.map((p) => (
                  <div key={p.numero} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-600">
                      {p.numero}ª · {formatarData(p.vencimento)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={p.pago ? 'text-slate-400 line-through' : 'font-medium text-slate-800'}>
                        {formatarMoeda(p.total_atualizado || p.valor)}
                      </span>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs', CORES_SITUACAO[p.situacao])}>
                        {ROTULOS_SITUACAO[p.situacao] ?? p.situacao}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {devedor.instrucoes_pagamento && (
          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
            <p className="text-xs font-medium tracking-wide text-brand-700 uppercase">Como pagar</p>
            <p className="mt-2 text-sm whitespace-pre-wrap text-slate-800">{devedor.instrucoes_pagamento}</p>
          </div>
        )}

        {pagamentos?.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Pagamentos recebidos</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              {pagamentos.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-slate-600">
                    {formatarData(p.data)}
                    {p.divida ? ` · ${p.divida}` : ''}
                  </span>
                  <span className="font-medium text-slate-800">{formatarMoeda(p.valor_pago)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="pb-4 text-center text-xs text-slate-400">
          Valores atualizados em {formatarData(atualizadoEm)}. Esta página é somente para consulta.
        </p>
      </div>
    </div>
  )
}
