import { History, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Input, Select } from '@/shared/components/Field'
import { Badge, EmptyState, PageHeader } from '@/shared/components/Page'
import { Table } from '@/shared/components/Table'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'
import { formatarDataHora, formatarMoeda, formatarQuantidade } from '@/shared/lib/format'

export function Vendas() {
  const navigate = useNavigate()
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [formaId, setFormaId] = useState('')
  const [status, setStatus] = useState('')
  const [busca, setBusca] = useState('')

  const { dados: formas } = useConsulta(() => supabase.from('formas_pagamento').select('id, nome').order('nome'))

  const { dados, carregando, erro } = useConsulta(() => {
    let q = supabase
      .from('vendas')
      .select('*, formas_pagamento(nome), venda_itens(quantidade, preco_unit, produtos(nome))')
      .order('data', { ascending: false })
      .limit(200)
    if (de) q = q.gte('data', new Date(`${de}T00:00:00`).toISOString())
    if (ate) q = q.lte('data', new Date(`${ate}T23:59:59`).toISOString())
    if (formaId) q = q.eq('forma_pagamento_id', formaId)
    if (status) q = q.eq('status', status)
    return q
  }, [de, ate, formaId, status])

  const termo = busca.trim().toLowerCase()
  const vendas = (dados ?? []).filter((v) => !termo || (v.cliente_nome ?? '').toLowerCase().includes(termo))

  const ativas = vendas.filter((v) => v.status === 'ativa')
  const totalPeriodo = ativas.reduce((s, v) => s + Number(v.total), 0)
  const itensPeriodo = ativas.reduce(
    (s, v) => s + (v.venda_itens ?? []).reduce((soma, i) => soma + Number(i.quantidade), 0),
    0,
  )

  const colunas = [
    {
      chave: 'data',
      titulo: 'Data',
      render: (v) => (
        <Link to={`/estoque/vendas/${v.id}`} className="font-medium text-brand-700 hover:underline">
          {formatarDataHora(v.data)}
        </Link>
      ),
    },
    { chave: 'cliente_nome', titulo: 'Cliente', render: (v) => v.cliente_nome ?? '—' },
    {
      chave: 'itens',
      titulo: 'O que foi vendido',
      className: 'whitespace-normal',
      render: (v) => (
        <div className="max-w-xs">
          {(v.venda_itens ?? []).map((item, i) => (
            <p key={i} className="text-slate-700">
              {formatarQuantidade(item.quantidade)}x {item.produtos?.nome ?? 'Produto removido'}
              <span className="text-slate-400"> · {formatarMoeda(item.preco_unit)} cada</span>
            </p>
          ))}
        </div>
      ),
    },
    {
      chave: 'quantidade',
      titulo: 'Qtd.',
      render: (v) => formatarQuantidade((v.venda_itens ?? []).reduce((s, i) => s + Number(i.quantidade), 0)),
    },
    { chave: 'forma', titulo: 'Pagamento', render: (v) => v.formas_pagamento?.nome ?? '—' },
    { chave: 'total', titulo: 'Total', render: (v) => <span className="font-medium">{formatarMoeda(v.total)}</span> },
    {
      chave: 'status',
      titulo: 'Situação',
      render: (v) => (
        <Badge cor={v.status === 'ativa' ? 'verde' : 'cinza'}>{v.status === 'ativa' ? 'Ativa' : 'Cancelada'}</Badge>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        titulo="Histórico de vendas"
        descricao="Clique numa venda para ver os itens, editar ou cancelar."
        acoes={
          <Button icon={Plus} onClick={() => navigate('/estoque/nova-venda')}>
            Nova venda
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input label="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        <Input label="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        <Select label="Pagamento" value={formaId} onChange={(e) => setFormaId(e.target.value)}>
          <option value="">Todas</option>
          {(formas ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </Select>
        <Select label="Situação" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todas</option>
          <option value="ativa">Ativas</option>
          <option value="cancelada">Canceladas</option>
        </Select>
        <Input label="Cliente" placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {erro && (
        <p className="mb-4 text-sm text-red-600">
          {traduzirErroBanco(erro, { padrao: 'Não foi possível carregar as vendas.' })}
        </p>
      )}

      {carregando ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <>
          <Table
            colunas={colunas}
            linhas={vendas}
            vazio={
              <EmptyState
                icone={History}
                titulo="Nenhuma venda no período"
                descricao="Registre uma venda para ela aparecer aqui."
                acao={<Button icon={Plus} onClick={() => navigate('/estoque/nova-venda')}>Nova venda</Button>}
              />
            }
          />
          {vendas.length > 0 && (
            <p className="mt-3 text-sm text-slate-600">
              {vendas.length} venda(s) · {formatarQuantidade(itensPeriodo)} item(ns) vendido(s) · total ativo no
              período: <span className="font-semibold text-slate-900">{formatarMoeda(totalPeriodo)}</span>
            </p>
          )}
        </>
      )}
    </>
  )
}
