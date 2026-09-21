import { AlertTriangle, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Input, Select, Textarea } from '@/shared/components/Field'
import { Card, EmptyState, PageHeader } from '@/shared/components/Page'
import { useToast } from '@/shared/components/Toast'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'
import { formatarMoeda, formatarQuantidade, formatarTelefone } from '@/shared/lib/format'

// Data/hora para o formato do input datetime-local, no horário local
function paraInputDataHora(valor) {
  const d = valor ? new Date(valor) : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const num = (v) => (v === '' || v === null || Number.isNaN(Number(v)) ? 0 : Number(v))

export function NovaVenda() {
  const { id } = useParams() // quando existe, é edição
  const editando = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()

  const [itens, setItens] = useState([])
  const [form, setForm] = useState({
    data: paraInputDataHora(),
    cliente_nome: '',
    cliente_telefone: '',
    forma_pagamento_id: '',
    desconto: '',
    observacao: '',
  })
  const [produtoSelecionado, setProdutoSelecionado] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const { dados: produtos, carregando: carregandoProdutos } = useConsulta(() =>
    supabase.from('produtos').select('id, nome, sku, preco_venda, estoque_atual').eq('ativo', true).order('nome'),
  )
  const { dados: formas } = useConsulta(() =>
    supabase.from('formas_pagamento').select('id, nome').eq('ativo', true).order('nome'),
  )

  // Em edição, carrega a venda existente uma única vez
  const { carregando: carregandoVenda, erro: erroVenda } = useConsulta(async () => {
    if (!editando) return { data: null, error: null }
    const resposta = await supabase
      .from('vendas')
      .select('*, venda_itens(produto_id, quantidade, preco_unit, produtos(nome))')
      .eq('id', id)
      .maybeSingle()

    const venda = resposta.data
    if (venda) {
      setForm({
        data: paraInputDataHora(venda.data),
        cliente_nome: venda.cliente_nome ?? '',
        cliente_telefone: venda.cliente_telefone ?? '',
        forma_pagamento_id: venda.forma_pagamento_id ?? '',
        desconto: venda.desconto > 0 ? String(venda.desconto) : '',
        observacao: venda.observacao ?? '',
      })
      setItens(
        venda.venda_itens.map((i) => ({
          produto_id: i.produto_id,
          nome: i.produtos?.nome ?? '',
          quantidade: String(i.quantidade),
          preco_unit: String(i.preco_unit),
          quantidadeOriginal: Number(i.quantidade),
        })),
      )
    }
    return resposta
  }, [id])

  const subtotal = itens.reduce((s, i) => s + num(i.quantidade) * num(i.preco_unit), 0)
  const desconto = num(form.desconto)
  const total = Math.max(subtotal - desconto, 0)

  // Avisa (sem bloquear) quando a venda deixa algum produto negativo
  const avisosEstoque = useMemo(() => {
    const porProduto = new Map()
    for (const item of itens) {
      const atual = porProduto.get(item.produto_id) ?? { quantidade: 0, devolvida: 0 }
      atual.quantidade += num(item.quantidade)
      atual.devolvida += item.quantidadeOriginal ?? 0
      porProduto.set(item.produto_id, atual)
    }
    return [...porProduto.entries()]
      .map(([produtoId, { quantidade, devolvida }]) => {
        const produto = (produtos ?? []).find((p) => p.id === produtoId)
        if (!produto) return null
        // Ao editar, as quantidades já lançadas voltam ao estoque antes de sair de novo
        const disponivel = Number(produto.estoque_atual) + devolvida
        return quantidade > disponivel
          ? { nome: produto.nome, disponivel, faltando: quantidade - disponivel }
          : null
      })
      .filter(Boolean)
  }, [itens, produtos])

  function adicionarProduto() {
    const produto = (produtos ?? []).find((p) => p.id === produtoSelecionado)
    if (!produto) return
    setItens((lista) => [
      ...lista,
      {
        produto_id: produto.id,
        nome: produto.nome,
        quantidade: '1',
        preco_unit: String(produto.preco_venda),
        quantidadeOriginal: 0,
      },
    ])
    setProdutoSelecionado('')
  }

  function alterarItem(indice, campo, valor) {
    setItens((lista) => lista.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item)))
  }

  async function salvar() {
    setErro('')
    if (!itens.length) return setErro('Inclua pelo menos um produto.')
    if (itens.some((i) => num(i.quantidade) <= 0)) return setErro('Todas as quantidades precisam ser maiores que zero.')
    if (desconto > subtotal) return setErro('O desconto não pode ser maior que o total dos produtos.')

    const parametros = {
      p_itens: itens.map((i) => ({
        produto_id: i.produto_id,
        quantidade: num(i.quantidade),
        preco_unit: num(i.preco_unit),
      })),
      p_data: new Date(form.data).toISOString(),
      p_cliente_nome: form.cliente_nome,
      p_cliente_telefone: form.cliente_telefone,
      p_forma_pagamento_id: form.forma_pagamento_id || null,
      p_desconto: desconto,
      p_observacao: form.observacao,
    }

    setSalvando(true)
    const { data, error } = editando
      ? await supabase.rpc('editar_venda', { p_venda_id: id, ...parametros })
      : await supabase.rpc('registrar_venda', parametros)
    setSalvando(false)

    if (error) return setErro(error.message ?? traduzirErroBanco(error))
    toast.sucesso(editando ? 'Venda atualizada.' : 'Venda registrada.')
    navigate(`/estoque/vendas/${data ?? id}`)
  }

  if (carregandoVenda || carregandoProdutos) return <p className="text-sm text-slate-500">Carregando…</p>
  if (erroVenda) return <p className="text-sm text-red-600">Não foi possível carregar a venda.</p>

  const semProdutos = !produtos?.length

  return (
    <>
      <PageHeader
        titulo={editando ? 'Editar venda' : 'Nova venda'}
        descricao={editando ? 'O estoque é acertado pela diferença.' : 'O estoque baixa automaticamente ao registrar.'}
      />

      {semProdutos ? (
        <EmptyState
          icone={ShoppingCart}
          titulo="Cadastre um produto primeiro"
          descricao="A venda precisa de pelo menos um produto ativo."
          acao={<Button onClick={() => navigate('/estoque/produtos')}>Ir para produtos</Button>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Select
                label="Produto"
                className="flex-1"
                value={produtoSelecionado}
                onChange={(e) => setProdutoSelecionado(e.target.value)}
              >
                <option value="">Selecione um produto…</option>
                {(produtos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} {p.sku ? `(${p.sku})` : ''} — {formatarMoeda(p.preco_venda)} · estoque{' '}
                    {formatarQuantidade(p.estoque_atual)}
                  </option>
                ))}
              </Select>
              <Button icon={Plus} onClick={adicionarProduto} disabled={!produtoSelecionado}>
                Adicionar
              </Button>
            </div>

            {itens.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-2 pr-3 font-medium">Produto</th>
                      <th className="py-2 pr-3 font-medium">Qtd.</th>
                      <th className="py-2 pr-3 font-medium">Preço</th>
                      <th className="py-2 pr-3 font-medium">Subtotal</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itens.map((item, indice) => (
                      <tr key={`${item.produto_id}-${indice}`}>
                        <td className="py-2 pr-3 text-slate-800">{item.nome}</td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={item.quantidade}
                            onChange={(e) => alterarItem(indice, 'quantidade', e.target.value)}
                            className="h-9 w-24 rounded-lg border border-slate-300 px-2 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.preco_unit}
                            onChange={(e) => alterarItem(indice, 'preco_unit', e.target.value)}
                            className="h-9 w-28 rounded-lg border border-slate-300 px-2 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-3 font-medium text-slate-800">
                          {formatarMoeda(num(item.quantidade) * num(item.preco_unit))}
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            onClick={() => setItens((lista) => lista.filter((_, i) => i !== indice))}
                            aria-label="Remover item"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {avisosEstoque.length > 0 && (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">A venda vai deixar estoque negativo:</p>
                <ul className="mt-1 list-inside list-disc">
                  {avisosEstoque.map((a) => (
                    <li key={a.nome}>
                      {a.nome}: disponível {formatarQuantidade(a.disponivel)}, faltam {formatarQuantidade(a.faltando)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1">Você pode continuar mesmo assim.</p>
              </div>
            </div>
          )}

          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Data e hora"
                type="datetime-local"
                value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              />
              <Select
                label="Forma de pagamento"
                value={form.forma_pagamento_id}
                onChange={(e) => setForm((f) => ({ ...f, forma_pagamento_id: e.target.value }))}
              >
                <option value="">Não informada</option>
                {(formas ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
              <Input
                label="Cliente (opcional)"
                value={form.cliente_nome}
                onChange={(e) => setForm((f) => ({ ...f, cliente_nome: e.target.value }))}
              />
              <Input
                label="Telefone do cliente (opcional)"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                value={formatarTelefone(form.cliente_telefone)}
                onChange={(e) => setForm((f) => ({ ...f, cliente_telefone: e.target.value.replace(/\D/g, '') }))}
              />
              <Input
                label="Desconto"
                type="number"
                step="0.01"
                min="0"
                value={form.desconto}
                onChange={(e) => setForm((f) => ({ ...f, desconto: e.target.value }))}
              />
              <Textarea
                label="Observação (opcional)"
                rows={2}
                value={form.observacao}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </div>
          </Card>

          <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="text-slate-500">
                Produtos: <span className="font-medium text-slate-700">{formatarMoeda(subtotal)}</span>
                {desconto > 0 && <> · desconto: <span className="font-medium text-slate-700">{formatarMoeda(desconto)}</span></>}
              </p>
              <p className="text-2xl font-semibold text-slate-900">{formatarMoeda(total)}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button onClick={salvar} loading={salvando} size="lg">
                {editando ? 'Salvar alterações' : 'Registrar venda'}
              </Button>
            </div>
          </Card>

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        </div>
      )}
    </>
  )
}
