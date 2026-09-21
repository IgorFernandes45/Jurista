import { CreditCard, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { useConfirm } from '@/shared/components/Confirm'
import { Input } from '@/shared/components/Field'
import { Modal } from '@/shared/components/Modal'
import { Badge, EmptyState, PageHeader } from '@/shared/components/Page'
import { Table } from '@/shared/components/Table'
import { useToast } from '@/shared/components/Toast'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'

export function FormasPagamento() {
  const toast = useToast()
  const confirmar = useConfirm()
  const [emEdicao, setEmEdicao] = useState(null) // { id?, nome }

  const { dados, carregando, erro, recarregar } = useConsulta(() =>
    supabase.from('formas_pagamento').select('*').order('nome'),
  )

  async function alternarAtivo(forma) {
    const ativar = !forma.ativo
    if (
      !ativar &&
      !(await confirmar({
        titulo: 'Desativar forma de pagamento',
        mensagem: `"${forma.nome}" deixa de aparecer nas novas vendas e recebimentos. Os registros antigos continuam como estão.`,
        textoConfirmar: 'Desativar',
      }))
    )
      return

    const { error } = await supabase.from('formas_pagamento').update({ ativo: ativar }).eq('id', forma.id)
    if (error) return toast.erro(traduzirErroBanco(error))
    toast.sucesso(ativar ? 'Forma de pagamento ativada.' : 'Forma de pagamento desativada.')
    recarregar()
  }

  const colunas = [
    { chave: 'nome', titulo: 'Nome', render: (f) => <span className="font-medium text-slate-800">{f.nome}</span> },
    {
      chave: 'ativo',
      titulo: 'Situação',
      render: (f) => <Badge cor={f.ativo ? 'verde' : 'cinza'}>{f.ativo ? 'Ativa' : 'Inativa'}</Badge>,
    },
    {
      chave: 'acoes',
      titulo: '',
      className: 'text-right',
      render: (f) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEmEdicao(f)}>
            Renomear
          </Button>
          <Button size="sm" variant={f.ativo ? 'ghost' : 'secondary'} onClick={() => alternarAtivo(f)}>
            {f.ativo ? 'Desativar' : 'Ativar'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        titulo="Formas de pagamento"
        descricao="Usadas nas vendas e nos recebimentos."
        acoes={
          <Button icon={Plus} onClick={() => setEmEdicao({ nome: '' })}>
            Nova forma
          </Button>
        }
      />

      {erro && <p className="mb-4 text-sm text-red-600">{traduzirErroBanco(erro, { padrao: 'Não foi possível carregar a lista.' })}</p>}
      {carregando ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <Table
          colunas={colunas}
          linhas={dados ?? []}
          vazio={
            <EmptyState
              icone={CreditCard}
              titulo="Nenhuma forma de pagamento"
              descricao="Cadastre as formas que você usa, como Dinheiro, Pix ou Cartão."
              acao={<Button icon={Plus} onClick={() => setEmEdicao({ nome: '' })}>Nova forma</Button>}
            />
          }
        />
      )}

      <ModalForma
        forma={emEdicao}
        onFechar={() => setEmEdicao(null)}
        onSalvo={() => {
          setEmEdicao(null)
          recarregar()
        }}
      />
    </>
  )
}

function ModalForma({ forma, onFechar, onSalvo }) {
  const toast = useToast()
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Recarrega o campo sempre que o modal abre com outro registro
  const [ultimo, setUltimo] = useState(null)
  if (forma !== ultimo) {
    setUltimo(forma)
    setNome(forma?.nome ?? '')
    setErro('')
  }

  if (!forma) return null
  const editando = Boolean(forma.id)

  async function salvar(e) {
    e.preventDefault()
    const valor = nome.trim()
    if (!valor) return setErro('Informe o nome.')

    setSalvando(true)
    const { error } = editando
      ? await supabase.from('formas_pagamento').update({ nome: valor }).eq('id', forma.id)
      : await supabase.from('formas_pagamento').insert({ nome: valor })
    setSalvando(false)

    if (error) return setErro(traduzirErroBanco(error, { duplicado: 'Você já tem uma forma de pagamento com esse nome.' }))
    toast.sucesso(editando ? 'Forma de pagamento renomeada.' : 'Forma de pagamento criada.')
    onSalvo()
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={editando ? 'Renomear forma de pagamento' : 'Nova forma de pagamento'}
      largura="max-w-md"
      rodape={
        <>
          <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
          <Button form="form-forma-pagamento" type="submit" loading={salvando}>Salvar</Button>
        </>
      }
    >
      <form id="form-forma-pagamento" onSubmit={salvar}>
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} erro={erro} autoFocus />
      </form>
    </Modal>
  )
}
