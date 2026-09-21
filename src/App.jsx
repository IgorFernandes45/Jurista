import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'
import { AuthProvider } from '@/modules/auth/AuthProvider'
import { ConfirmProvider } from '@/shared/components/Confirm'
import { ToastProvider } from '@/shared/components/Toast'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
