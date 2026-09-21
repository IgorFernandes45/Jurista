// Gera um CSV que o Excel brasileiro abre direto: separador ';' e BOM no começo
export function baixarCSV(nomeArquivo, colunas, linhas) {
  const escapar = (valor) => {
    const texto = valor === null || valor === undefined ? '' : String(valor)
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
  }

  const conteudo = [
    colunas.map((c) => escapar(c.titulo)).join(';'),
    ...linhas.map((linha) => colunas.map((c) => escapar(c.valor(linha))).join(';')),
  ].join('\r\n')

  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' })
  const endereco = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = endereco
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(endereco)
}

// Números no formato que o Excel brasileiro entende (vírgula decimal)
export function numeroCSV(valor) {
  return String(Number(valor) || 0).replace('.', ',')
}
