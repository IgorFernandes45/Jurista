import { cn } from '@/shared/lib/cn'

// colunas: [{ chave, titulo, render?: (linha) => node, className? }]
export function Table({ colunas, linhas, chaveLinha = 'id', onClickLinha, vazio }) {
  if (!linhas?.length && vazio) return vazio

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {colunas.map((c) => (
              <th
                key={c.chave}
                className={cn('px-4 py-3 text-left font-medium whitespace-nowrap text-slate-600', c.className)}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {linhas.map((linha) => (
            <tr
              key={linha[chaveLinha]}
              onClick={onClickLinha ? () => onClickLinha(linha) : undefined}
              className={cn(onClickLinha && 'cursor-pointer hover:bg-slate-50')}
            >
              {colunas.map((c) => (
                <td key={c.chave} className={cn('px-4 py-3 whitespace-nowrap text-slate-700', c.className)}>
                  {c.render ? c.render(linha) : linha[c.chave]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
