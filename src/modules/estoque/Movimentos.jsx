import { Boxes, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { useConfirm } from '@/shared/components/Confirm'
import { Input, Select, Textarea } from '@/shared/components/Field'
import { Modal } from '@/shared/components/Modal'
import { Badge, EmptyState, PageHeader } from '@/shared/components/Page'
import { Table } from '@/shared/components/Table'
import { useToast } from '@/shared/components/Toast'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'
import { formatarDataHora, formatarQuantidade } from '@/shared/lib/format'

const ROTULO_TIPO = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' }
const COR_TIPO = { entrada: 'verde', saida: 'amarelo', ajuste: 'azul' }
const ROTULO_ORIGEM = {
  manual: 'Manual',
  venda: 'Venda',
  edicao_venda: 'Edição de venda',
  cancelamento_venda: 'Cancelamento de venda',
}

export function Movimentos() {
  const toast = useToast()
  const confirmar = useConfirm()
  const [produtoId, setProdutoId] = useState('')
  const [tipo, setTipo] = useState('')
  const [emEdicao, setEmEdicao] = useState(null)

  const { dados: produtos } = useConsulta(() => supabase.from('produtos').select('id, nome').order('nome'))

  const { dados, carregando, erro, recarregar } = useConsulta(() => {
    let q = supabase
      .from('movimentos_estoque')
      .select('*, produtos(nome)')
      .order('data', { ascending: false })
      .limit(200)
    if (produtoId) q = q.eq('produto_id', produtoId)
    if (tipo) q = q.eq('tipo', tipo)
    return q
  }, [produtoId, tipo])

  async function excluir(movimento) {
    const ok = await confirmar({
      titulo: 'Excluir movimento',
      mensagem: 'O estoque do produto será recalculado sem este movimento. Esta ação não pode ser desfeita.',
      textoConfirmar: 'Excluir',
      perigo: true,
    })
    if (!ok) return

    const { error } = await supabase.from('movimentos_estoque').delete().eq('id', movimento.id)
    if (error) return toast.erro(traduzirErroBanco(error))
    toast.sucesso('Movimento excluído e estoque recalculado.')
    recarregar()
  }

  const colunas = [
    { chave: 'data', titulo: 'Data', render: (m) => formatarDataHora(m.data) },
    { chave: 'produto', titulo: 'Produto', render: (m) => m.produtos?.nome ?? '—' },
    { chave: 'tipo', titulo: 'Tipo', render: (m) => <Badge cor={COR_TIPO[m.tipo]}>{ROTULO_TIPO[m.tipo]}</Badge> },
    {
      chave: 'quantidade',
      titulo: 'Quantidade',
      render: (m) => (
        <span className={Number(m.quantidade) < 0 ? 'font-medium text-red-600' : 'font-medium text-green-700'}>
          {Number(m.quantidade) > 0 ? '+' : ''}
          {formatarQuantidade(m.quantidade)}
        </span>
      ),
    },
    { chave: 'origem', titulo: 'Origem', render: (m) => ROTULO_ORIGEM[m.origem] ?? m.origem },
    { chave: 'observacao', titulo: 'Observação', render: (m) => m.observacao ?? '—' },
    {
      chave: 'acoes',
      titulo: '',
      className: 'text-right',
      // Movimentos gerados por vendas só mudam pela própria venda
      render: (m) =>
        m.origem === 'manual' ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEmEdicao(m)}>
              Editar
            </Button>
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => excluir(m)}>
              Excluir
            </Button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">alterado pela venda</span>
        ),
    },
  ]

  return (
    <>
      <PageHeader titulo="Estoque" descricao="Histórico de entradas, saídas e ajustes." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className="sm:w-64">
          <option value="">Todos os produtos</option>
          {(produtos ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value)} className="sm:w-48">
          <option value="">Todos os tipos</option>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
          <option value="ajuste">Ajuste</option>
        </Select>
      </div>

      {erro && (
        <p className="mb-4 text-sm text-red-600">
          {traduzirErroBanco(erro, { padrao: 'Não foi possível carregar os movimentos.' })}
        </p>
      )}
      {carregando ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <Table
          colunas={colunas}
          linhas={dados ?? []}
          vazio={
            <EmptyState
              icone={Boxes}
              titulo="Nenhum movimento"
              descricao="Entradas, saídas e ajustes de estoque aparecem aqui."
            />
          }
        />
      )}

      <ModalEditarMovimento
        movimento={emEdicao}
        onFechar={() => setEmEdicao(null)}
        onSalvo={() => {
          setEmEdicao(null)
          recarregar()
        }}
      />
    </>
  )
}

function ModalEditarMovimento({ movimento, onFechar, onSalvo }) {
  const toast = useToast()
  const [quantidade, setQuantidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [ultimo, setUltimo] = useState(null)

  if (movimento !== ultimo) {
    setUltimo(movimento)
    setQuantidade(movimento ? String(Math.abs(Number(movimento.quantidade))) : '')
    setObservacao(movimento?.observacao ?? '')
    setErro('')
  }

  if (!movimento) return null

  const negativo = Number(movimento.quantidade) < 0

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const valor = Number(quantidade)
    if (!quantidade || Number.isNaN(valor) || valor <= 0) return setErro('Informe uma quantidade maior que zero.')

    setSalvando(true)
    const { error } = await supabase
      .from('movimentos_estoque')
      .update({ quantidade: negativo ? -valor : valor, observacao: observacao.trim() || null })
      .eq('id', movimento.id)
    setSalvando(false)

    if (error) return setErro(traduzirErroBanco(error))
    toast.sucesso('Movimento alterado e estoque recalculado.')
    onSalvo()
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Editar movimento"
      largura="max-w-md"
      rodape={
        <>
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button form="form-editar-movimento" type="submit" loading={salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="form-editar-movimento" onSubmit={salvar} className="flex flex-col gap-4">
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <p className="text-sm text-slate-600">
          {movimento.produtos?.nome} — {ROTULO_TIPO[movimento.tipo]} de {formatarDataHora(movimento.data)}
        </p>
        <Input
          label="Quantidade"
          type="number"
          step="0.001"
          min="0"
          autoFocus
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          ajuda={negativo ? 'Quantidade que sai do estoque.' : 'Quantidade que entra no estoque.'}
        />
        <Textarea
          label="Observação (opcional)"
          rows={2}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
      </form>
    </Modal>
  )
}
