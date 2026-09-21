import { Pencil, Plus, Search, Users } from 'lucide-react'
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
import { traduzirErroBanco } from '@/shared/lib/erroBanco'
import { formatarTelefone } from '@/shared/lib/format'
import { ModalDevedor } from './ModalDevedor'

export function Devedores() {
  const toast = useToast()
  const confirmar = useConfirm()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('ativos')
  const [emEdicao, setEmEdicao] = useState(null)

  const { dados, carregando, erro, recarregar } = useConsulta(() => {
    let q = supabase.from('devedores').select('*').order('nome')
    if (filtro !== 'todos') q = q.eq('ativo', filtro === 'ativos')
    return q
  }, [filtro])

  const termo = busca.trim().toLowerCase()
  const devedores = (dados ?? []).filter(
    (d) => !termo || d.nome.toLowerCase().includes(termo) || (d.telefone ?? '').includes(termo),
  )

  async function alternarAtivo(devedor) {
    const ativar = !devedor.ativo
    if (
      !ativar &&
      !(await confirmar({
        titulo: 'Desativar devedor',
        mensagem: `"${devedor.nome}" sai das listas do dia a dia. As dívidas e o histórico continuam guardados.`,
        textoConfirmar: 'Desativar',
      }))
    )
      return

    const { error } = await supabase.from('devedores').update({ ativo: ativar }).eq('id', devedor.id)
    if (error) return toast.erro(traduzirErroBanco(error))
    toast.sucesso(ativar ? 'Devedor ativado.' : 'Devedor desativado.')
    recarregar()
  }

  const colunas = [
    {
      chave: 'nome',
      titulo: 'Devedor',
      render: (d) => (
        <Link to={`/cobranca/devedores/${d.id}`} className="font-medium text-brand-700 hover:underline">
          {d.nome}
        </Link>
      ),
    },
    { chave: 'telefone', titulo: 'Telefone', render: (d) => (d.telefone ? formatarTelefone(d.telefone) : '—') },
    {
      chave: 'ativo',
      titulo: 'Situação',
      render: (d) => <Badge cor={d.ativo ? 'verde' : 'cinza'}>{d.ativo ? 'Ativo' : 'Inativo'}</Badge>,
    },
    {
      chave: 'acoes',
      titulo: '',
      className: 'text-right',
      render: (d) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEmEdicao(d)}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => alternarAtivo(d)}>
            {d.ativo ? 'Desativar' : 'Ativar'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        titulo="Devedores"
        descricao="Quem deve, com telefone e instruções de pagamento."
        acoes={
          <Button icon={Plus} onClick={() => setEmEdicao({})}>
            Novo devedor
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>
        <Select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="sm:w-48">
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </Select>
      </div>

      {erro && (
        <p className="mb-4 text-sm text-red-600">
          {traduzirErroBanco(erro, { padrao: 'Não foi possível carregar os devedores.' })}
        </p>
      )}
      {carregando ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <Table
          colunas={colunas}
          linhas={devedores}
          vazio={
            <EmptyState
              icone={Users}
              titulo={termo ? 'Nenhum devedor encontrado' : 'Nenhum devedor cadastrado'}
              descricao={termo ? 'Tente outro termo de busca.' : 'Cadastre quem deve para depois lançar as dívidas.'}
              acao={!termo && <Button icon={Plus} onClick={() => setEmEdicao({})}>Novo devedor</Button>}
            />
          }
        />
      )}

      <ModalDevedor
        devedor={emEdicao}
        onFechar={() => setEmEdicao(null)}
        onSalvo={() => {
          setEmEdicao(null)
          recarregar()
        }}
      />
    </>
  )
}
