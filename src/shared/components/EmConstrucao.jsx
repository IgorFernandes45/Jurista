import { Hammer } from 'lucide-react'
import { EmptyState, PageHeader } from './Page'

export function EmConstrucao({ titulo, sprint }) {
  return (
    <>
      <PageHeader titulo={titulo} />
      <EmptyState icone={Hammer} titulo="Em construção" descricao={`Esta tela será construída na Sprint ${sprint}.`} />
    </>
  )
}
