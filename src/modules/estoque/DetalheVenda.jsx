import { ArrowLeft, Ban, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { useConfirm } from '@/shared/components/Confirm'
import { Badge, Card, EmptyState, PageHeader } from '@/shared/components/Page'
import { useToast } from '@/shared/components/Toast'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'
import { formatarDataHora, formatarMoeda, formatarQuantidade, formatarTelefone } from '@/shared/lib/format'

export function DetalheVenda() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirmar = useConfirm()
  const [cancelando, setCancelando] = useState(false)

  const { dados, carregando, erro, recarregar } = useConsulta(
    () =>
      supabase
        .from('vendas')
        .select('*, formas_pagamento(nome), venda_itens(id, quantidade, preco_unit, subtotal, produtos(nome, sku))')
        .eq('id', id)
        .maybeSingle(),
    [id],
  )

  async function cancelar() {
    const ok = await confirmar({
      titulo: 'Cancelar venda',
      mensagem: 'Os produtos voltam para o estoque e a venda fica marcada como cancelada.',
      textoConfirmar: 'Cancelar venda',
      perigo: true,
    })
    if (!ok) return

    setCancelando(true)
    const { error } = await supabase.rpc('cancelar_venda', { p_venda_id: id })
    setCancelando(false)
    if (error) return toast.erro(error.message ?? traduzirErroBanco(error))
    toast.sucesso('Venda cancelada e estoque devolvido.')
    recarregar()
  }

  if (carregando) return <p className="text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="text-sm text-red-600">{traduzirErroBanco(erro, { padrao: 'Não foi possível carregar a venda.' })}</p>
  if (!dados) {
    return (
      <EmptyState
        titulo="Venda não encontrada"
        acao={
          <Link to="/estoque/vendas" className="text-sm font-medium text-brand-600 hover:underline">
            Voltar para o histórico
          </Link>
        }
      />
    )
  }

  const cancelada = dados.status === 'cancelada'

  return (
    <>
      <Link
        to="/estoque/vendas"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" />
        Histórico de vendas
      </Link>

      <PageHeader
        titulo={formatarMoeda(dados.total)}
        descricao={formatarDataHora(dados.data)}
        acoes={
          <>
            <Badge cor={cancelada ? 'cinza' : 'verde'}>{cancelada ? 'Cancelada' : 'Ativa'}</Badge>
            {!cancelada && (
              <>
                <Button variant="secondary" icon={Pencil} onClick={() => navigate(`/estoque/vendas/${id}/editar`)}>
                  Editar
                </Button>
                <Button variant="danger" icon={Ban} loading={cancelando} onClick={cancelar}>
                  Cancelar venda
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="mb-3 text-xs font-medium tracking-wide text-slate-400 uppercase">Itens</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Produto</th>
                  <th className="py-2 pr-3 font-medium">Qtd.</th>
                  <th className="py-2 pr-3 font-medium">Preço</th>
                  <th className="py-2 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dados.venda_itens.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3 text-slate-800">
                      {item.produtos?.nome}
                      {item.produtos?.sku && <span className="block text-xs text-slate-500">{item.produtos.sku}</span>}
                    </td>
                    <td className="py-2 pr-3">{formatarQuantidade(item.quantidade)}</td>
                    <td className="py-2 pr-3">{formatarMoeda(item.preco_unit)}</td>
                    <td className="py-2 font-medium">{formatarMoeda(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col items-end gap-1 border-t border-slate-100 pt-3 text-sm">
            <p className="text-slate-500">
              Produtos: <span className="font-medium text-slate-700">{formatarMoeda(dados.subtotal)}</span>
            </p>
            {Number(dados.desconto) > 0 && (
              <p className="text-slate-500">
                Desconto: <span className="font-medium text-slate-700">− {formatarMoeda(dados.desconto)}</span>
              </p>
            )}
            <p className="text-lg font-semibold text-slate-900">{formatarMoeda(dados.total)}</p>
          </div>
        </Card>

        <Card>
          <p className="mb-3 text-xs font-medium tracking-wide text-slate-400 uppercase">Dados da venda</p>
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Cliente</dt>
              <dd className="text-slate-800">{dados.cliente_nome ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Telefone</dt>
              <dd className="text-slate-800">
                {dados.cliente_telefone ? formatarTelefone(dados.cliente_telefone) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Forma de pagamento</dt>
              <dd className="text-slate-800">{dados.formas_pagamento?.nome ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Observação</dt>
              <dd className="whitespace-pre-wrap text-slate-800">{dados.observacao ?? '—'}</dd>
            </div>
            {cancelada && (
              <div>
                <dt className="text-slate-500">Cancelada em</dt>
                <dd className="text-slate-800">{formatarDataHora(dados.cancelada_em)}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
    </>
  )
}
