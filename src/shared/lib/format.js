const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dataFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })
const dataHoraFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatarMoeda(valor) {
  return moedaFmt.format(Number(valor) || 0)
}

// Aceita 'AAAA-MM-DD' (data pura, sem fuso) ou Date/ISO com hora
export function formatarData(valor) {
  if (!valor) return ''
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split('-')
    return `${d}/${m}/${a}`
  }
  return dataFmt.format(new Date(valor))
}

export function formatarDataHora(valor) {
  if (!valor) return ''
  return dataHoraFmt.format(new Date(valor))
}

export function formatarTelefone(valor) {
  const d = String(valor ?? '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// Converte texto digitado em pt-BR ("1.234,56") para número
export function parseMoeda(texto) {
  if (typeof texto === 'number') return texto
  const limpo = String(texto ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? n : 0
}

// Quantidades: mostra sem casas decimais quando for número inteiro
export function formatarQuantidade(valor) {
  const n = Number(valor) || 0
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}
