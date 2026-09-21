import { ArrowLeft, Copy, FilePlus2, Link2Off, MessageCircle, Pencil, RefreshCw, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Badge, Card, EmptyState, PageHeader } from '@/shared/components/Page'
import { useConfirm } from '@/shared/components/Confirm'
import { useToast } from '@/shared/components/Toast'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'
import { formatarData, formatarMoeda, formatarTelefone } from '@/shared/lib/format'
import { SITUACOES, TIPOS_DIVIDA, explicarJuros } from './juros'
import { ModalDevedor } from './ModalDevedor'

export function FichaDevedor() {
  const { id } = useParams()
  const [editando, setEditando] = useState(null)

  const { dados, carregando, erro, recarregar } = useConsulta(
    () => supabase.from('devedores').select('*').eq('id', id).maybeSingle(),
    [id],
  )

  if (carregando) return <p className="text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="text-sm text-red-600">{traduzirErroBanco(erro, { padrao: 'Não foi possível carregar o devedor.' })}</p>
  if (!dados) {
    return (
      <EmptyState
        titulo="Devedor não encontrado"
        acao={
          <Link to="/cobranca/devedores" className="text-sm font-medium text-brand-600 hover:underline">
            Voltar para a lista
          </Link>
        }
      />
    )
  }

  return (
    <>
      <Link
        to="/cobranca/devedores"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" />
        Devedores
      </Link>

      <PageHeader
        titulo={dados.nome}
        descricao={dados.telefone ? formatarTelefone(dados.telefone) : 'Sem telefone cadastrado'}
        acoes={
          <>
            <Badge cor={dados.ativo ? 'verde' : 'cinza'}>{dados.ativo ? 'Ativo' : 'Inativo'}</Badge>
            <Button variant="secondary" icon={Pencil} onClick={() => setEditando(dados)}>
              Editar
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Observação interna</p>
          <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{dados.observacao || '—'}</p>
          <p className="mt-3 text-xs text-slate-400">Só você vê. Nunca aparece para o devedor.</p>
        </Card>
        <Card>
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Instruções de pagamento</p>
          <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{dados.instrucoes_pagamento || '—'}</p>
          <p className="mt-3 text-xs text-slate-400">Aparece na página que o devedor abre pelo link (Sprint 6).</p>
        </Card>
      </div>

      <LinkDoDevedor devedor={dados} onAtualizado={recarregar} />

      <DividasDoDevedor devedorId={id} />

      <ModalDevedor
        devedor={editando}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          setEditando(null)
          recarregar()
        }}
      />
    </>
  )
}

function DividasDoDevedor({ devedorId }) {
  const { dados, carregando } = useConsulta(
    () => supabase.from('dividas_resumo').select('*').eq('devedor_id', devedorId).order('proximo_vencimento', { nullsFirst: false }),
    [devedorId],
  )

  const dividas = dados ?? []
  const totalDevido = dividas
    .filter((d) => d.status !== 'cancelada')
    .reduce((soma, d) => soma + Number(d.total_devido), 0)

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Dívidas</h2>
        <Link
          to={`/cobranca/nova-divida?devedor=${devedorId}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
        >
          <FilePlus2 className="size-4" />
          Nova dívida
        </Link>
      </div>

      {carregando ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : dividas.length === 0 ? (
        <EmptyState icone={Wallet} titulo="Nenhuma dívida" descricao="Cadastre a primeira dívida deste devedor." />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {dividas.map((d) => {
              const situacao = SITUACOES[d.situacao] ?? SITUACOES.em_dia
              const tipo = TIPOS_DIVIDA.find((t) => t.valor === d.tipo)?.rotulo ?? d.tipo
              return (
                <Link
                  key={d.id}
                  to={`/cobranca/dividas/${d.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-300 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-800">{d.descricao || tipo}</p>
                      <Badge cor={situacao.cor}>
                        {situacao.rotulo}
                        {d.dias_atraso > 0 ? ` · ${d.dias_atraso}d` : ''}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {tipo}
                      {d.proximo_vencimento ? ` · próximo vencimento ${formatarData(d.proximo_vencimento)}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{explicarJuros(d)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-900">{formatarMoeda(d.total_devido)}</p>
                    {Number(d.juros_em_aberto) > 0 && (
                      <p className="text-xs text-slate-500">inclui {formatarMoeda(d.juros_em_aberto)} de juros</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
          <p className="mt-3 text-right text-sm text-slate-600">
            Total devido: <span className="font-semibold text-slate-900">{formatarMoeda(totalDevido)}</span>
          </p>
        </>
      )}
    </div>
  )
}

// Link público que o devedor abre para ver a própria situação
function LinkDoDevedor({ devedor, onAtualizado }) {
  const toast = useToast()
  const confirmar = useConfirm()
  const endereco = `${window.location.origin}/d/${devedor.link_token}`

  async function copiar() {
    try {
      await navigator.clipboard.writeText(endereco)
      toast.sucesso('Link copiado.')
    } catch {
      toast.erro('Não foi possível copiar. Selecione o link e copie à mão.')
    }
  }

  function enviarWhatsApp() {
    const texto = `Olá, ${devedor.nome}! Acompanhe sua cobrança por aqui: ${endereco}`
    const numero = (devedor.telefone ?? '').replace(/\D/g, '')
    const base = numero ? `https://wa.me/55${numero}` : 'https://wa.me/'
    window.open(`${base}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
  }

  async function alternarAtivo() {
    const ativar = !devedor.link_ativo
    if (
      !ativar &&
      !(await confirmar({
        titulo: 'Desativar link',
        mensagem: 'O link para de funcionar na hora para quem já o tem.',
        textoConfirmar: 'Desativar',
      }))
    )
      return

    const { error } = await supabase.from('devedores').update({ link_ativo: ativar }).eq('id', devedor.id)
    if (error) return toast.erro(traduzirErroBanco(error))
    toast.sucesso(ativar ? 'Link ativado.' : 'Link desativado.')
    onAtualizado()
  }

  async function gerarNovo() {
    const ok = await confirmar({
      titulo: 'Gerar novo link',
      mensagem: 'O link atual para de funcionar e um novo é criado. Envie o novo para o devedor.',
      textoConfirmar: 'Gerar novo link',
      perigo: true,
    })
    if (!ok) return

    const { data, error } = await supabase.rpc('gerar_token')
    if (error) return toast.erro('Não foi possível gerar o novo link.')

    const { error: erroUpdate } = await supabase
      .from('devedores')
      .update({ link_token: data, link_ativo: true })
      .eq('id', devedor.id)
    if (erroUpdate) return toast.erro(traduzirErroBanco(erroUpdate))

    toast.sucesso('Novo link gerado.')
    onAtualizado()
  }

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Link do devedor</p>
        <Badge cor={devedor.link_ativo ? 'verde' : 'cinza'}>{devedor.link_ativo ? 'Ativo' : 'Desativado'}</Badge>
      </div>

      <p className="mt-2 text-sm text-slate-500">
        Página só de consulta, sem login: mostra os vencimentos, os juros acumulados e o total atualizado. A observação
        interna nunca aparece.
      </p>

      <p className="mt-3 truncate rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">{endereco}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={Copy} onClick={copiar}>
          Copiar link
        </Button>
        <Button size="sm" variant="secondary" icon={MessageCircle} onClick={enviarWhatsApp}>
          Enviar pelo WhatsApp
        </Button>
        <Button size="sm" variant="ghost" icon={Link2Off} onClick={alternarAtivo}>
          {devedor.link_ativo ? 'Desativar link' : 'Ativar link'}
        </Button>
        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={gerarNovo}>
          Gerar novo link
        </Button>
      </div>
    </Card>
  )
}
