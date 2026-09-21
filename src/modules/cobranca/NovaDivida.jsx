import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Input, Select, Textarea } from '@/shared/components/Field'
import { Card, EmptyState, PageHeader } from '@/shared/components/Page'
import { useToast } from '@/shared/components/Toast'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { formatarMoeda } from '@/shared/lib/format'
import { BASES_JUROS, MODOS_JUROS, TIPOS_DIVIDA } from './juros'

const hojeISO = () => new Date().toISOString().slice(0, 10)
const num = (v) => (v === '' || v === null || Number.isNaN(Number(v)) ? 0 : Number(v))

const VAZIO = {
  devedor_id: '',
  tipo: 'a_vista',
  descricao: '',
  valor_original: '',
  data_vencimento: hojeISO(),
  dia_pagamento: '',
  num_parcelas: '2',
  modo_juros: 'sem_juros',
  taxa_percent: '',
  multa_fixa: '',
  valor_manual: '',
  carencia_dias: '',
  base_juros: 'parcela',
  observacao: '',
}

export function NovaDivida() {
  const { id } = useParams()
  const editando = Boolean(id)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState({ ...VAZIO, devedor_id: params.get('devedor') ?? '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [temPagamento, setTemPagamento] = useState(false)

  const { dados: devedores, carregando: carregandoDevedores } = useConsulta(() =>
    supabase.from('devedores').select('id, nome').eq('ativo', true).order('nome'),
  )

  const { carregando: carregandoDivida } = useConsulta(async () => {
    if (!editando) return { data: null, error: null }
    const resposta = await supabase.from('dividas_resumo').select('*').eq('id', id).maybeSingle()
    const d = resposta.data
    if (d) {
      setForm({
        devedor_id: d.devedor_id,
        tipo: d.tipo,
        descricao: d.descricao ?? '',
        valor_original: String(d.valor_original),
        data_vencimento: d.data_vencimento,
        dia_pagamento: d.dia_pagamento ? String(d.dia_pagamento) : '',
        num_parcelas: d.num_parcelas ? String(d.num_parcelas) : '2',
        modo_juros: d.juros_modo ?? 'sem_juros',
        taxa_percent: d.juros_taxa > 0 ? String(d.juros_taxa) : '',
        multa_fixa: d.juros_multa > 0 ? String(d.juros_multa) : '',
        valor_manual: d.juros_valor_manual > 0 ? String(d.juros_valor_manual) : '',
        carencia_dias: d.juros_carencia > 0 ? String(d.juros_carencia) : '',
        base_juros: d.juros_base ?? 'parcela',
        observacao: d.observacao ?? '',
      })
      const { count } = await supabase
        .from('pagamentos')
        .select('id', { count: 'exact', head: true })
        .eq('divida_id', id)
      setTemPagamento((count ?? 0) > 0)
    }
    return resposta
  }, [id])

  const campo = (nome) => ({
    value: form[nome],
    onChange: (e) => setForm((f) => ({ ...f, [nome]: e.target.value })),
  })

  const valor = num(form.valor_original)
  const parcelas = Math.max(2, Number(form.num_parcelas) || 2)
  const valorParcela = form.tipo === 'parcelada' && valor > 0 ? valor / parcelas : 0

  async function salvar(e) {
    e.preventDefault()
    setErro('')

    if (!form.devedor_id) return setErro('Escolha o devedor.')
    if (valor <= 0) return setErro('Informe um valor maior que zero.')
    if (form.tipo === 'parcelada' && parcelas < 2) return setErro('Uma dívida parcelada precisa de pelo menos 2 parcelas.')
    if (form.modo_juros === 'manual' && num(form.valor_manual) <= 0)
      return setErro('Informe o valor de juros que será cobrado.')
    if (['percentual_dia', 'percentual_mes', 'multa_mais_dia'].includes(form.modo_juros) && num(form.taxa_percent) <= 0)
      return setErro('Informe a taxa de juros.')

    const parametros = {
      p_valor_original: valor,
      p_data_vencimento: form.data_vencimento,
      p_descricao: form.descricao,
      p_dia_pagamento: form.dia_pagamento ? Number(form.dia_pagamento) : null,
      p_num_parcelas: form.tipo === 'parcelada' ? parcelas : null,
      p_modo_juros: form.modo_juros,
      p_taxa_percent: num(form.taxa_percent),
      p_multa_fixa: num(form.multa_fixa),
      p_valor_manual: num(form.valor_manual),
      p_carencia_dias: num(form.carencia_dias),
      p_base_juros: form.base_juros,
      p_observacao: form.observacao,
    }

    setSalvando(true)
    const { data, error } = editando
      ? await supabase.rpc('editar_divida', { p_divida_id: id, ...parametros })
      : await supabase.rpc('criar_divida', { p_devedor_id: form.devedor_id, p_tipo: form.tipo, ...parametros })
    setSalvando(false)

    if (error) return setErro(error.message ?? 'Não foi possível salvar a dívida.')
    toast.sucesso(editando ? 'Dívida atualizada.' : 'Dívida cadastrada.')
    navigate(`/cobranca/dividas/${data ?? id}`)
  }

  if (carregandoDevedores || carregandoDivida) return <p className="text-sm text-slate-500">Carregando…</p>

  if (!editando && !devedores?.length) {
    return (
      <EmptyState
        titulo="Cadastre um devedor primeiro"
        descricao="A dívida precisa estar ligada a alguém."
        acao={<Button onClick={() => navigate('/cobranca/devedores')}>Ir para devedores</Button>}
      />
    )
  }

  const precisaTaxa = ['percentual_dia', 'percentual_mes', 'multa_mais_dia'].includes(form.modo_juros)

  return (
    <>
      <PageHeader
        titulo={editando ? 'Editar dívida' : 'Nova dívida'}
        descricao="Os juros são calculados no banco, então o valor é o mesmo em todas as telas."
      />

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Card>
          <p className="mb-4 text-xs font-medium tracking-wide text-slate-400 uppercase">Dívida</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Devedor" disabled={editando} {...campo('devedor_id')}>
              <option value="">Selecione…</option>
              {(devedores ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </Select>
            <Select label="Tipo" disabled={editando} {...campo('tipo')}>
              {TIPOS_DIVIDA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </Select>

            <Input label="Descrição (opcional)" placeholder="Ex.: empréstimo, aluguel" {...campo('descricao')} />
            <Input
              label={form.tipo === 'recorrente' ? 'Valor por mês' : 'Valor total'}
              type="number"
              step="0.01"
              min="0"
              disabled={temPagamento}
              ajuda={temPagamento ? 'Já existe pagamento lançado: o valor não pode mudar.' : undefined}
              {...campo('valor_original')}
            />

            <Input
              label={form.tipo === 'parcelada' ? 'Vencimento da 1ª parcela' : 'Primeiro vencimento'}
              type="date"
              disabled={temPagamento}
              {...campo('data_vencimento')}
            />

            {form.tipo === 'parcelada' && (
              <Input
                label="Número de parcelas"
                type="number"
                min="2"
                step="1"
                disabled={temPagamento}
                ajuda={valorParcela > 0 ? `${parcelas}x de aproximadamente ${formatarMoeda(valorParcela)}` : undefined}
                {...campo('num_parcelas')}
              />
            )}

            {form.tipo === 'recorrente' && (
              <Input
                label="Dia do pagamento"
                type="number"
                min="1"
                max="31"
                step="1"
                ajuda="Em meses mais curtos, vale o último dia do mês."
                {...campo('dia_pagamento')}
              />
            )}
          </div>
        </Card>

        <Card>
          <p className="mb-4 text-xs font-medium tracking-wide text-slate-400 uppercase">Juros por atraso</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Como calcular" {...campo('modo_juros')}>
              {MODOS_JUROS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </Select>

            {form.modo_juros !== 'sem_juros' && (
              <Select label="Os juros incidem" {...campo('base_juros')}>
                {BASES_JUROS.map((b) => (
                  <option key={b.valor} value={b.valor}>
                    {b.rotulo}
                  </option>
                ))}
              </Select>
            )}

            {precisaTaxa && (
              <Input
                label={form.modo_juros === 'percentual_mes' ? 'Taxa (% ao mês)' : 'Taxa (% ao dia)'}
                type="number"
                step="0.01"
                min="0"
                {...campo('taxa_percent')}
              />
            )}

            {form.modo_juros === 'multa_mais_dia' && (
              <Input label="Multa fixa (R$)" type="number" step="0.01" min="0" {...campo('multa_fixa')} />
            )}

            {form.modo_juros === 'manual' && (
              <Input
                label="Valor dos juros (R$)"
                type="number"
                step="0.01"
                min="0"
                ajuda="Valor cheio, sem cálculo por dia."
                {...campo('valor_manual')}
              />
            )}

            {form.modo_juros !== 'sem_juros' && (
              <Input
                label="Carência (dias)"
                type="number"
                min="0"
                step="1"
                ajuda="Dias de tolerância antes de começar a cobrar juros."
                {...campo('carencia_dias')}
              />
            )}
          </div>
        </Card>

        <Card>
          <Textarea label="Observação (opcional)" rows={2} {...campo('observacao')} />
        </Card>

        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" loading={salvando} size="lg">
            {editando ? 'Salvar alterações' : 'Cadastrar dívida'}
          </Button>
        </div>
      </form>
    </>
  )
}
