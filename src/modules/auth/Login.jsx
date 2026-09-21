import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Field'
import { Alerta, AuthCard } from './AuthCard'
import { traduzirErroAuth } from './erros'

export function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    // Com sucesso, o AuthProvider recebe a sessão e a RotaVisitante redireciona
    if (error) setErro(traduzirErroAuth(error))
  }

  return (
    <AuthCard
      titulo="Entrar"
      rodape={
        <>
          Não tem conta?{' '}
          <Link to="/cadastro" className="font-medium text-brand-600 hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={entrar} className="flex flex-col gap-4">
        <Alerta>{erro}</Alerta>
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <div className="-mt-2 text-right">
          <Link to="/recuperar-senha" className="text-sm text-brand-600 hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" loading={enviando} className="w-full">
          Entrar
        </Button>
      </form>
    </AuthCard>
  )
}
