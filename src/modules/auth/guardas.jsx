import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

function Carregando() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="size-8 animate-spin text-brand-600" />
    </div>
  )
}

// Só entra logado; guarda a página pedida para voltar a ela depois do login
export function RotaProtegida() {
  const { sessao, carregando } = useAuth()
  const location = useLocation()

  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/login" replace state={{ de: location.pathname + location.search }} />
  return <Outlet />
}

// Login/cadastro: quem já está logado vai direto para o sistema
export function RotaVisitante() {
  const { sessao, carregando } = useAuth()
  const location = useLocation()

  if (carregando) return <Carregando />
  if (sessao) return <Navigate to={location.state?.de ?? '/'} replace />
  return <Outlet />
}
