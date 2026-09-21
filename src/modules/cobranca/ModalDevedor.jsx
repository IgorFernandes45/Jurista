import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Input, Textarea } from '@/shared/components/Field'
import { Modal } from '@/shared/components/Modal'
import { useToast } from '@/shared/components/Toast'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'
import { formatarTelefone } from '@/shared/lib/format'

const VAZIO = { nome: '', telefone: '', observacao: '', instrucoes_pagamento: '' }

export function ModalDevedor({ devedor, onFechar, onSalvo }) {
  const toast = useToast()
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState('')
  const [erroNome, setErroNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [ultimo, setUltimo] = useState(null)

  if (devedor !== ultimo) {
    setUltimo(devedor)
    setForm(
      devedor?.id
        ? {
            nome: devedor.nome ?? '',
            telefone: devedor.telefone ?? '',
            observacao: devedor.observacao ?? '',
            instrucoes_pagamento: devedor.instrucoes_pagamento ?? '',
          }
        : VAZIO,
    )
    setErro('')
    setErroNome('')
  }

  if (!devedor) return null
  const editando = Boolean(devedor.id)

  const campo = (nome) => ({
    value: form[nome],
    onChange: (e) => setForm((f) => ({ ...f, [nome]: e.target.value })),
  })

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    setErroNome('')
    if (!form.nome.trim()) return setErroNome('Informe o nome.')

    const dados = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      observacao: form.observacao.trim() || null,
      instrucoes_pagamento: form.instrucoes_pagamento.trim() || null,
    }

    setSalvando(true)
    const { error } = editando
      ? await supabase.from('devedores').update(dados).eq('id', devedor.id)
      : await supabase.from('devedores').insert(dados)
    setSalvando(false)

    if (error) return setErro(traduzirErroBanco(error))
    toast.sucesso(editando ? 'Devedor salvo.' : 'Devedor cadastrado.')
    onSalvo()
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={editando ? 'Editar devedor' : 'Novo devedor'}
      rodape={
        <>
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button form="form-devedor" type="submit" loading={salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="form-devedor" onSubmit={salvar} className="flex flex-col gap-4">
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <Input label="Nome" autoFocus erro={erroNome} {...campo('nome')} />
        <Input
          label="Telefone (opcional)"
          inputMode="tel"
          placeholder="(00) 00000-0000"
          value={formatarTelefone(form.telefone)}
          onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value.replace(/\D/g, '') }))}
        />
        <Textarea
          label="Observação interna (opcional)"
          rows={2}
          ajuda="Só você vê. Nunca aparece para o devedor."
          {...campo('observacao')}
        />
        <Textarea
          label="Instruções de pagamento (opcional)"
          rows={2}
          ajuda="Aparece na página que o devedor abre pelo link. Ex.: chave Pix."
          {...campo('instrucoes_pagamento')}
        />
      </form>
    </Modal>
  )
}
