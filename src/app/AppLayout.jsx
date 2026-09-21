import { AlertTriangle, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useAuth } from '@/modules/auth/AuthProvider'
import { useConfirm } from '@/shared/components/Confirm'
import { cn } from '@/shared/lib/cn'
import { navegacao } from './navegacao'

function Sidebar({ onNavegar }) {
  return (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <div className="px-3">
        <p className="text-lg font-bold text-slate-900">Agência Ímpar</p>
        <p className="text-xs text-slate-500">Estoque & Cobrança</p>
      </div>

      {navegacao.map((grupo, i) => (
        <div key={grupo.secao ?? i} className="flex flex-col gap-1">
          {grupo.secao && (
            <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">{grupo.secao}</p>
          )}
          {grupo.itens.map(({ caminho, titulo, icone: Icone }) => (
            <NavLink
              key={caminho}
              to={caminho}
              end={caminho === '/'}
              onClick={onNavegar}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <Icone className="size-4" />
              {titulo}
            </NavLink>
          ))}
        </div>
      ))}

      <UsuarioLogado />
    </nav>
  )
}

// Cria as mensalidades das dívidas recorrentes que já venceram, uma vez por sessão
function useGerarRecorrentes() {
  const jaRodou = useRef(false)

  useEffect(() => {
    if (jaRodou.current || !supabaseConfigurado) return
    jaRodou.current = true
    supabase.rpc('gerar_recorrentes').then(({ error }) => {
      if (error) console.warn('Não foi possível gerar as mensalidades recorrentes:', error.message)
    })
  }, [])
}

function UsuarioLogado() {
  const { usuario, perfil, sair } = useAuth()
  const confirmar = useConfirm()
  const nome = perfil?.nome || usuario?.user_metadata?.nome || 'Usuário'

  async function onSair() {
    if (await confirmar({ titulo: 'Sair', mensagem: 'Deseja sair do sistema?', textoConfirmar: 'Sair' })) {
      await sair()
    }
  }

  return (
    <div className="mt-auto flex items-center gap-3 border-t border-slate-200 px-3 pt-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
        {nome.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{nome}</p>
        <p className="truncate text-xs text-slate-500">{usuario?.email}</p>
      </div>
      <button
        onClick={onSair}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Sair"
        title="Sair"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  )
}

export function AppLayout() {
  const [menuAberto, setMenuAberto] = useState(false)
  useGerarRecorrentes()

  return (
    <div className="flex h-full">
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        <Sidebar />
      </aside>

      {/* Mobile */}
      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuAberto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button
              onClick={() => setMenuAberto(false)}
              className="absolute top-4 right-3 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
            <Sidebar onNavegar={() => setMenuAberto(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setMenuAberto(true)}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>
          <p className="font-semibold text-slate-900">Agência Ímpar</p>
        </header>

        {!supabaseConfigurado && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            <AlertTriangle className="size-4 shrink-0" />
            Supabase não configurado. Preencha o arquivo <code className="font-mono">.env.local</code> e reinicie o servidor.
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
