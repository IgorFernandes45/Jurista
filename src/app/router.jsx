import { createBrowserRouter, Link } from 'react-router-dom'
import { Cadastro } from '@/modules/auth/Cadastro'
import { RotaProtegida, RotaVisitante } from '@/modules/auth/guardas'
import { Login } from '@/modules/auth/Login'
import { RecuperarSenha } from '@/modules/auth/RecuperarSenha'
import { RedefinirSenha } from '@/modules/auth/RedefinirSenha'
import { AreaDevedor } from '@/modules/publico/AreaDevedor'
import { EmptyState } from '@/shared/components/Page'
import { AppLayout } from './AppLayout'
import { navegacao, rotasExtras } from './navegacao'

function NaoEncontrado() {
  return (
    <EmptyState
      titulo="Página não encontrada"
      acao={
        <Link to="/" className="text-sm font-medium text-brand-600 hover:underline">
          Voltar ao painel
        </Link>
      }
    />
  )
}

export const router = createBrowserRouter([
  // Acesso (só para quem não está logado)
  {
    element: <RotaVisitante />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/cadastro', element: <Cadastro /> },
      { path: '/recuperar-senha', element: <RecuperarSenha /> },
    ],
  },
  // Aberta pelo link do e-mail de recuperação
  { path: '/redefinir-senha', element: <RedefinirSenha /> },

  // Área interna (exige login)
  {
    element: <RotaProtegida />,
    children: [
      {
        element: <AppLayout />,
        children: [
          ...[...navegacao.flatMap((g) => g.itens), ...rotasExtras].map(({ caminho, elemento }) => ({
            path: caminho,
            element: elemento,
          })),
          { path: '*', element: <NaoEncontrado /> },
        ],
      },
    ],
  },

  // Área pública do devedor (sem login)
  { path: '/d/:token', element: <AreaDevedor /> },
])
