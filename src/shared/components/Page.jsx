import { cn } from '@/shared/lib/cn'

export function PageHeader({ titulo, descricao, acoes }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  )
}

export function EmptyState({ icone: Icone, titulo, descricao, acao }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {Icone && <Icone className="mb-3 size-10 text-slate-300" />}
      <p className="font-medium text-slate-700">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-slate-500">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}

const coresBadge = {
  verde: 'bg-green-100 text-green-700',
  amarelo: 'bg-amber-100 text-amber-700',
  vermelho: 'bg-red-100 text-red-700',
  cinza: 'bg-slate-100 text-slate-600',
  azul: 'bg-brand-100 text-brand-700',
}

export function Badge({ cor = 'cinza', children, className }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', coresBadge[cor], className)}>
      {children}
    </span>
  )
}

export function Card({ className, children }) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white p-5', className)}>{children}</div>
}
