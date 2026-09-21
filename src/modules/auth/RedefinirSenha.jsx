import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Field'
import { useToast } from '@/shared/components/Toast'
import { useAuth } from './AuthProvider'
import { Alerta, AuthCard } from './AuthCard'
import { SENHA_MINIMA, traduzirErroAuth } from './erros'

// Aberta pelo link do e-mail de recuperação: o Supabase cria uma sessão temporária
export function RedefinirSenha() {
  const { sessao, carregando } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
    if (senha !== confirmar) return setErro('As senhas não conferem.')

    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) return setErro(traduzirErroAuth(error))

    toast.sucesso('Senha alterada com sucesso.')
    navigate('/', { replace: true })
  }

  if (carregando) return null

  if (!sessao) {
    return (
      <AuthCard titulo="Link inválido ou expirado">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">Peça um novo link de recuperação de senha.</p>
          <Link to="/recuperar-senha" className="text-sm font-medium text-brand-600 hover:underline">
            Recuperar senha
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard titulo="Criar nova senha">
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Alerta>{erro}</Alerta>
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          ajuda={`Mínimo de ${SENHA_MINIMA} caracteres.`}
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          required
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
        />
        <Button type="submit" loading={enviando} className="w-full">
          Salvar nova senha
        </Button>
      </form>
    </AuthCard>
  )
}
