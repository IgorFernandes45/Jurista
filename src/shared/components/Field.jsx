import { useId } from 'react'
import { cn } from '@/shared/lib/cn'

const baseCampo =
  'w-full rounded-lg border bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-slate-100'

function Wrapper({ id, label, erro, ajuda, className, children }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {children}
      {erro ? (
        <p className="text-xs text-red-600">{erro}</p>
      ) : (
        ajuda && <p className="text-xs text-slate-500">{ajuda}</p>
      )}
    </div>
  )
}

export function Input({ label, erro, ajuda, className, ...props }) {
  const id = useId()
  return (
    <Wrapper id={id} label={label} erro={erro} ajuda={ajuda} className={className}>
      <input
        id={id}
        className={cn(baseCampo, 'h-10', erro ? 'border-red-400' : 'border-slate-300')}
        {...props}
      />
    </Wrapper>
  )
}

export function Select({ label, erro, ajuda, className, children, ...props }) {
  const id = useId()
  return (
    <Wrapper id={id} label={label} erro={erro} ajuda={ajuda} className={className}>
      <select
        id={id}
        className={cn(baseCampo, 'h-10', erro ? 'border-red-400' : 'border-slate-300')}
        {...props}
      >
        {children}
      </select>
    </Wrapper>
  )
}

export function Textarea({ label, erro, ajuda, className, rows = 3, ...props }) {
  const id = useId()
  return (
    <Wrapper id={id} label={label} erro={erro} ajuda={ajuda} className={className}>
      <textarea
        id={id}
        rows={rows}
        className={cn(baseCampo, 'py-2', erro ? 'border-red-400' : 'border-slate-300')}
        {...props}
      />
    </Wrapper>
  )
}
