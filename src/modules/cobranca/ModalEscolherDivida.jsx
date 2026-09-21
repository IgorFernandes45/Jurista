import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Select } from '@/shared/components/Field'
import { Modal } from '@/shared/components/Modal'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { formatarData, formatarMoeda } from '@/shared/lib/format'
import { SITUACOES } from './juros'

// Escolhe devedor > dívida > parcela antes de abrir a tela de recebimento
export function ModalEscolherDivida({ onFechar, onEscolher }) {
  const [devedorId, setDevedorId] = useState('')
  const [dividaId, setDividaId] = useState('')
  const [parcelaId, setParcelaId] = useState('')

  const { dados: devedores } = useConsulta(() =>
    supabase.from('devedores').select('id, nome').eq('ativo', true).order('nome'),
  )

  const { dados: dividas } = useConsulta(() => {
    if (!devedorId) return Promise.resolve({ data: [], error: null })
    return supabase
      .from('dividas_resumo')
      .select('*')
      .eq('devedor_id', devedorId)
      .neq('status', 'cancelada')
      .neq('status', 'quitada')
      .order('proximo_vencimento', { nullsFirst: false })
  }, [devedorId])

  const { dados: parcelas } = useConsulta(() => {
    if (!dividaId) return Promise.resolve({ data: [], error: null })
    return supabase.from('parcelas_resumo').select('*').eq('divida_id', dividaId).eq('pago', false).order('numero')
  }, [dividaId])

  const divida = (dividas ?? []).find((d) => d.id === dividaId)
  const parcela = (parcelas ?? []).find((p) => p.id === parcelaId)

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Novo recebimento"
      largura="max-w-md"
      rodape={
        <>
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button disabled={!divida} onClick={() => onEscolher({ divida, parcela })}>
            Continuar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label="Devedor"
          value={devedorId}
          onChange={(e) => {
            setDevedorId(e.target.value)
            setDividaId('')
            setParcelaId('')
          }}
        >
          <option value="">Selecione…</option>
          {(devedores ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </Select>

        {devedorId && (
          <Select
            label="Dívida"
            value={dividaId}
            onChange={(e) => {
              setDividaId(e.target.value)
              setParcelaId('')
            }}
            ajuda={dividas?.length === 0 ? 'Este devedor não tem dívidas em aberto.' : undefined}
          >
            <option value="">Selecione…</option>
            {(dividas ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.descricao || d.tipo} — {formatarMoeda(d.total_devido)}
              </option>
            ))}
          </Select>
        )}

        {dividaId && parcelas?.length > 0 && (
          <Select label="Parcela" value={parcelaId} onChange={(e) => setParcelaId(e.target.value)}>
            <option value="">A dívida toda</option>
            {(parcelas ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.numero} · vence {formatarData(p.vencimento)} · {formatarMoeda(p.total_atualizado)} (
                {(SITUACOES[p.situacao] ?? SITUACOES.em_dia).rotulo})
              </option>
            ))}
          </Select>
        )}
      </div>
    </Modal>
  )
}
