import { describe, expect, it } from 'vitest'
import { formatarData, formatarMoeda as moedaBruta, formatarQuantidade, formatarTelefone, parseMoeda } from './format'

// o Intl separa "R$" do valor com espaço não separável; trocamos por espaço comum
const formatarMoeda = (valor) => moedaBruta(valor).replace(/ /g, ' ')

describe('formatarMoeda', () => {
  it('formata no padrão brasileiro', () => {
    expect(formatarMoeda(1234.5)).toBe('R$ 1.234,50')
    expect(formatarMoeda(0)).toBe('R$ 0,00')
    expect(formatarMoeda('89.9')).toBe('R$ 89,90')
  })

  it('trata valor vazio como zero', () => {
    expect(formatarMoeda(null)).toBe('R$ 0,00')
    expect(formatarMoeda(undefined)).toBe('R$ 0,00')
  })
})

describe('formatarData', () => {
  it('mostra data pura sem mudar por causa do fuso', () => {
    // o banco devolve '2026-09-21'; não pode virar 20/09
    expect(formatarData('2026-09-21')).toBe('21/09/2026')
    expect(formatarData('2026-01-01')).toBe('01/01/2026')
  })

  it('devolve vazio quando não há data', () => {
    expect(formatarData(null)).toBe('')
  })
})

describe('formatarTelefone', () => {
  it('formata celular e fixo', () => {
    expect(formatarTelefone('11987654321')).toBe('(11) 98765-4321')
    expect(formatarTelefone('1133334444')).toBe('(11) 3333-4444')
  })

  it('formata enquanto a pessoa digita', () => {
    expect(formatarTelefone('11')).toBe('11')
    expect(formatarTelefone('119')).toBe('(11) 9')
  })

  it('ignora o que não é número e corta o que passa de 11 dígitos', () => {
    expect(formatarTelefone('(11) 98765-4321')).toBe('(11) 98765-4321')
    expect(formatarTelefone('119876543219999')).toBe('(11) 98765-4321')
  })
})

describe('formatarQuantidade', () => {
  it('não mostra casas decimais em número inteiro', () => {
    expect(formatarQuantidade(10)).toBe('10')
    expect(formatarQuantidade('4.000')).toBe('4')
  })

  it('mantém as casas quando existem', () => {
    expect(formatarQuantidade(2.5)).toBe('2,5')
  })
})

describe('parseMoeda', () => {
  it('entende número digitado em português', () => {
    expect(parseMoeda('1.234,56')).toBe(1234.56)
    expect(parseMoeda('R$ 50,00')).toBe(50)
  })

  it('devolve zero para texto inválido', () => {
    expect(parseMoeda('abc')).toBe(0)
    expect(parseMoeda('')).toBe(0)
  })
})
