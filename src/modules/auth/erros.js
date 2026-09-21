export const SENHA_MINIMA = 8

const porCodigo = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada (e o spam).',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  email_exists: 'Já existe uma conta com este e-mail.',
  weak_password: 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  over_email_send_rate_limit: 'Muitos e-mails enviados em pouco tempo. Aguarde alguns minutos e tente de novo.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  email_address_invalid: 'E-mail inválido.',
  validation_failed: 'Verifique os dados informados.',
  signup_disabled: 'Novos cadastros estão desativados.',
  session_not_found: 'Sua sessão expirou. Entre novamente.',
  otp_expired: 'O link expirou. Peça um novo.',
}

const porMensagem = [
  [/invalid login credentials/i, porCodigo.invalid_credentials],
  [/email not confirmed/i, porCodigo.email_not_confirmed],
  [/already registered/i, porCodigo.user_already_exists],
  [/password should be/i, porCodigo.weak_password],
  [/rate limit/i, porCodigo.over_email_send_rate_limit],
  [/invalid format/i, porCodigo.email_address_invalid],
  [/failed to fetch|network/i, 'Sem conexão com o servidor. Verifique sua internet.'],
]

export function traduzirErroAuth(erro) {
  if (!erro) return ''
  if (erro.code && porCodigo[erro.code]) return porCodigo[erro.code]
  const achado = porMensagem.find(([re]) => re.test(erro.message ?? ''))
  return achado ? achado[1] : 'Não foi possível concluir. Tente novamente.'
}
