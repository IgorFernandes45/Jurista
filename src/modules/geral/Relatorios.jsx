import { Download } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Input, Select } from '@/shared/components/Field'
import { Card, PageHeader } from '@/shared/components/Page'
import { useConsulta } from '@/shared/hooks/useConsulta'
import { baixarCSV, numeroCSV } from '@/shared/lib/csv'
import { formatarData, formatarMoeda, formatarQuantidade } from '@/shared/lib/format'

const iso = (d) => d.toISOString().slice(0, 10)

function periodoDe(atalho) {
  const hoje = new Date()
  const inicio = new Date()
  switch (atalho) {
    case 'hoje':
      return { de: iso(hoje), ate: iso(hoje) }
    case '7dias':
      inicio.setDate(hoje.getDate() - 6)
      return { de: iso(inicio), ate: iso(hoje) }
    case 'mes_passado': {
      const primeiro = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      const ultimo = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
      return { de: iso(primeiro), ate: iso(ultimo) }
    }
    case 'ano':
      return { de: iso(new Date(hoje.getFullYear(), 0, 1)), ate: iso(hoje) }
    default: // mês atual
      return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: iso(hoje) }
  }
}

function Numero({ titulo, valor, detalhe, cor = 'padrao' }) {
  const cores = { padrao: 'text-slate-900', verde: 'text-green-700', vermelho: 'text-red-600' }
  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold ${cores[cor]}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </Card>
  )
}

function Tabela({ titulo, colunas, linhas, vazio, aoExportar }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{titulo}</h2>
        {linhas.length > 0 && aoExportar && (
          <Button size="sm" variant="secondary" icon={Download} onClick={aoExportar}>
            CSV
          </Button>
        )}
      </div>
      {linhas.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">{vazio}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                {colunas.map((c) => (
                  <th key={c.titulo} className={`py-2 pr-3 font-medium ${c.alinhar ?? ''}`}>
                    {c.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((linha, i) => (
                <tr key={i}>
                  {colunas.map((c) => (
                    <td key={c.titulo} className={`py-2 pr-3 text-slate-700 ${c.alinhar ?? ''}`}>
                      {c.render(linha)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export function Relatorios() {
  const [atalho, setAtalho] = useState('mes')
  const [periodo, setPeriodo] = useState(periodoDe('mes'))

  const { dados: vendas, carregando: carregandoVendas } = useConsulta(
    () => supabase.rpc('relatorio_vendas', { p_de: periodo.de, p_ate: periodo.ate }),
    [periodo.de, periodo.ate],
  )

  const { dados: cobranca, carregando: carregandoCobranca } = useConsulta(
    () => supabase.rpc('relatorio_cobranca', { p_de: periodo.de, p_ate: periodo.ate }),
    [periodo.de, periodo.ate],
  )

  function mudarAtalho(valor) {
    setAtalho(valor)
    if (valor !== 'personalizado') setPeriodo(periodoDe(valor))
  }

  const sufixo = `${periodo.de}_a_${periodo.ate}`

  return (
    <>
      <PageHeader titulo="Relatórios" descricao="Números de vendas e de cobrança no período escolhido." />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Select label="Período" value={atalho} onChange={(e) => mudarAtalho(e.target.value)}>
          <option value="hoje">Hoje</option>
          <option value="7dias">Últimos 7 dias</option>
          <option value="mes">Este mês</option>
          <option value="mes_passado">Mês passado</option>
          <option value="ano">Este ano</option>
          <option value="personalizado">Escolher datas</option>
        </Select>
        <Input
          label="De"
          type="date"
          value={periodo.de}
          onChange={(e) => {
            setAtalho('personalizado')
            setPeriodo((p) => ({ ...p, de: e.target.value }))
          }}
        />
        <Input
          label="Até"
          type="date"
          value={periodo.ate}
          onChange={(e) => {
            setAtalho('personalizado')
            setPeriodo((p) => ({ ...p, ate: e.target.value }))
          }}
        />
      </div>

      {carregandoVendas || carregandoCobranca ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* ---------------- Vendas ---------------- */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Vendas</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Numero
                titulo="Faturamento"
                valor={formatarMoeda(vendas.totais.faturamento)}
                detalhe={`${vendas.totais.qtd_vendas} venda(s)`}
              />
              <Numero titulo="Custo dos produtos" valor={formatarMoeda(vendas.totais.custo)} />
              <Numero
                titulo="Lucro"
                valor={formatarMoeda(vendas.totais.lucro)}
                detalhe={`Margem de ${String(vendas.totais.margem).replace('.', ',')}%`}
                cor="verde"
              />
              <Numero
                titulo="Ticket médio"
                valor={formatarMoeda(vendas.totais.ticket_medio)}
                detalhe={`Descontos: ${formatarMoeda(vendas.totais.descontos)}`}
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Tabela
                titulo="Produtos mais vendidos"
                vazio="Nenhuma venda no período."
                linhas={vendas.por_produto}
                colunas={[
                  { titulo: 'Produto', render: (l) => l.nome },
                  { titulo: 'Qtd.', render: (l) => formatarQuantidade(l.quantidade) },
                  { titulo: 'Total', render: (l) => formatarMoeda(l.total) },
                  { titulo: 'Lucro', render: (l) => formatarMoeda(l.lucro) },
                ]}
                aoExportar={() =>
                  baixarCSV(`produtos_${sufixo}.csv`, [
                    { titulo: 'Produto', valor: (l) => l.nome },
                    { titulo: 'Quantidade', valor: (l) => numeroCSV(l.quantidade) },
                    { titulo: 'Total', valor: (l) => numeroCSV(l.total) },
                    { titulo: 'Lucro', valor: (l) => numeroCSV(l.lucro) },
                  ], vendas.por_produto)
                }
              />

              <Tabela
                titulo="Vendas por forma de pagamento"
                vazio="Nenhuma venda no período."
                linhas={vendas.por_forma}
                colunas={[
                  { titulo: 'Forma', render: (l) => l.nome },
                  { titulo: 'Qtd.', render: (l) => l.qtd },
                  { titulo: 'Total', render: (l) => formatarMoeda(l.total) },
                ]}
                aoExportar={() =>
                  baixarCSV(`formas_pagamento_${sufixo}.csv`, [
                    { titulo: 'Forma de pagamento', valor: (l) => l.nome },
                    { titulo: 'Vendas', valor: (l) => l.qtd },
                    { titulo: 'Total', valor: (l) => numeroCSV(l.total) },
                  ], vendas.por_forma)
                }
              />
            </div>

            <div className="mt-4">
              <Tabela
                titulo="Dia a dia"
                vazio="Nenhuma venda no período."
                linhas={vendas.por_dia}
                colunas={[
                  { titulo: 'Dia', render: (l) => formatarData(l.dia) },
                  { titulo: 'Vendas', render: (l) => l.qtd },
                  { titulo: 'Faturamento', render: (l) => formatarMoeda(l.total) },
                  { titulo: 'Lucro', render: (l) => formatarMoeda(l.lucro) },
                ]}
                aoExportar={() =>
                  baixarCSV(`vendas_por_dia_${sufixo}.csv`, [
                    { titulo: 'Dia', valor: (l) => l.dia },
                    { titulo: 'Vendas', valor: (l) => l.qtd },
                    { titulo: 'Faturamento', valor: (l) => numeroCSV(l.total) },
                    { titulo: 'Lucro', valor: (l) => numeroCSV(l.lucro) },
                  ], vendas.por_dia)
                }
              />
            </div>
          </section>

          {/* ---------------- Cobrança ---------------- */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Cobrança</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Numero
                titulo="Recebido no período"
                valor={formatarMoeda(cobranca.recebido.total)}
                detalhe={`${cobranca.recebido.qtd} recebimento(s)`}
                cor="verde"
              />
              <Numero
                titulo="Juros recebidos"
                valor={formatarMoeda(cobranca.recebido.juros)}
                detalhe={`Valor original: ${formatarMoeda(cobranca.recebido.principal)}`}
              />
              <Numero
                titulo="A receber"
                valor={formatarMoeda(cobranca.em_aberto.a_receber)}
                detalhe={`${cobranca.em_aberto.qtd_dividas} dívida(s) em aberto`}
              />
              <Numero
                titulo="Em atraso"
                valor={formatarMoeda(cobranca.em_aberto.atrasado)}
                detalhe={`${cobranca.em_aberto.qtd_atrasadas} dívida(s)`}
                cor="vermelho"
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Tabela
                titulo="Recebido por devedor"
                vazio="Nenhum recebimento no período."
                linhas={cobranca.recebido_por_devedor}
                colunas={[
                  { titulo: 'Devedor', render: (l) => l.nome },
                  { titulo: 'Recebimentos', render: (l) => l.qtd },
                  { titulo: 'Total', render: (l) => formatarMoeda(l.total) },
                  { titulo: 'Juros', render: (l) => formatarMoeda(l.juros) },
                ]}
                aoExportar={() =>
                  baixarCSV(`recebido_por_devedor_${sufixo}.csv`, [
                    { titulo: 'Devedor', valor: (l) => l.nome },
                    { titulo: 'Recebimentos', valor: (l) => l.qtd },
                    { titulo: 'Total', valor: (l) => numeroCSV(l.total) },
                    { titulo: 'Juros', valor: (l) => numeroCSV(l.juros) },
                  ], cobranca.recebido_por_devedor)
                }
              />

              <Tabela
                titulo="Recebido por forma de pagamento"
                vazio="Nenhum recebimento no período."
                linhas={cobranca.recebido_por_forma}
                colunas={[
                  { titulo: 'Forma', render: (l) => l.nome },
                  { titulo: 'Qtd.', render: (l) => l.qtd },
                  { titulo: 'Total', render: (l) => formatarMoeda(l.total) },
                ]}
                aoExportar={() =>
                  baixarCSV(`recebido_por_forma_${sufixo}.csv`, [
                    { titulo: 'Forma de pagamento', valor: (l) => l.nome },
                    { titulo: 'Recebimentos', valor: (l) => l.qtd },
                    { titulo: 'Total', valor: (l) => numeroCSV(l.total) },
                  ], cobranca.recebido_por_forma)
                }
              />
            </div>
          </section>
        </div>
      )}
    </>
  )
}
