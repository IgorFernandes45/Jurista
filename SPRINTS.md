# Agência Ímpar — Plano de Sprints

Sistema web com dois módulos independentes (Estoque & Vendas + Cobrança) sobre React + Vite + TailwindCSS e Supabase.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Usuários | Cada usuário isolado: cada login só vê os próprios dados (RLS por `user_id`) |
| Integração entre módulos | Nenhuma: dívidas são cadastradas à mão, sem vínculo com vendas |
| Prioridade | Os dois módulos avançam juntos, alternando entregas |
| Ritmo | Sem prazo fixo: uma sprint termina quando o critério de pronto é cumprido |
| Edição | **Tudo editável**: produtos, vendas, dívidas, juros, carência, parcelas, pagamentos e formas de pagamento |
| Cliente na venda | Opcional: nome e telefone digitados na hora, sem cadastro de clientes |
| Formas de pagamento | Cadastradas e editadas pelo usuário (Pix, dinheiro, cartão…), usadas nas vendas e nos recebimentos |
| Recebimentos | Lançados manualmente pelo usuário quando o devedor paga |
| Pagamento parcial | O usuário define na hora quanto vai para juros e quanto para o principal (a tela sugere "juros primeiro") |
| Carência | Configurável por dívida (padrão: 0 dias) |
| Dívida recorrente | Gera uma nova cobrança todo mês no `dia_pagamento`, até ser encerrada; cada mês atrasado acumula os próprios juros |
| Base dos juros | Configurável por dívida: sobre a parcela atrasada ou sobre o saldo total da dívida |
| Estoque | Cancelar venda devolve estoque, venda sem estoque é permitida (fica negativo, com aviso), preço editável na venda, edição de venda já registrada, relatório de lucro |
| Área do devedor | **Link público, só leitura**, por devedor: mostra datas de pagamento, dias de atraso, juros acumulados e total atualizado |
| Ponto de partida | Do zero: o Claude escreve o código e guia os passos manuais (contas, chaves, deploy) |

## Premissas técnicas (confirmar se algo estiver errado)

- **Todas as tabelas levam `user_id`**, inclusive `venda_itens`, `movimentos_estoque`, `parcelas` e `pagamentos`. Isso deixa as regras de RLS simples e seguras.
- **Juros simples** (como nos exemplos do plano), acumulando dia a dia sobre cada parcela ou mensalidade vencida.
- **Dias de atraso e valores atualizados são calculados na consulta** (views/funções com `current_date`), sem job diário. O único job agendado (`pg_cron`) é o que gera as cobranças recorrentes.
- **Valores monetários** usam `numeric(12,2)`. Fuso horário: `America/Sao_Paulo`.
- **Operações que mexem em várias tabelas rodam em funções SQL transacionais (RPC)**: registrar, editar ou cancelar venda e registrar ou editar pagamento.
- **Toda alteração de estoque gera um registro em `movimentos_estoque`**, que serve de histórico e auditoria.

### Mudanças no modelo de dados em relação ao plano original

| Tabela | Mudança |
|---|---|
| `formas_pagamento` (nova) | `id, user_id, nome, ativo` |
| `vendas` | `cliente` vira `cliente_nome` e `cliente_telefone` (opcionais); `forma_pagamento` vira `forma_pagamento_id`; entra `status` (ativa/cancelada) e `desconto` |
| `pagamentos` | Entram `forma_pagamento_id`, `parcela_id`, `valor_principal`, `valor_juros` e `observacao` |
| `divida_juros` | Entra `carencia_dias` |
| `devedores` | Entram `link_token` (aleatório, impossível de adivinhar), `link_ativo` e `instrucoes_pagamento` (ex.: chave Pix exibida na área do devedor) |

### Segurança do link do devedor

- **O link usa um token aleatório longo** (`/d/8f3a…`), nunca o ID nem o nome do devedor.
- **A página pública não acessa as tabelas diretamente.** Ela chama uma única função `area_devedor(token)`, que devolve só os dados daquele devedor e apenas os campos permitidos.
- **Campos internos, como `observacao`, nunca aparecem** na página pública.
- **O usuário pode desativar o link ou gerar um novo** (o antigo para de funcionar na hora).
- **A página não é indexada** por buscadores (`noindex`).

---

## Sprint 0 — Fundação do projeto

**Objetivo:** ambiente pronto e app "vazio" rodando localmente.

- [x] Criar conta no Supabase e um projeto (passo manual guiado)
- [x] Criar o projeto React + Vite + TailwindCSS em `C:\Jurista`
- [x] Iniciar o Git e criar o `.gitignore`
- [x] Guardar as chaves em `.env.local` (fora do Git)
- [x] Configurar o cliente Supabase (`src/lib/supabase.js`)
- [x] Criar a estrutura de pastas por módulo (`src/modules/estoque`, `src/modules/cobranca`, `src/modules/publico`, `src/shared`)
- [x] Montar o layout base: menu lateral com os dois módulos, cabeçalho e rotas (React Router)
- [x] Montar os componentes base: botão, input, tabela, modal, toast, confirmação e formatação de moeda, telefone e data (pt-BR)

**Pronto quando:** `npm run dev` abre o app com o menu navegando entre páginas vazias dos dois módulos.

## Sprint 1 — Login e banco de dados

**Objetivo:** autenticação funcionando e todas as tabelas criadas com segurança por usuário.

- [x] Script SQL (migration) com todas as tabelas: `perfis`, `formas_pagamento`, `produtos`, `vendas`, `venda_itens`, `movimentos_estoque`, `devedores`, `dividas`, `divida_juros`, `parcelas`, `pagamentos` → `supabase/migrations/0001_schema_inicial.sql`
- [x] Constraints, índices, enums (`tipo_movimento`, `tipo_divida`, `modo_juros`, `status_divida`) e `created_at`/`updated_at`
- [x] Políticas RLS em todas as tabelas (`user_id = auth.uid()`) + chaves estrangeiras compostas `(id, user_id)`, para impedir referências a registros de outro usuário
- [x] Formas de pagamento iniciais criadas no cadastro do usuário (Dinheiro, Pix, Cartão), que depois podem ser editadas ou apagadas
- [x] Estoque atual recalculado automaticamente ao inserir, editar ou apagar movimentos (trigger)
- [x] Telas de login, cadastro, "esqueci minha senha" e "criar nova senha"
- [x] Rotas protegidas, logout e sessão persistente
- [x] Teste de isolamento escrito (`supabase/tests/01_isolamento_rls.sql`) e validado num Postgres local
- [x] Rodar a migration no Supabase
- [x] Rodar o teste de isolamento no Supabase (passou)
- [x] Criar a primeira conta pelo app e entrar

**Pronto quando:** dá para criar conta, entrar e sair, e o teste de RLS passa.

## Sprint 2 — Cadastros base (Produtos, Devedores e Formas de pagamento)

**Objetivo:** os cadastros principais dos dois módulos.

**Geral**
- [x] Tela de formas de pagamento: criar, renomear e ativar/desativar

**Estoque**
- [x] Lista de produtos com busca, filtro ativo/inativo e ordenação
- [x] Criar e editar produto (nome, SKU, preço de venda, preço de custo, estoque mínimo)
- [x] Ativar e desativar produto (sem apagar, para manter o histórico)
- [x] Entrada de mercadoria, saída e ajuste por contagem, os três gerando movimento
- [x] Histórico de movimentos com filtro por produto e tipo, com edição e exclusão de movimentos manuais (o estoque é recalculado)

**Cobrança**
- [x] Lista de devedores com busca e filtro ativo/inativo
- [x] Criar, editar e ativar/desativar devedor (nome, telefone, observação interna, instruções de pagamento)
- [x] Página do devedor (por enquanto só os dados; as dívidas entram na Sprint 4)

**Pronto quando:** dá para cadastrar formas de pagamento, produtos com estoque inicial e devedores.

## Sprint 3 — Vendas

**Objetivo:** registrar vendas com baixa automática de estoque.

- [x] Tela "Nova venda": seleção de produto, carrinho, quantidade, **preço editável por item**, desconto, cliente opcional (nome + telefone), forma de pagamento e data
- [x] Aviso (sem bloqueio) quando a venda deixa um produto com estoque negativo
- [x] RPC `registrar_venda`: grava venda e itens, dá baixa no estoque e gera os movimentos, tudo numa transação só
- [x] Histórico de vendas com filtro por período, cliente, forma de pagamento e situação, com total do período
- [x] Detalhe da venda
- [x] RPC `editar_venda`: altera qualquer campo, incluindo itens, quantidades e preços, e reconcilia o estoque pela diferença
- [x] RPC `cancelar_venda`: marca a venda como cancelada e devolve os itens ao estoque

**Pronto quando:** vender, editar e cancelar deixam o estoque sempre correto e com o movimento registrado.

## Sprint 4 — Dívidas e cálculo de juros

**Objetivo:** cadastrar dívidas dos três tipos com juros configuráveis e saldo correto.

- [x] Tela "Nova dívida": tipo (à vista, parcelada ou recorrente mensal), descrição, valor, dia de pagamento e vencimento
- [x] Configuração de juros com os 4 modos (% ao dia, % ao mês, multa fixa + % ao dia, valor cheio manual), dias de carência e **base do cálculo** (sobre a parcela atrasada ou sobre o saldo total)
- [x] Geração automática das parcelas (dívida parcelada), com cada parcela editável (valor e vencimento)
- [x] Dívida recorrente: função `gerar_recorrentes` cria as mensalidades que venceram (roda ao abrir o sistema), com botão "encerrar recorrência"
- [x] Regra para meses mais curtos: dia 31 vira o último dia do mês
- [x] Funções SQL `juros_parcela(parcela, data)` e `saldo_divida(divida, data)`, respeitando a carência, mais as visões `dividas_resumo` e `parcelas_resumo`
- [x] Testes SQL com os exemplos do plano (R$1.000 a 1%/dia por 5 dias = R$50, etc.), com e sem carência
- [x] Editar tudo depois de criado: dívida, configuração de juros e parcelas (o saldo é recalculado)
- [x] Página do devedor listando suas dívidas, com o saldo atualizado e os juros acumulados

**Pronto quando:** os valores exibidos batem com os exemplos do plano em todos os modos de juros.

## Sprint 5 — Recebimentos

**Objetivo:** lançar manualmente os pagamentos e baixar as dívidas.

- [x] Tela de recebimento: escolher o devedor e a dívida ou parcela, ver o saldo atualizado (principal + juros acumulados)
- [x] **Divisão manual** do valor pago entre juros e principal, já pré-preenchida com "juros primeiro"
- [x] Forma de pagamento, data e observação do recebimento
- [x] RPC `registrar_pagamento`: grava o pagamento, marca a parcela como paga e atualiza o status da dívida (em aberto, parcial, quitada)
- [x] Editar e estornar pagamento (o status e o saldo são recalculados)
- [x] Lista de recebimentos com filtro por período, devedor e forma de pagamento, somando juros e principal
- [x] Extrato da dívida: parcelas com juros acumulados e lista de recebimentos

**Pronto quando:** pagamentos parciais e totais deixam o saldo e o status corretos, e editar ou excluir um pagamento volta tudo ao valor certo.

## Sprint 6 — Área do devedor (link público)

**Objetivo:** o devedor abre um link e vê a própria situação, sem login.

- [x] Geração do `link_token` por devedor e botões "copiar link", "enviar pelo WhatsApp" (abre o WhatsApp com a mensagem pronta, sem integração paga), "desativar link" e "gerar novo link"
- [x] Função SQL `area_devedor(token)` (`security definer`): devolve só os dados permitidos daquele devedor
- [x] Página pública `/d/:token`, só leitura, pensada para celular:
  - Próximo vencimento em destaque (data e valor)
  - Situação por dívida e parcela: em dia, vence hoje ou atrasada há X dias
  - Valor original, juros acumulados até hoje e total atualizado
  - Histórico de pagamentos já feitos
  - Instruções de pagamento (ex.: chave Pix), definidas pelo usuário
- [x] Tela de "link inválido ou desativado"
- [ ] Primeira publicação na Vercel (passo manual guiado), para que o link funcione fora do seu computador  <-- ÚNICO ITEM PENDENTE
- [x] Teste de segurança: token errado ou desativado não mostra nada, e um devedor não consegue ver dados de outro

**Pronto quando:** o link aberto no celular mostra datas, juros acumulados e total corretos, e para de funcionar ao ser desativado.

## Sprint 7 — Calendário, alertas e painel inicial

**Objetivo:** visão do dia a dia dos dois módulos.

- [ ] View SQL de vencimentos com situação (em dia, vence hoje/amanhã, atrasado) e dias de atraso
- [ ] Calendário mensal com vencimentos por devedor em verde, amarelo e vermelho; clicar no dia abre a lista
- [ ] Painel de alertas: vencendo nos próximos N dias e atrasados, já com o valor atualizado com juros e atalho para enviar o link ao devedor
- [ ] Alerta de estoque abaixo do mínimo
- [ ] Painel inicial com resumo dos dois módulos: vendas do dia e do mês, produtos em alerta, total a receber, total em atraso e vencimentos de hoje

**Pronto quando:** ao entrar no sistema, o painel mostra corretamente quem está atrasado, o que vence e o que está com estoque baixo.

## Sprint 8 — Relatórios

**Objetivo:** números para tomar decisão.

- [ ] Lucro por venda e por período (preço de venda − custo)
- [ ] Produtos mais vendidos e curva de faturamento por período
- [ ] Vendas por forma de pagamento
- [ ] Cobrança: recebido × a receber × em atraso por período; juros recebidos; recebimentos por forma de pagamento
- [ ] Exportação para CSV das listas principais

**Pronto quando:** os relatórios batem com os dados das telas de vendas e recebimentos.

## Sprint 9 — Polimento, testes e publicação final

**Objetivo:** sistema pronto para uso real.

- [ ] Layout responsivo (celular e tablet) em todas as telas
- [ ] Estados de carregamento, vazio e erro; validação de formulários; confirmações antes de ações destrutivas
- [ ] Testes automatizados: Vitest para a lógica JS e testes SQL para juros, estoque, RLS e link público
- [ ] Domínio próprio na Vercel, se desejado (passo manual guiado)
- [ ] Backup: rotina de exportação do banco
- [ ] Guia rápido de uso

**Pronto quando:** o sistema está publicado, acessível por URL e testado no celular e no computador.
