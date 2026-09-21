import { afterEach, describe, expect, it, vi } from 'vitest'
import { baixarCSV, numeroCSV } from './csv'

// Captura o arquivo gerado sem baixar nada de verdade
function capturarCSV(colunas, linhas) {
  let conteudo = ''
  const criarURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    conteudo = blob._texto
    return 'blob:teste'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  // guarda o texto do Blob, já que Blob.text() é assíncrono
  const BlobOriginal = globalThis.Blob
  globalThis.Blob = class extends BlobOriginal {
    constructor(partes, opcoes) {
      super(partes, opcoes)
      this._texto = partes.join('')
    }
  }

  baixarCSV('teste.csv', colunas, linhas)
  globalThis.Blob = BlobOriginal
  criarURL.mockRestore()
  return conteudo
}

afterEach(() => vi.restoreAllMocks())

describe('baixarCSV', () => {
  it('gera cabeçalho e linhas separados por ponto e vírgula', () => {
    const csv = capturarCSV(
      [
        { titulo: 'Produto', valor: (l) => l.nome },
        { titulo: 'Total', valor: (l) => numeroCSV(l.total) },
      ],
      [
        { nome: 'Camiseta', total: 100.5 },
        { nome: 'Boné', total: 30 },
      ],
    )

    expect(csv).toContain('Produto;Total')
    expect(csv).toContain('Camiseta;100,5')
    expect(csv).toContain('Boné;30')
  })

  it('protege com aspas o texto que tem ponto e vírgula', () => {
    const csv = capturarCSV([{ titulo: 'Nome', valor: (l) => l.nome }], [{ nome: 'Camiseta; preta' }])
    expect(csv).toContain('"Camiseta; preta"')
  })

  it('começa com BOM, para o Excel abrir os acentos certos', () => {
    const csv = capturarCSV([{ titulo: 'Nome', valor: (l) => l.nome }], [{ nome: 'Boné' }])
    expect(csv.startsWith('﻿')).toBe(true)
  })
})

describe('numeroCSV', () => {
  it('usa vírgula decimal', () => {
    expect(numeroCSV(10.5)).toBe('10,5')
    expect(numeroCSV('7')).toBe('7')
    expect(numeroCSV(null)).toBe('0')
  })
})
