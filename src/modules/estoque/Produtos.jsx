import { ArrowDownUp, Package, Pencil, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { useConfirm } from '@/shared/components/Confirm'
import { Select } from '@/shared/components/Field'
import { Badge, EmptyState, PageHeader } from '@/shared/components/Page'
import { Table } from '@/shared/components/Table'
import { useToast } from '@/shared/components/Toast'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { formatarMoeda, formatarQuantidade } from '@/shared/lib/format'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'
import { ModalMovimento } from './ModalMovimento'
import { ModalProduto } from './ModalProduto'

export function Produtos() {
  const toast = useToast()
  const confirmar = useConfirm()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('ativos')
  const [produtoEmEdicao, setProdutoEmEdicao] = useState(null)
  const [produtoMovimento, setProdutoMovimento] = useState(null)

  const { dados, carregando, erro, recarregar } = useConsulta(() => {
    let q = supabase.from('produtos').select('*').order('nome')
    if (filtro !== 'todos') q = q.eq('ativo', filtro === 'ativos')
    return q
  }, [filtro])

  const termo = busca.trim().toLowerCase()
  const produtos = (dados ?? []).filter(
    (p) => !termo || p.nome.toLowerCase().includes(termo) || (p.sku ?? '').toLowerCase().includes(termo),
  )

  async function alternarAtivo(produto) {
    const ativar = !produto.ativo
    if (
      !ativar &&
      !(await confirmar({
        titulo: 'Desativar produto',
        mensagem: `"${produto.nome}" deixa de aparecer nas novas vendas. O histórico continua como está.`,
        textoConfirmar: 'Desativar',
      }))
    )
      return

    const { error } = await supabase.from('produtos').update({ ativo: ativar }).eq('id', produto.id)
    if (error) return toast.erro(traduzirErroBanco(error))
    toast.sucesso(ativar ? 'Produto ativado.' : 'Produto desativado.')
    recarregar()
  }

  const colunas = [
    {
      chave: 'nome',
      titulo: 'Produto',
      render: (p) => (
        <div>
          <p className="font-medium text-slate-800">{p.nome}</p>
          {p.sku && <p className="text-xs text-slate-500">{p.sku}</p>}
        </div>
      ),
    },
    { chave: 'preco_venda', titulo: 'Venda', render: (p) => formatarMoeda(p.preco_venda) },
    { chave: 'preco_custo', titulo: 'Custo', render: (p) => formatarMoeda(p.preco_custo) },
    {
      chave: 'estoque_atual',
      titulo: 'Estoque',
      render: (p) => {
        const abaixo = Number(p.estoque_atual) <= Number(p.estoque_minimo)
        return (
          <div className="flex items-center gap-2">
            <span className={abaixo ? 'font-medium text-red-600' : 'text-slate-700'}>
              {formatarQuantidade(p.estoque_atual)}
            </span>
            {abaixo && <Badge cor="vermelho">mínimo {formatarQuantidade(p.estoque_minimo)}</Badge>}
          </div>
        )
      },
    },
    {
      chave: 'acoes',
      titulo: '',
      className: 'text-right',
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" icon={ArrowDownUp} onClick={() => setProdutoMovimento(p)}>
            Estoque
          </Button>
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setProdutoEmEdicao(p)}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => alternarAtivo(p)}>
            {p.ativo ? 'Desativar' : 'Ativar'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        titulo="Produtos"
        descricao="Cadastro, preços e estoque."
        acoes={
          <>
            <Link
              to="/estoque/movimentos"
              className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ver movimentos
            </Link>
            <Button icon={Plus} onClick={() => setProdutoEmEdicao({})}>
              Novo produto
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou código"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>
        <Select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="sm:w-48">
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </Select>
      </div>

      {erro && <p className="mb-4 text-sm text-red-600">{traduzirErroBanco(erro, { padrao: 'Não foi possível carregar os produtos.' })}</p>}
      {carregando ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <Table
          colunas={colunas}
          linhas={produtos}
          vazio={
            <EmptyState
              icone={Package}
              titulo={termo ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
              descricao={termo ? 'Tente outro termo de busca.' : 'Cadastre seu primeiro produto para começar a vender.'}
              acao={!termo && <Button icon={Plus} onClick={() => setProdutoEmEdicao({})}>Novo produto</Button>}
            />
          }
        />
      )}

      <ModalProduto
        produto={produtoEmEdicao}
        onFechar={() => setProdutoEmEdicao(null)}
        onSalvo={() => {
          setProdutoEmEdicao(null)
          recarregar()
        }}
      />
      <ModalMovimento
        produto={produtoMovimento}
        onFechar={() => setProdutoMovimento(null)}
        onSalvo={() => {
          setProdutoMovimento(null)
          recarregar()
        }}
      />
    </>
  )
}
