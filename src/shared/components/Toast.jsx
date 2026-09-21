import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { cn } from '@/shared/lib/cn'

const ToastContext = createContext(null)

const estilos = {
  sucesso: { icone: CheckCircle2, cor: 'text-green-600' },
  erro: { icone: XCircle, cor: 'text-red-600' },
  aviso: { icone: AlertTriangle, cor: 'text-amber-500' },
  info: { icone: Info, cor: 'text-brand-600' },
}

// Uso: const toast = useToast(); toast.sucesso('Produto salvo')
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remover = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const mostrar = useCallback(
    (tipo, mensagem) => {
      const id = crypto.randomUUID()
      setToasts((t) => [...t, { id, tipo, mensagem }])
      setTimeout(() => remover(id), 4000)
    },
    [remover],
  )

  const api = useMemo(
    () => ({
      sucesso: (m) => mostrar('sucesso', m),
      erro: (m) => mostrar('erro', m),
      aviso: (m) => mostrar('aviso', m),
      info: (m) => mostrar('info', m),
    }),
    [mostrar],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map(({ id, tipo, mensagem }) => {
          const { icone: Icone, cor } = estilos[tipo]
          return (
            <div
              key={id}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
            >
              <Icone className={cn('mt-0.5 size-5 shrink-0', cor)} />
              <p className="flex-1 text-sm text-slate-700">{mensagem}</p>
              <button onClick={() => remover(id)} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
