import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Input, Select, Textarea } from '@/shared/components/Field'
import { Modal } from '@/shared/components/Modal'
import { useToast } from '@/shared/components/Toast'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'
import { formatarQuantidade } from '@/shared/lib/format'

// Lança entrada, saída ou ajuste de estoque.
// O estoque do produto é recalculado pelo banco a partir dos movimentos.
export function ModalMovimento({ produto, onFechar, onSalvo }) {
  const toast = useToast()
  const [tipo, setTipo] = useState('entrada')
  const [quantidade, setQuantidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [ultimo, setUltimo] = useState(null)

  if (produto !== ultimo) {
    setUltimo(produto)
    setTipo('entrada')
    setQuantidade('')
    setObservacao('')
    setErro('')
  }

  if (!produto) return null

  const atual = Number(produto.estoque_atual)
  const valor = quantidade === '' || Number.isNaN(Number(quantidade)) ? null : Number(quantidade)
  const novoEstoque =
    valor === null ? atual : tipo === 'entrada' ? atual + valor : tipo === 'saida' ? atual - valor : valor

  async function salvar(e) {
    e.preventDefault()
    setErro('')

    if (valor === null) return setErro('Informe a quantidade.')
    if (tipo !== 'ajuste' && valor <= 0) return setErro('A quantidade precisa ser maior que zero.')
    if (tipo === 'ajuste' && valor < 0) return setErro('Informe um valor igual ou maior que zero.')
    if (tipo === 'ajuste' && valor === atual) return setErro('O estoque contado é igual ao atual.')

    // A quantidade é gravada com sinal: positiva soma ao estoque, negativa subtrai
    const assinada = tipo === 'entrada' ? valor : tipo === 'saida' ? -valor : valor - atual

    setSalvando(true)
    const { error } = await supabase.from('movimentos_estoque').insert({
      produto_id: produto.id,
      tipo,
      quantidade: assinada,
      observacao: observacao.trim() || null,
    })
    setSalvando(false)

    if (error) return setErro(traduzirErroBanco(error))
    toast.sucesso('Estoque atualizado.')
    onSalvo()
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`Estoque — ${produto.nome}`}
      largura="max-w-md"
      rodape={
        <>
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button form="form-movimento" type="submit" loading={salvando}>
            Lançar
          </Button>
        </>
      }
    >
      <form id="form-movimento" onSubmit={salvar} className="flex flex-col gap-4">
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="entrada">Entrada (compra, devolução)</option>
          <option value="saida">Saída (perda, uso próprio)</option>
          <option value="ajuste">Ajuste por contagem</option>
        </Select>

        <Input
          label={tipo === 'ajuste' ? 'Estoque contado' : 'Quantidade'}
          type="number"
          step="0.001"
          min="0"
          autoFocus
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          ajuda={tipo === 'ajuste' ? 'Informe quanto realmente tem em estoque.' : undefined}
        />

        <Textarea
          label="Observação (opcional)"
          rows={2}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />

        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-500">Estoque atual: </span>
          <span className="font-medium text-slate-800">{formatarQuantidade(atual)}</span>
          <span className="text-slate-500"> → novo: </span>
          <span className={novoEstoque < 0 ? 'font-medium text-red-600' : 'font-medium text-slate-800'}>
            {formatarQuantidade(novoEstoque)}
          </span>
        </div>
      </form>
    </Modal>
  )
}
