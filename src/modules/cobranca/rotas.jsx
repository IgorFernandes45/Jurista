import { Bell, CalendarDays, FilePlus2, HandCoins, Users } from 'lucide-react'
import { Alertas } from './Alertas'
import { Calendario } from './Calendario'
import { DetalheDivida } from './DetalheDivida'
import { Devedores } from './Devedores'
import { FichaDevedor } from './FichaDevedor'
import { NovaDivida } from './NovaDivida'
import { Recebimentos } from './Recebimentos'

export const rotasCobranca = {
  secao: 'Cobrança',
  itens: [
    { caminho: '/cobranca/devedores', titulo: 'Devedores', icone: Users, elemento: <Devedores /> },
    { caminho: '/cobranca/nova-divida', titulo: 'Nova dívida', icone: FilePlus2, elemento: <NovaDivida /> },
    { caminho: '/cobranca/recebimentos', titulo: 'Recebimentos', icone: HandCoins, elemento: <Recebimentos /> },
    { caminho: '/cobranca/calendario', titulo: 'Calendário', icone: CalendarDays, elemento: <Calendario /> },
    { caminho: '/cobranca/alertas', titulo: 'Alertas', icone: Bell, elemento: <Alertas /> },
  ],
}

// Rotas que existem mas não aparecem no menu
export const rotasCobrancaExtras = [
  { caminho: '/cobranca/devedores/:id', elemento: <FichaDevedor /> },
  { caminho: '/cobranca/dividas/:id', elemento: <DetalheDivida /> },
  { caminho: '/cobranca/dividas/:id/editar', elemento: <NovaDivida /> },
]
