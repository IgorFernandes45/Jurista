import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Field'
import { Modal } from '@/shared/components/Modal'
import { useToast } from '@/shared/components/Toast'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'
import { formatarQuantidade } from '@/shared/lib/format'

const VAZIO = { nome: '', sku: '', preco_venda: '', preco_custo: '', estoque_minimo: '', estoque_inicial: '' }

function paraForm(produto) {
  if (!produto?.id) return VAZIO
  return {
    nome: produto.nome ?? '',
    sku: produto.sku ?? '',
    preco_venda: produto.preco_venda ?? '',
    preco_custo: produto.preco_custo ?? '',
    estoque_minimo: produto.estoque_minimo ?? '',
    estoque_inicial: '',
  }
}

export function ModalProduto({ produto, onFechar, onSalvo }) {
  const toast = useToast()
  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [ultimo, setUltimo] = useState(null)

  // Recarrega o formulário quando o modal abre com outro produto
  if (produto !== ultimo) {
    setUltimo(produto)
    setForm(paraForm(produto))
    setErros({})
    setErroGeral('')
  }

  if (!produto) return null
  const editando = Boolean(produto.id)

  const campo = (nome) => ({
    value: form[nome],
    onChange: (e) => setForm((f) => ({ ...f, [nome]: e.target.value })),
    erro: erros[nome],
  })

  const num = (v) => (v === '' || v === null ? 0 : Number(v))

  async function salvar(e) {
    e.preventDefault()
    setErroGeral('')

    const novosErros = {}
    if (!form.nome.trim()) novosErros.nome = 'Informe o nome.'
    for (const c of ['preco_venda', 'preco_custo', 'estoque_minimo', 'estoque_inicial']) {
      if (form[c] !== '' && (Number.isNaN(Number(form[c])) || Number(form[c]) < 0)) {
        novosErros[c] = 'Informe um número válido.'
      }
    }
    setErros(novosErros)
    if (Object.keys(novosErros).length) return

    const dados = {
      nome: form.nome.trim(),
      sku: form.sku.trim() || null,
      preco_venda: num(form.preco_venda),
      preco_custo: num(form.preco_custo),
      estoque_minimo: num(form.estoque_minimo),
    }

    setSalvando(true)
    const { data, error } = editando
      ? await supabase.from('produtos').update(dados).eq('id', produto.id).select('id').single()
      : await supabase.from('produtos').insert(dados).select('id').single()

    // O estoque inicial entra como movimento, para ficar registrado no histórico
    const inicial = num(form.estoque_inicial)
    if (!error && !editando && inicial > 0) {
      const { error: erroMovimento } = await supabase.from('movimentos_estoque').insert({
        produto_id: data.id,
        tipo: 'entrada',
        quantidade: inicial,
        observacao: 'Estoque inicial',
      })
      if (erroMovimento) {
        setSalvando(false)
        toast.erro('Produto cadastrado, mas o estoque inicial não foi lançado.')
        return onSalvo()
      }
    }
    setSalvando(false)

    if (error) {
      return setErroGeral(traduzirErroBanco(error, { duplicado: 'Já existe um produto com esse código (SKU).' }))
    }
    toast.sucesso(editando ? 'Produto salvo.' : 'Produto cadastrado.')
    onSalvo()
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={editando ? 'Editar produto' : 'Novo produto'}
      rodape={
        <>
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button form="form-produto" type="submit" loading={salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="form-produto" onSubmit={salvar} className="flex flex-col gap-4">
        {erroGeral && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erroGeral}</p>}

        <Input label="Nome" autoFocus {...campo('nome')} />
        <Input label="Código / SKU (opcional)" {...campo('sku')} />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Preço de venda" type="number" step="0.01" min="0" {...campo('preco_venda')} />
          <Input label="Preço de custo" type="number" step="0.01" min="0" {...campo('preco_custo')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Estoque mínimo"
            type="number"
            step="0.001"
            min="0"
            ajuda="Alerta quando o estoque chegar nesse valor."
            {...campo('estoque_minimo')}
          />
          {editando ? (
            <div className="flex flex-col justify-center rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Estoque atual</p>
              <p className="text-sm font-medium text-slate-800">{formatarQuantidade(produto.estoque_atual)}</p>
              <p className="mt-1 text-xs text-slate-500">Para alterar, use o botão Estoque.</p>
            </div>
          ) : (
            <Input
              label="Estoque inicial"
              type="number"
              step="0.001"
              min="0"
              ajuda="Lançado como entrada no histórico."
              {...campo('estoque_inicial')}
            />
          )}
        </div>
      </form>
    </Modal>
  )
}
