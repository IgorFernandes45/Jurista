import { ArrowLeft, Ban, CircleStop, HandCoins, Pencil, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { useConfirm } from '@/shared/components/Confirm'
import { Input } from '@/shared/components/Field'
import { Modal } from '@/shared/components/Modal'
import { Badge, Card, EmptyState, PageHeader } from '@/shared/components/Page'
import { useToast } from '@/shared/components/Toast'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'
import { formatarData, formatarMoeda } from '@/shared/lib/format'
import { explicarJuros, SITUACOES, TIPOS_DIVIDA } from './juros'
import { ModalPagamento } from './ModalPagamento'

export function DetalheDivida() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirmar = useConfirm()
  const [parcelaEmEdicao, setParcelaEmEdicao] = useState(null)
  const [parcelaRecebendo, setParcelaRecebendo] = useState(null)
  const [pagamentoEmEdicao, setPagamentoEmEdicao] = useState(null)

  const { dados, carregando, erro, recarregar } = useConsulta(
    () => supabase.from('dividas_resumo').select('*').eq('id', id).maybeSingle(),
    [id],
  )

  const {
    dados: parcelas,
    carregando: carregandoParcelas,
    recarregar: recarregarParcelas,
  } = useConsulta(() => supabase.from('parcelas_resumo').select('*').eq('divida_id', id).order('numero'), [id])

  const {
    dados: pagamentos,
    carregando: carregandoPagamentos,
    recarregar: recarregarPagamentos,
  } = useConsulta(
    () => supabase.from('pagamentos_resumo').select('*').eq('divida_id', id).order('data', { ascending: false }),
    [id],
  )

  function recarregarTudo() {
    recarregar()
    recarregarParcelas()
    recarregarPagamentos()
  }

  async function estornar(pagamento) {
    const ok = await confirmar({
      titulo: 'Estornar recebimento',
      mensagem: 'O recebimento será apagado e o saldo da dívida volta ao que era.',
      textoConfirmar: 'Estornar',
      perigo: true,
    })
    if (!ok) return
    const { error } = await supabase.rpc('estornar_pagamento', { p_pagamento_id: pagamento.id })
    if (error) return toast.erro(error.message ?? traduzirErroBanco(error))
    toast.sucesso('Recebimento estornado.')
    recarregarTudo()
  }

  async function encerrarRecorrencia() {
    const ok = await confirmar({
      titulo: 'Encerrar recorrência',
      mensagem: 'O sistema para de gerar novas mensalidades. As já existentes continuam para cobrança.',
      textoConfirmar: 'Encerrar',
    })
    if (!ok) return
    const { error } = await supabase.from('dividas').update({ recorrencia_ativa: false }).eq('id', id)
    if (error) return toast.erro(traduzirErroBanco(error))
    toast.sucesso('Recorrência encerrada.')
    recarregar()
  }

  async function cancelarDivida() {
    const ok = await confirmar({
      titulo: 'Cancelar dívida',
      mensagem: 'A dívida sai das cobranças e dos alertas, mas continua guardada no histórico.',
      textoConfirmar: 'Cancelar dívida',
      perigo: true,
    })
    if (!ok) return
    const { error } = await supabase
      .from('dividas')
      .update({ status: 'cancelada', recorrencia_ativa: false })
      .eq('id', id)
    if (error) return toast.erro(traduzirErroBanco(error))
    toast.sucesso('Dívida cancelada.')
    recarregar()
  }

  if (carregando) return <p className="text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="text-sm text-red-600">{traduzirErroBanco(erro, { padrao: 'Não foi possível carregar a dívida.' })}</p>
  if (!dados) {
    return (
      <EmptyState
        titulo="Dívida não encontrada"
        acao={
          <Link to="/cobranca/devedores" className="text-sm font-medium text-brand-600 hover:underline">
            Voltar para devedores
          </Link>
        }
      />
    )
  }

  const situacao = SITUACOES[dados.situacao] ?? SITUACOES.em_dia
  const tipo = TIPOS_DIVIDA.find((t) => t.valor === dados.tipo)?.rotulo ?? dados.tipo
  const cancelada = dados.status === 'cancelada'

  return (
    <>
      <Link
        to={`/cobranca/devedores/${dados.devedor_id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" />
        {dados.devedor_nome}
      </Link>

      <PageHeader
        titulo={dados.descricao || tipo}
        descricao={`${tipo} · lançada em ${formatarData(dados.created_at)}`}
        acoes={
          <>
            <Badge cor={situacao.cor}>{situacao.rotulo}</Badge>
            {!cancelada && (
              <>
                <Button variant="secondary" icon={Pencil} onClick={() => navigate(`/cobranca/dividas/${id}/editar`)}>
                  Editar
                </Button>
                {dados.tipo === 'recorrente' && dados.recorrencia_ativa && (
                  <Button variant="secondary" icon={CircleStop} onClick={encerrarRecorrencia}>
                    Encerrar recorrência
                  </Button>
                )}
                <Button variant="danger" icon={Ban} onClick={cancelarDivida}>
                  Cancelar dívida
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Total atualizado hoje</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{formatarMoeda(dados.total_devido)}</p>
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Valor em aberto</dt>
              <dd className="font-medium text-slate-800">{formatarMoeda(dados.principal_restante)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Juros acumulados</dt>
              <dd className="font-medium text-slate-800">{formatarMoeda(dados.juros_em_aberto)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Juros já pagos</dt>
              <dd className="text-slate-700">{formatarMoeda(dados.juros_pago)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Dias de atraso</dt>
              <dd className={dados.dias_atraso > 0 ? 'font-medium text-red-600' : 'text-slate-700'}>
                {dados.dias_atraso}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Regra de juros</p>
          <p className="mt-2 text-sm text-slate-700">{explicarJuros(dados)}</p>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-slate-500">Valor original</p>
              <p className="font-medium text-slate-800">{formatarMoeda(dados.valor_original)}</p>
            </div>
            <div>
              <p className="text-slate-500">Primeiro vencimento</p>
              <p className="font-medium text-slate-800">{formatarData(dados.data_vencimento)}</p>
            </div>
            <div>
              <p className="text-slate-500">Próximo vencimento</p>
              <p className="font-medium text-slate-800">
                {dados.proximo_vencimento ? formatarData(dados.proximo_vencimento) : '—'}
              </p>
            </div>
          </div>

          {dados.observacao && (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap text-slate-700">
              {dados.observacao}
            </p>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            {dados.tipo === 'recorrente' ? 'Mensalidades' : 'Parcelas'}
          </h2>
          {dados.tipo === 'recorrente' && dados.recorrencia_ativa && (
            <span className="text-xs text-slate-500">Novas mensalidades são criadas todo mês automaticamente.</span>
          )}
        </div>

        {carregandoParcelas ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Em aberto</th>
                  <th className="px-4 py-3 font-medium">Juros</th>
                  <th className="px-4 py-3 font-medium">Total hoje</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(parcelas ?? []).map((p) => {
                  const s = SITUACOES[p.situacao] ?? SITUACOES.em_dia
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-slate-500">{p.numero}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatarData(p.vencimento)}</td>
                      <td className="px-4 py-3">{formatarMoeda(p.valor)}</td>
                      <td className="px-4 py-3">{formatarMoeda(p.principal_restante)}</td>
                      <td className="px-4 py-3">{formatarMoeda(p.juros_acumulado)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{formatarMoeda(p.total_atualizado)}</td>
                      <td className="px-4 py-3">
                        <Badge cor={s.cor}>
                          {s.rotulo}
                          {p.dias_atraso > 0 ? ` · ${p.dias_atraso}d` : ''}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!cancelada && !p.pago && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" icon={HandCoins} onClick={() => setParcelaRecebendo(p)}>
                              Receber
                            </Button>
                            <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setParcelaEmEdicao(p)}>
                              Editar
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Recebimentos</h2>
        {carregandoPagamentos ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : (pagamentos ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Nenhum recebimento lançado nesta dívida.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pagamentos.map((pg) => (
              <div
                key={pg.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {formatarMoeda(pg.valor_pago)}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {formatarMoeda(pg.valor_juros)} de juros + {formatarMoeda(pg.valor_principal)} do valor original
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatarData(pg.data)}
                    {pg.parcela_numero ? ` · parcela ${pg.parcela_numero}` : ''}
                    {pg.forma_pagamento_nome ? ` · ${pg.forma_pagamento_nome}` : ''}
                    {pg.observacao ? ` · ${pg.observacao}` : ''}
                  </p>
                </div>
                {!cancelada && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setPagamentoEmEdicao(pg)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" icon={Undo2} onClick={() => estornar(pg)}>
                      Estornar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalParcela
        parcela={parcelaEmEdicao}
        onFechar={() => setParcelaEmEdicao(null)}
        onSalvo={() => {
          setParcelaEmEdicao(null)
          recarregarTudo()
        }}
      />

      {parcelaRecebendo && (
        <ModalPagamento
          divida={dados}
          parcela={parcelaRecebendo}
          onFechar={() => setParcelaRecebendo(null)}
          onSalvo={() => {
            setParcelaRecebendo(null)
            recarregarTudo()
          }}
        />
      )}

      {pagamentoEmEdicao && (
        <ModalPagamento
          pagamento={pagamentoEmEdicao}
          onFechar={() => setPagamentoEmEdicao(null)}
          onSalvo={() => {
            setPagamentoEmEdicao(null)
            recarregarTudo()
          }}
        />
      )}
    </>
  )
}

function ModalParcela({ parcela, onFechar, onSalvo }) {
  const toast = useToast()
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [ultima, setUltima] = useState(null)

  if (parcela !== ultima) {
    setUltima(parcela)
    setValor(parcela ? String(parcela.valor) : '')
    setVencimento(parcela?.vencimento ?? '')
    setErro('')
  }

  if (!parcela) return null

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (Number(valor) <= 0) return setErro('O valor precisa ser maior que zero.')
    if (!vencimento) return setErro('Informe o vencimento.')

    setSalvando(true)
    const { error } = await supabase
      .from('parcelas')
      .update({ valor: Number(valor), vencimento })
      .eq('id', parcela.id)
    setSalvando(false)

    if (error) return setErro(traduzirErroBanco(error))
    toast.sucesso('Parcela atualizada.')
    onSalvo()
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`Editar parcela ${parcela.numero}`}
      largura="max-w-md"
      rodape={
        <>
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button form="form-parcela" type="submit" loading={salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="form-parcela" onSubmit={salvar} className="flex flex-col gap-4">
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <Input label="Valor" type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Input label="Vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
      </form>
    </Modal>
  )
}
