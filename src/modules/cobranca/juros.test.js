import { describe, expect, it } from 'vitest'
import { explicarJuros as explicarBruto } from './juros'

// o Intl separa "R$" do valor com espaço não separável; trocamos por espaço comum
const explicarJuros = (divida) => explicarBruto(divida).replace(/ /g, ' ')

const base = {
  juros_modo: 'sem_juros',
  juros_taxa: 0,
  juros_multa: 0,
  juros_valor_manual: 0,
  juros_carencia: 0,
  juros_base: 'parcela',
}

describe('explicarJuros', () => {
  it('explica percentual ao dia sobre a parcela', () => {
    expect(explicarJuros({ ...base, juros_modo: 'percentual_dia', juros_taxa: 1 })).toBe(
      '1% ao dia sobre a parcela atrasada.',
    )
  })

  it('explica percentual ao mês sobre o saldo total', () => {
    expect(
      explicarJuros({ ...base, juros_modo: 'percentual_mes', juros_taxa: 5, juros_base: 'saldo_devedor' }),
    ).toBe('5% ao mês sobre o saldo total da dívida, proporcional aos dias.')
  })

  it('explica multa fixa mais juros por dia', () => {
    expect(explicarJuros({ ...base, juros_modo: 'multa_mais_dia', juros_taxa: 0.5, juros_multa: 20 })).toBe(
      'Multa de R$ 20,00 mais 0,5% ao dia sobre a parcela atrasada.',
    )
  })

  it('explica juros digitados à mão', () => {
    expect(explicarJuros({ ...base, juros_modo: 'manual', juros_valor_manual: 80 })).toBe(
      'Juros fixos de R$ 80,00, sem cálculo por dia.',
    )
  })

  it('avisa quando não há juros', () => {
    expect(explicarJuros(base)).toBe('Sem juros por atraso.')
  })

  it('inclui a carência quando existe', () => {
    expect(explicarJuros({ ...base, juros_modo: 'percentual_dia', juros_taxa: 1, juros_carencia: 3 })).toBe(
      '1% ao dia sobre a parcela atrasada. Carência de 3 dia(s).',
    )
  })
})
