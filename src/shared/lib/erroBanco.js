// Traduz os erros mais comuns do Postgres/Supabase para o usuário
export function traduzirErroBanco(erro, mensagens = {}) {
  if (!erro) return ''
  if (erro.code && mensagens[erro.code]) return mensagens[erro.code]

  switch (erro.code) {
    case '23505':
      return mensagens.duplicado ?? 'Já existe um registro com esses dados.'
    case '23503':
      return mensagens.emUso ?? 'Este registro está sendo usado em outro lugar e não pode ser removido.'
    case '23514':
      return mensagens.invalido ?? 'Algum valor informado não é válido.'
    case '42501':
      return 'Sua sessão expirou. Entre novamente.'
    case 'PGRST301':
      return 'Sua sessão expirou. Entre novamente.'
    default:
      if (/failed to fetch|network/i.test(erro.message ?? '')) return 'Sem conexão com o servidor.'
      return mensagens.padrao ?? 'Não foi possível salvar. Tente novamente.'
  }
}
