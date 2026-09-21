import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { supabaseConfigurado } from '@/lib/supabase'

export function AuthCard({ titulo, subtitulo, children, rodape }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-2xl font-bold text-slate-900">Agência Ímpar</p>
          <p className="text-sm text-slate-500">Estoque & Cobrança</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
          {!supabaseConfigurado && (
            <div className="mt-4">
              <Alerta>Supabase não configurado. Preencha o arquivo .env.local e reinicie o servidor.</Alerta>
            </div>
          )}
          <div className="mt-5">{children}</div>
        </div>
        {rodape && <div className="mt-4 text-center text-sm text-slate-600">{rodape}</div>}
      </div>
    </div>
  )
}

export function Alerta({ tipo = 'erro', children }) {
  if (!children) return null
  const erro = tipo === 'erro'
  const Icone = erro ? AlertCircle : CheckCircle2
  return (
    <div
      role={erro ? 'alert' : 'status'}
      className={
        'flex gap-2 rounded-lg px-3 py-2 text-sm ' +
        (erro ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700')
      }
    >
      <Icone className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
