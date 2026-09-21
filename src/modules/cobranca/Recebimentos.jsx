import { HandCoins, Pencil, Plus, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { useConfirm } from '@/shared/components/Confirm'
import { Input, Select } from '@/shared/components/Field'
import { Card, EmptyState, PageHeader } from '@/shared/components/Page'
import { Table } from '@/shared/components/Table'
import { useToast } from '@/shared/components/Toast'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'
import { formatarData, formatarMoeda } from '@/shared/lib/format'
import { ModalPagamento } from './ModalPagamento'
import { ModalEscolherDivida } from './ModalEscolherDivida'

export function Recebimentos() {
  const toast = useToast()
  const confirmar = useConfirm()
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [devedorId, setDevedorId] = useState('')
  const [formaId, setFormaId] = useState('')
  const [emEdicao, setEmEdicao] = useState(null)
  const [escolhendo, setEscolhendo] = useState(false)
  const [novoPagamento, setNovoPagamento] = useState(null)

  const { dados: devedores } = useConsulta(() => supabase.from('devedores').select('id, nome').order('nome'))
  const { dados: formas } = useConsulta(() => supabase.from('formas_pagamento').select('id, nome').order('nome'))

  const { dados, carregando, erro, recarregar } = useConsulta(() => {
    let q = supabase.from('pagamentos_resumo').select('*').order('data', { ascending: false }).limit(300)
    if (de) q = q.gte('data', de)
    if (ate) q = q.lte('data', ate)
    if (devedorId) q = q.eq('devedor_id', devedorId)
    if (formaId) q = q.eq('forma_pagamento_id', formaId)
    return q
  }, [de, ate, devedorId, formaId])

  const pagamentos = dados ?? []
  const totais = pagamentos.reduce(
    (soma, p) => ({
      total: soma.total + Number(p.valor_pago),
      juros: soma.juros + Number(p.valor_juros),
      principal: soma.principal + Number(p.valor_principal),
    }),
    { total: 0, juros: 0, principal: 0 },
  )

  async function estornar(pagamento) {
    const ok = await confirmar({
      titulo: 'Estornar recebimento',
      mensagem: `O recebimento de ${formatarMoeda(pagamento.valor_pago)} será apagado e o saldo da dívida volta ao que era.`,
      textoConfirmar: 'Estornar',
      perigo: true,
    })
    if (!ok) return

    const { error } = await supabase.rpc('estornar_pagamento', { p_pagamento_id: pagamento.id })
    if (error) return toast.erro(error.message ?? traduzirErroBanco(error))
    toast.sucesso('Recebimento estornado.')
    recarregar()
  }

  const colunas = [
    { chave: 'data', titulo: 'Data', render: (p) => formatarData(p.data) },
    {
      chave: 'devedor',
      titulo: 'Devedor',
      render: (p) => (
        <Link to={`/cobranca/dividas/${p.divida_id}`} className="font-medium text-brand-700 hover:underline">
          {p.devedor_nome}
        </Link>
      ),
    },
    {
      chave: 'divida',
      titulo: 'Dívida',
      render: (p) => (
        <span className="text-slate-600">
          {p.divida_descricao ?? '—'}
          {p.parcela_numero ? ` · parcela ${p.parcela_numero}` : ''}
        </span>
      ),
    },
    { chave: 'valor_juros', titulo: 'Juros', render: (p) => formatarMoeda(p.valor_juros) },
    { chave: 'valor_principal', titulo: 'Principal', render: (p) => formatarMoeda(p.valor_principal) },
    {
      chave: 'valor_pago',
      titulo: 'Total',
      render: (p) => <span className="font-medium text-slate-800">{formatarMoeda(p.valor_pago)}</span>,
    },
    { chave: 'forma', titulo: 'Pagamento', render: (p) => p.forma_pagamento_nome ?? '—' },
    {
      chave: 'acoes',
      titulo: '',
      className: 'text-right',
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEmEdicao(p)}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" icon={Undo2} onClick={() => estornar(p)}>
            Estornar
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        titulo="Recebimentos"
        descricao="Todo pagamento que você lança, com a divisão entre juros e valor original."
        acoes={
          <Button icon={Plus} onClick={() => setEscolhendo(true)}>
            Novo recebimento
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        <Input label="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        <Select label="Devedor" value={devedorId} onChange={(e) => setDevedorId(e.target.value)}>
          <option value="">Todos</option>
          {(devedores ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </Select>
        <Select label="Forma de pagamento" value={formaId} onChange={(e) => setFormaId(e.target.value)}>
          <option value="">Todas</option>
          {(formas ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </Select>
      </div>

      {erro && (
        <p className="mb-4 text-sm text-red-600">
          {traduzirErroBanco(erro, { padrao: 'Não foi possível carregar os recebimentos.' })}
        </p>
      )}

      {carregando ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <>
          <Table
            colunas={colunas}
            linhas={pagamentos}
            vazio={
              <EmptyState
                icone={HandCoins}
                titulo="Nenhum recebimento no período"
                descricao="Lance um pagamento quando o devedor pagar."
                acao={<Button icon={Plus} onClick={() => setEscolhendo(true)}>Novo recebimento</Button>}
              />
            }
          />

          {pagamentos.length > 0 && (
            <Card className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
              <p className="text-sm text-slate-600">
                {pagamentos.length} recebimento(s) no período
              </p>
              <p className="text-sm text-slate-600">
                Juros: <span className="font-medium text-slate-800">{formatarMoeda(totais.juros)}</span> · Principal:{' '}
                <span className="font-medium text-slate-800">{formatarMoeda(totais.principal)}</span> · Total:{' '}
                <span className="font-semibold text-slate-900">{formatarMoeda(totais.total)}</span>
              </p>
            </Card>
          )}
        </>
      )}

      {escolhendo && (
        <ModalEscolherDivida
          onFechar={() => setEscolhendo(false)}
          onEscolher={(escolha) => {
            setEscolhendo(false)
            setNovoPagamento(escolha)
          }}
        />
      )}

      {novoPagamento && (
        <ModalPagamento
          divida={novoPagamento.divida}
          parcela={novoPagamento.parcela}
          onFechar={() => setNovoPagamento(null)}
          onSalvo={() => {
            setNovoPagamento(null)
            recarregar()
          }}
        />
      )}

      {emEdicao && (
        <ModalPagamento
          pagamento={emEdicao}
          onFechar={() => setEmEdicao(null)}
          onSalvo={() => {
            setEmEdicao(null)
            recarregar()
          }}
        />
      )}
    </>
  )
}
