import { rotasCobranca, rotasCobrancaExtras } from '@/modules/cobranca/rotas'
import { rotasEstoque, rotasEstoqueExtras } from '@/modules/estoque/rotas'
import { rotasConfiguracoes, rotasGeral } from '@/modules/geral/rotas'

// Ordem das seções no menu lateral
export const navegacao = [rotasGeral, rotasEstoque, rotasCobranca, rotasConfiguracoes]

// Rotas internas que não aparecem no menu
export const rotasExtras = [...rotasEstoqueExtras, ...rotasCobrancaExtras]
