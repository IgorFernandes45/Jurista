import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Field'
import { Alerta, AuthCard } from './AuthCard'
import { SENHA_MINIMA, traduzirErroAuth } from './erros'

export function Cadastro() {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmar: '' })
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [confirmarEmail, setConfirmarEmail] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const campo = (nome) => ({
    value: form[nome],
    onChange: (e) => setForm((f) => ({ ...f, [nome]: e.target.value })),
    erro: erros[nome],
  })

  function validar() {
    const e = {}
    if (!form.nome.trim()) e.nome = 'Informe seu nome.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Informe um e-mail válido.'
    if (form.senha.length < SENHA_MINIMA) e.senha = `Use pelo menos ${SENHA_MINIMA} caracteres.`
    if (form.confirmar !== form.senha) e.confirmar = 'As senhas não conferem.'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function cadastrar(e) {
    e.preventDefault()
    setErroGeral('')
    if (!validar()) return

    setEnviando(true)
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.senha,
      options: {
        data: { nome: form.nome.trim() },
        emailRedirectTo: window.location.origin,
      },
    })
    setEnviando(false)

    if (error) return setErroGeral(traduzirErroAuth(error))
    // Sem sessão = o projeto exige confirmação de e-mail
    if (!data.session) setConfirmarEmail(true)
  }

  if (confirmarEmail) {
    return (
      <AuthCard titulo="Confirme seu e-mail">
        <div className="flex flex-col gap-4">
          <Alerta tipo="sucesso">
            Enviamos um link de confirmação para <strong>{form.email}</strong>. Abra o e-mail (veja também o spam)
            e clique no link para ativar sua conta.
          </Alerta>
          <Link to="/login" className="text-center text-sm font-medium text-brand-600 hover:underline">
            Voltar para o login
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      titulo="Criar conta"
      rodape={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={cadastrar} className="flex flex-col gap-4" noValidate>
        <Alerta>{erroGeral}</Alerta>
        <Input label="Nome" autoComplete="name" required {...campo('nome')} />
        <Input label="E-mail" type="email" autoComplete="email" required {...campo('email')} />
        <Input
          label="Senha"
          type="password"
          autoComplete="new-password"
          ajuda={`Mínimo de ${SENHA_MINIMA} caracteres.`}
          required
          {...campo('senha')}
        />
        <Input label="Confirmar senha" type="password" autoComplete="new-password" required {...campo('confirmar')} />
        <Button type="submit" loading={enviando} className="w-full">
          Criar conta
        </Button>
      </form>
    </AuthCard>
  )
}
