import { AlertTriangle, Boxes, CalendarClock, CheckCircle2, Copy, HandCoins } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Select } from '@/shared/components/Field'
import { Badge, Card, PageHeader } from '@/shared/components/Page'
import { useToast } from '@/shared/components/Toast'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { formatarData, formatarMoeda, formatarQuantidade } from '@/shared/lib/format'
import { SITUACOES } from './juros'
import { ModalPagamento } from './ModalPagamento'

function emDias(dias) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function Alertas() {
  const toast = useToast()
  const [janela, setJanela] = useState('7')
  const [recebendo, setRecebendo] = useState(null)

  const { dados: parcelas, carregando, recarregar } = useConsulta(
    () =>
      supabase
        .from('parcelas_resumo')
        .select('*')
        .eq('pago', false)
        .lte('vencimento', emDias(Number(janela)))
        .order('vencimento'),
    [janela],
  )

  const { dados: produtos } = useConsulta(() => supabase.from('produtos_alerta').select('*').order('nome'))

  const atrasadas = (parcelas ?? []).filter((p) => p.dias_atraso > 0)
  const proximas = (parcelas ?? []).filter((p) => p.dias_atraso === 0)

  const totalAtrasado = atrasadas.reduce((s, p) => s + Number(p.total_atualizado), 0)
  const totalProximo = proximas.reduce((s, p) => s + Number(p.total_atualizado), 0)

  async function abrirRecebimento(parcela) {
    const { data } = await supabase.from('dividas_resumo').select('*').eq('id', parcela.divida_id).maybeSingle()
    if (data) setRecebendo({ divida: data, parcela })
  }

  async function copiarLink(parcela) {
    const { data } = await supabase.from('devedores').select('link_token').eq('id', parcela.devedor_id).maybeSingle()
    if (!data) return toast.erro('Não foi possível pegar o link.')
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/d/${data.link_token}`)
      toast.sucesso('Link do devedor copiado.')
    } catch {
      toast.erro('Não foi possível copiar o link.')
    }
  }

  function Linha({ p }) {
    const situacao = SITUACOES[p.situacao] ?? SITUACOES.em_dia
    return (
      <div className="flex flex-col gap-2 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
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
            {p.divida_tipo !== 'a_vista' ? ` · parcela ${p.numero}` : ''} · vence {formatarData(p.vencimento)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-semibold text-slate-900">{formatarMoeda(p.total_atualizado)}</p>
            {Number(p.juros_em_aberto) > 0 && (
              <p className="text-xs text-slate-500">inclui {formatarMoeda(p.juros_em_aberto)} de juros</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" icon={HandCoins} onClick={() => abrirRecebimento(p)}>
              Receber
            </Button>
            <Button size="sm" variant="secondary" icon={Copy} onClick={() => copiarLink(p)}>
              Link
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        titulo="Alertas"
        descricao="Quem está atrasado, o que vence em breve e o estoque no limite."
        acoes={
          <Select value={janela} onChange={(e) => setJanela(e.target.value)} className="w-44">
            <option value="3">Próximos 3 dias</option>
            <option value="7">Próximos 7 dias</option>
            <option value="15">Próximos 15 dias</option>
            <option value="30">Próximos 30 dias</option>
          </Select>
        }
      />

      {carregando ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <AlertTriangle className="size-4" />
                Em atraso ({atrasadas.length})
              </h2>
              {atrasadas.length > 0 && (
                <p className="text-sm font-semibold text-slate-900">{formatarMoeda(totalAtrasado)}</p>
              )}
            </div>
            {atrasadas.length === 0 ? (
              <p className="flex items-center gap-2 py-2 text-sm text-slate-500">
                <CheckCircle2 className="size-4 text-green-600" /> Ninguém em atraso.
              </p>
            ) : (
              atrasadas.map((p) => <Linha key={p.id} p={p} />)
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                <CalendarClock className="size-4" />
                Vencendo nos próximos {janela} dias ({proximas.length})
              </h2>
              {proximas.length > 0 && (
                <p className="text-sm font-semibold text-slate-900">{formatarMoeda(totalProximo)}</p>
              )}
            </div>
            {proximas.length === 0 ? (
              <p className="py-2 text-sm text-slate-500">Nada vencendo nesse período.</p>
            ) : (
              proximas.map((p) => <Linha key={p.id} p={p} />)
            )}
          </Card>

          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Boxes className="size-4" />
              Estoque no mínimo ou abaixo ({(produtos ?? []).length})
            </h2>
            {(produtos ?? []).length === 0 ? (
              <p className="py-2 text-sm text-slate-500">Nenhum produto em alerta.</p>
            ) : (
              (produtos ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
                >
                  <div>
                    <Link to="/estoque/produtos" className="font-medium text-brand-700 hover:underline">
                      {p.nome}
                    </Link>
                    <p className="text-xs text-slate-500">mínimo {formatarQuantidade(p.estoque_minimo)}</p>
                  </div>
                  <Badge cor={p.negativo ? 'vermelho' : 'amarelo'}>
                    estoque {formatarQuantidade(p.estoque_atual)}
                  </Badge>
                </div>
              ))
            )}
          </Card>
        </div>
      )}

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
