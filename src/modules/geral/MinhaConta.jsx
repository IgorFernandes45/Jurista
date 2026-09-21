import { Download, KeyRound, UserRound } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/modules/auth/AuthProvider'
import { SENHA_MINIMA, traduzirErroAuth } from '@/modules/auth/erros'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Field'
import { Card, PageHeader } from '@/shared/components/Page'
import { useToast } from '@/shared/components/Toast'
import { traduzirErroBanco } from '@/shared/lib/erroBanco'

// Tabelas que entram no backup, na ordem em que precisariam ser restauradas
const TABELAS = [
  'formas_pagamento',
  'produtos',
  'vendas',
  'venda_itens',
  'movimentos_estoque',
  'devedores',
  'dividas',
  'divida_juros',
  'parcelas',
  'pagamentos',
]

export function MinhaConta() {
  const { usuario, perfil, atualizarPerfil } = useAuth()
  const toast = useToast()

  const [nome, setNome] = useState(perfil?.nome ?? usuario?.user_metadata?.nome ?? '')
  const [salvandoNome, setSalvandoNome] = useState(false)

  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erroSenha, setErroSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  const [baixando, setBaixando] = useState(false)

  async function salvarNome(e) {
    e.preventDefault()
    if (!nome.trim()) return toast.erro('Informe seu nome.')

    setSalvandoNome(true)
    const { data, error } = await supabase
      .from('perfis')
      .update({ nome: nome.trim() })
      .eq('id', usuario.id)
      .select('id, nome')
      .single()
    setSalvandoNome(false)

    if (error) return toast.erro(traduzirErroBanco(error))
    atualizarPerfil(data)
    toast.sucesso('Nome atualizado.')
  }

  async function trocarSenha(e) {
    e.preventDefault()
    setErroSenha('')
    if (senha.length < SENHA_MINIMA) return setErroSenha(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
    if (senha !== confirmar) return setErroSenha('As senhas não conferem.')

    setSalvandoSenha(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvandoSenha(false)

    if (error) return setErroSenha(traduzirErroAuth(error))
    setSenha('')
    setConfirmar('')
    toast.sucesso('Senha alterada. Use a nova senha no próximo acesso.')
  }

  async function baixarBackup() {
    setBaixando(true)
    const backup = { gerado_em: new Date().toISOString(), conta: usuario.email, dados: {} }

    for (const tabela of TABELAS) {
      const { data, error } = await supabase.from(tabela).select('*')
      if (error) {
        setBaixando(false)
        return toast.erro(`Não foi possível ler ${tabela}. Tente de novo.`)
      }
      backup.dados[tabela] = data
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const endereco = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = endereco
    link.download = `backup-agencia-impar-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(endereco)

    setBaixando(false)
    const total = Object.values(backup.dados).reduce((s, linhas) => s + linhas.length, 0)
    toast.sucesso(`Backup baixado com ${total} registro(s).`)
  }

  return (
    <>
      <PageHeader titulo="Minha conta" descricao="Seus dados de acesso e uma cópia de segurança do sistema." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UserRound className="size-4 text-slate-400" />
            Dados
          </h2>
          <p className="mt-1 mb-4 text-sm text-slate-500">{usuario?.email}</p>

          <form onSubmit={salvarNome} className="flex flex-col gap-4">
            <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            <div>
              <Button type="submit" loading={salvandoNome}>
                Salvar nome
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <KeyRound className="size-4 text-slate-400" />
            Trocar senha
          </h2>
          <p className="mt-1 mb-4 text-sm text-slate-500">
            Use uma senha que você não usa em outro lugar, com pelo menos {SENHA_MINIMA} caracteres.
          </p>

          <form onSubmit={trocarSenha} className="flex flex-col gap-4">
            {erroSenha && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erroSenha}</p>}
            <Input
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
            />
            <div>
              <Button type="submit" loading={salvandoSenha}>
                Trocar senha
              </Button>
            </div>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Download className="size-4 text-slate-400" />
            Cópia de segurança
          </h2>
          <p className="mt-1 mb-4 text-sm text-slate-500">
            Baixa um arquivo com todos os seus dados: produtos, vendas, movimentos de estoque, devedores, dívidas,
            parcelas e recebimentos. Guarde num lugar seguro — ele contém dados dos seus devedores.
          </p>
          <Button variant="secondary" icon={Download} loading={baixando} onClick={baixarBackup}>
            Baixar backup agora
          </Button>
        </Card>
      </div>
    </>
  )
}
