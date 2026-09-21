import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Input, Select, Textarea } from '@/shared/components/Field'
import { Modal } from '@/shared/components/Modal'
import { useToast } from '@/shared/components/Toast'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { formatarData, formatarMoeda } from '@/shared/lib/format'

const hojeISO = () => new Date().toISOString().slice(0, 10)
const num = (v) => (v === '' || v === null || Number.isNaN(Number(v)) ? 0 : Number(v))
const arred = (v) => Math.round(v * 100) / 100

// Lança um recebimento. Quem lança decide quanto vai para juros e quanto para o
// principal; a sugestão inicial cobre primeiro os juros.
export function ModalPagamento({ divida, parcela, pagamento, onFechar, onSalvo }) {
  const toast = useToast()
  const editando = Boolean(pagamento)

  const [form, setForm] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [ultimo, setUltimo] = useState(undefined)

  const { dados: formas } = useConsulta(() =>
    supabase.from('formas_pagamento').select('id, nome').eq('ativo', true).order('nome'),
  )

  const chave = pagamento?.id ?? parcela?.id ?? divida?.id ?? null

  if (chave !== ultimo) {
    setUltimo(chave)
    setErro('')
    if (pagamento) {
      setForm({
        data: pagamento.data,
        forma_pagamento_id: pagamento.forma_pagamento_id ?? '',
        juros: String(pagamento.valor_juros),
        principal: String(pagamento.valor_principal),
        observacao: pagamento.observacao ?? '',
      })
    } else if (parcela || divida) {
      const jurosAberto = Number(parcela?.juros_em_aberto ?? divida?.juros_em_aberto ?? 0)
      const principal = Number(parcela?.principal_restante ?? divida?.principal_restante ?? 0)
      setForm({
        data: hojeISO(),
        forma_pagamento_id: '',
        juros: jurosAberto > 0 ? String(arred(jurosAberto)) : '0',
        principal: String(arred(principal)),
        observacao: '',
      })
    }
  }

  if ((!divida && !pagamento) || !form) return null

  const jurosAberto = Number(parcela?.juros_em_aberto ?? divida?.juros_em_aberto ?? 0)
  const principalAberto = Number(parcela?.principal_restante ?? divida?.principal_restante ?? 0)
  const totalAberto = arred(jurosAberto + principalAberto)
  const total = arred(num(form.juros) + num(form.principal))

  // Distribui um valor recebido: primeiro cobre os juros, o resto abate o principal
  function distribuir(valorTexto) {
    const valor = num(valorTexto)
    const juros = Math.min(valor, jurosAberto)
    setForm((f) => ({ ...f, juros: String(arred(juros)), principal: String(arred(valor - juros)) }))
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (total <= 0) return setErro('Informe um valor maior que zero.')

    setSalvando(true)
    const { error } = editando
      ? await supabase.rpc('editar_pagamento', {
          p_pagamento_id: pagamento.id,
          p_valor_principal: num(form.principal),
          p_valor_juros: num(form.juros),
          p_data: form.data,
          p_forma_pagamento_id: form.forma_pagamento_id || null,
          p_observacao: form.observacao,
        })
      : await supabase.rpc('registrar_pagamento', {
          p_divida_id: divida.id,
          p_valor_principal: num(form.principal),
          p_valor_juros: num(form.juros),
          p_parcela_id: parcela?.id ?? null,
          p_data: form.data,
          p_forma_pagamento_id: form.forma_pagamento_id || null,
          p_observacao: form.observacao,
        })
    setSalvando(false)

    if (error) return setErro(error.message ?? 'Não foi possível salvar o recebimento.')
    toast.sucesso(editando ? 'Recebimento atualizado.' : 'Recebimento registrado.')
    onSalvo()
  }

  const titulo = editando
    ? 'Editar recebimento'
    : parcela
      ? `Receber parcela ${parcela.numero}`
      : 'Registrar recebimento'

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={titulo}
      rodape={
        <>
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button form="form-pagamento" type="submit" loading={salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="form-pagamento" onSubmit={salvar} className="flex flex-col gap-4">
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        {!editando && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <p className="text-slate-500">
              {parcela ? `Parcela ${parcela.numero} · vence ${formatarData(parcela.vencimento)}` : 'Dívida inteira'}
            </p>
            <p className="mt-1 text-slate-700">
              Em aberto: <span className="font-medium">{formatarMoeda(principalAberto)}</span> de principal
              {jurosAberto > 0 && (
                <>
                  {' '}
                  + <span className="font-medium">{formatarMoeda(jurosAberto)}</span> de juros
                </>
              )}{' '}
              = <span className="font-semibold text-slate-900">{formatarMoeda(totalAberto)}</span>
            </p>
          </div>
        )}

        {!editando && (
          <Input
            label="Valor recebido"
            type="number"
            step="0.01"
            min="0"
            autoFocus
            defaultValue={String(totalAberto)}
            onChange={(e) => distribuir(e.target.value)}
            ajuda="Divide sozinho: cobre os juros primeiro e o resto abate o valor original. Você pode ajustar abaixo."
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Vai para juros"
            type="number"
            step="0.01"
            min="0"
            value={form.juros}
            onChange={(e) => setForm((f) => ({ ...f, juros: e.target.value }))}
          />
          <Input
            label="Abate do valor original"
            type="number"
            step="0.01"
            min="0"
            value={form.principal}
            onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value }))}
          />
        </div>

        <p className="text-sm text-slate-600">
          Total do recebimento: <span className="font-semibold text-slate-900">{formatarMoeda(total)}</span>
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Data"
            type="date"
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
        </div>

        <Textarea
          label="Observação (opcional)"
          rows={2}
          value={form.observacao}
          onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
        />
      </form>
    </Modal>
  )
}
