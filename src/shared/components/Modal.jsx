import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'

export function Modal({ aberto, onFechar, titulo, children, rodape, largura = 'max-w-lg' }) {
  useEffect(() => {
    if (!aberto) return
    const onKey = (e) => e.key === 'Escape' && onFechar?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [aberto, onFechar])

  if (!aberto) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onFechar} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl',
          largura,
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
          <button
            onClick={onFechar}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape && (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{rodape}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
