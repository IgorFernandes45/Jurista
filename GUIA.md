# Guia rápido — Agência Ímpar

Sistema: **https://jurista-beta.vercel.app**

Funciona no computador e no celular. No celular, o menu fica no botão ☰ no topo.

---

## Primeiro acesso

1. Entre com seu e-mail e senha.
2. Vá em **Configurações → Minha conta** e troque a senha por uma forte.
3. Em **Configurações → Formas de pagamento**, ajuste a lista (já vem com Dinheiro, Pix e Cartão). Você pode renomear, criar outras e desativar as que não usa.

---

## Painel

É a tela que abre ao entrar. Mostra, de um lado, a cobrança (em atraso, vence hoje, próximos 7 dias, total a receber) e, do outro, as vendas do dia e do mês e os produtos com estoque baixo. Clicar num quadro leva para a tela correspondente.

---

## Estoque e vendas

### Cadastrar um produto
**Produtos → Novo produto.** Preencha nome, preço de venda, preço de custo (usado no relatório de lucro), estoque mínimo e o estoque inicial.

> O **estoque mínimo** é o que dispara o alerta vermelho quando o estoque chega nele.

### Registrar uma venda
**Nova venda** → escolha o produto e clique em Adicionar (repita para mais itens) → ajuste quantidade e preço se precisar → informe desconto, cliente e forma de pagamento (tudo opcional) → **Registrar venda**.

- O **preço vem do cadastro, mas pode ser mudado na hora**.
- Se a venda deixar o estoque negativo, aparece um aviso amarelo — e você pode continuar mesmo assim.
- O estoque baixa sozinho.

### Corrigir uma venda
**Histórico de vendas** → clique na venda → **Editar** (o estoque se acerta pela diferença) ou **Cancelar venda** (os produtos voltam ao estoque).

### Mexer no estoque sem vender
Na lista de produtos, botão **Estoque**:
- **Entrada:** compra, devolução.
- **Saída:** perda, uso próprio.
- **Ajuste por contagem:** você digita quanto realmente tem e o sistema calcula a diferença.

Tudo isso fica registrado em **Estoque**, onde dá para editar ou apagar lançamentos feitos à mão.

---

## Cobrança

### Cadastrar quem deve
**Devedores → Novo devedor.** O campo **observação interna** é só seu — nunca aparece para o devedor. O campo **instruções de pagamento** (sua chave Pix, por exemplo) é o que ele vê no link.

### Lançar uma dívida
**Nova dívida**, ou o botão **Nova dívida** dentro da ficha do devedor.

Escolha o tipo:
- **À vista:** uma cobrança só.
- **Parcelada:** você informa o número de parcelas e o sistema divide, acertando os centavos na última.
- **Recorrente mensal:** uma cobrança por mês (mensalidade, aluguel). O sistema cria as novas sozinho, até você clicar em **Encerrar recorrência**.

Depois configure os **juros por atraso**:

| Modo | Como funciona |
|---|---|
| Sem juros | Não cobra nada por atraso |
| Percentual ao dia | Ex.: 1% ao dia |
| Percentual ao mês | Ex.: 5% ao mês, proporcional aos dias |
| Multa fixa + percentual ao dia | Ex.: R$ 20 + 0,5% ao dia |
| Valor digitado à mão | Um valor fixo de juros, sem cálculo |

E mais duas opções:
- **Os juros incidem:** sobre a parcela atrasada ou sobre o saldo total da dívida.
- **Carência:** dias de tolerância antes de os juros começarem a contar.

> Tudo isso pode ser mudado depois. Se a dívida já tiver pagamento lançado, o valor e o vencimento ficam travados, mas os juros e cada parcela continuam editáveis.

### Receber um pagamento
Três caminhos: botão **Receber** na parcela (dentro da dívida), na tela de **Alertas**, no **Calendário**, ou **Recebimentos → Novo recebimento**.

Na janela, digite o **valor recebido**: o sistema divide sozinho, cobrindo **primeiro os juros** e abatendo o resto do valor original. Os dois campos são editáveis, então você manda como quiser.

Para desfazer: **Estornar** — o saldo volta exatamente ao que era.

### O link do devedor
Na ficha do devedor, no cartão **Link do devedor**:
- **Copiar link** ou **Enviar pelo WhatsApp** (abre o WhatsApp com a mensagem pronta).
- **Desativar link:** para de funcionar na hora.
- **Gerar novo link:** o antigo morre e nasce outro.

O devedor vê: quanto deve hoje, o próximo vencimento, os dias de atraso, os juros acumulados, as parcelas e os pagamentos já feitos, além das suas instruções de pagamento. Ele **não** vê sua observação interna e não consegue mexer em nada.

### Calendário e alertas
- **Calendário:** cada dia com vencimento aparece marcado — verde em dia, amarelo vence hoje ou em breve, vermelho atrasado, cinza pago. Clique no dia para ver a lista e receber ali mesmo.
- **Alertas:** quem está atrasado, o que vence nos próximos 3, 7, 15 ou 30 dias, e os produtos com estoque no limite.

---

## Relatórios

Escolha o período (hoje, 7 dias, este mês, mês passado, este ano ou datas específicas) e veja:
- **Vendas:** faturamento, custo, lucro, margem, ticket médio, produtos mais vendidos, formas de pagamento e o dia a dia.
- **Cobrança:** recebido no período, juros recebidos, a receber, em atraso, e o recebido por devedor.

Cada tabela tem o botão **CSV**, que baixa o arquivo pronto para abrir no Excel.

> O lucro usa o **custo que o produto tinha no dia da venda**. Mudar o preço de custo hoje não altera os relatórios de meses passados.

---

## Cópia de segurança

**Configurações → Minha conta → Baixar backup agora.** Salva um arquivo com todos os seus dados. Vale fazer de vez em quando e guardar num lugar seguro — o arquivo tem dados dos seus devedores.

---

## Perguntas rápidas

**Esqueci minha senha.** Na tela de entrada, clique em "Esqueci minha senha" e siga o link que chega por e-mail.

**Apaguei sem querer.** Vendas canceladas e recebimentos estornados podem ser refeitos; produtos e devedores desativados podem ser reativados pelo filtro "Inativos".

**Posso usar no celular?** Sim, é o mesmo endereço. Dá para adicionar à tela de início pelo navegador.

**Outra pessoa pode ver meus dados?** Não. Cada conta enxerga apenas os próprios dados, e isso é garantido pelo banco, não só pela tela.
