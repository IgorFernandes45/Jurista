import { formatarMoeda } from '@/shared/lib/format'

export const MODOS_JUROS = [
  { valor: 'sem_juros', rotulo: 'Sem juros' },
  { valor: 'percentual_dia', rotulo: 'Percentual ao dia' },
  { valor: 'percentual_mes', rotulo: 'Percentual ao mês' },
  { valor: 'multa_mais_dia', rotulo: 'Multa fixa + percentual ao dia' },
  { valor: 'manual', rotulo: 'Valor de juros digitado à mão' },
]

export const BASES_JUROS = [
  { valor: 'parcela', rotulo: 'Sobre a parcela atrasada' },
  { valor: 'saldo_devedor', rotulo: 'Sobre o saldo total da dívida' },
]

export const TIPOS_DIVIDA = [
  { valor: 'a_vista', rotulo: 'À vista (uma cobrança só)' },
  { valor: 'parcelada', rotulo: 'Parcelada' },
  { valor: 'recorrente', rotulo: 'Recorrente mensal' },
]

export const SITUACOES = {
  em_dia: { rotulo: 'Em dia', cor: 'verde' },
  vence_em_breve: { rotulo: 'Vence em breve', cor: 'amarelo' },
  vence_hoje: { rotulo: 'Vence hoje', cor: 'amarelo' },
  atrasada: { rotulo: 'Atrasada', cor: 'vermelho' },
  paga: { rotulo: 'Paga', cor: 'cinza' },
  quitada: { rotulo: 'Quitada', cor: 'cinza' },
  cancelada: { rotulo: 'Cancelada', cor: 'cinza' },
}

// Frase explicando, em português, como os juros daquela dívida são calculados
export function explicarJuros({ juros_modo, juros_taxa, juros_multa, juros_valor_manual, juros_carencia, juros_base }) {
  const base = juros_base === 'saldo_devedor' ? 'o saldo total da dívida' : 'a parcela atrasada'
  const taxa = `${Number(juros_taxa)}%`.replace('.', ',')
  const carencia = Number(juros_carencia) > 0 ? ` Carência de ${juros_carencia} dia(s).` : ''

  switch (juros_modo) {
    case 'percentual_dia':
      return `${taxa} ao dia sobre ${base}.${carencia}`
    case 'percentual_mes':
      return `${taxa} ao mês sobre ${base}, proporcional aos dias.${carencia}`
    case 'multa_mais_dia':
      return `Multa de ${formatarMoeda(juros_multa)} mais ${taxa} ao dia sobre ${base}.${carencia}`
    case 'manual':
      return `Juros fixos de ${formatarMoeda(juros_valor_manual)}, sem cálculo por dia.${carencia}`
    default:
      return 'Sem juros por atraso.'
  }
}
