import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Field'
import { Alerta, AuthCard } from './AuthCard'
import { traduzirErroAuth } from './erros'

export function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setEnviando(false)
    if (error) return setErro(traduzirErroAuth(error))
    setEnviado(true)
  }

  return (
    <AuthCard
      titulo="Recuperar senha"
      subtitulo={enviado ? null : 'Informe seu e-mail e enviaremos um link para criar uma nova senha.'}
      rodape={
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {enviado ? (
        <Alerta tipo="sucesso">
          Se existir uma conta com <strong>{email}</strong>, você receberá um e-mail com o link em alguns minutos
          (veja também o spam).
        </Alerta>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Alerta>{erro}</Alerta>
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" loading={enviando} className="w-full">
            Enviar link
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
