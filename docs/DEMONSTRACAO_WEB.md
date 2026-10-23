# Cenário de teste da demonstração web

O modo `NEXT_PUBLIC_DATA_ADAPTER=demo-localStorage` é o mesmo no desenvolvimento e na publicação estática: interface, regras demonstrativas, acessos e armazenamento são compartilhados. A inicialização ocorre inteiramente no navegador, sem API ou PostgreSQL. O relógio do dispositivo e o fuso de São Paulo determinam o dia dos exemplos.

## Cenários para testar

| Quando | Cenário |
| --- | --- |
| Hoje | Cinco quartos ocupados, incluindo saída atrasada; consumos e saldos; uma chegada com sinal; quartos livres, limpeza e manutenção |
| Amanhã | Chegadas nos quartos 102, 201 e 304, com reserva de grupo dos dois primeiros e sinal no último; hospedagens em andamento; quartos livres e bloqueados |
| Próximas duas semanas | Entradas, saídas e intervalos livres para testar disponibilidade, alterações e reservas |
| Histórico | Hospedagem encerrada e quitada, cancelamento com motivo e ausência |
| Gestão | Pessoas, empresa com vínculo, tarifas por ocupação, vendas, estoque, despesas e contas a receber |

Os registros de hospedagem, ocupantes, alocações, diárias, pagamentos e consumos são gerados juntos. Reservas ativas do mesmo quarto não se sobrepõem. A data de saída encerra a ocupação prevista; a disponibilidade operacional continua sujeita à saída e à limpeza efetivas.

## Ciclo de uso

1. Execute `npm run dev:demo` (ou `pnpm dev:demo`) e acesse `http://localhost:3002`. Esse atalho seleciona a demonstração mesmo se o ambiente local estiver configurado para banco.
2. O pop-up mostra os acessos e permite preencher o login: supervisor `supervisor` / `adm123`; operador `operador` / `1234`.
3. No primeiro login, os exemplos são criados com a data atual. Recarregar, sair/entrar ou reiniciar o servidor preserva as alterações no mesmo dia comercial.
4. Ao entrar em outro dia, os exemplos são renovados. Uma página aberta não é restaurada automaticamente à meia-noite.
5. Para recomeçar no mesmo dia, saia da conta e use **Acessos da demonstração → Restaurar exemplos e descartar alterações**. O botão realiza o descarte identificado em seu texto.

`npm run dev` continua funcionando: mantenha `NEXT_PUBLIC_DATA_ADAPTER=demo-localStorage` no `.env.local`. A inicialização é exatamente a mesma; `dev:demo` apenas fixa a escolha do adaptador, sem criar outro modo de dados.

Os exemplos ficam exclusivamente no prefixo `erp-pousada-demo` do armazenamento local. Navegadores diferentes têm cenários independentes; abas da mesma origem compartilham os dados. A inicialização e os comandos coordenam acesso com Web Locks quando disponível. Testes multiusuário entre dispositivos exigem PostgreSQL compartilhado.

A consulta externa de CNPJ exige servidor operacional. Na demo, a interface orienta preencher manualmente. O modo Docker com PostgreSQL conserva seu próprio ciclo de dados descartáveis.

## Venda para hóspede no caixa

Selecione o hóspede no carrinho, se houver, e abra **Pagamento**. **Receber agora (não lançar na ficha)** registra o recebimento e não cria dívida no consumo. **Marcar na ficha de consumo** exige hospedagem ativa e permissão de lançamento; atualiza o extrato e o mapa, sem recebimento no caixa. A escolha do hóspede identifica a hospedagem por ID, sem interpretar o texto do quarto.

O mesmo formulário é usado na demonstração e no banco. Na demonstração, venda, estoque, cobrança e auditoria são preparados juntos antes de publicar o resultado. Repetir a confirmação preserva a venda original. O estorno de entrega ainda não recebida corrige a ficha sem inventar devolução de dinheiro; devolver estoque continua sendo uma escolha explícita. A hospedagem é conferida novamente pela versão selecionada para impedir lançamento após alteração ou encerramento.

## Publicação automática no GitHub Pages

`npm run build:demo` exporta a mesma interface para `.local/browser-demo-site`. `npm run build:demo:verify` confere recursos, caminho público, CSS e ausência de APIs. O build usa uma cópia temporária dos fontes, sem copiar `.env`, banco ou backups e sem alterar `.next` do desenvolvimento.

O empacotamento Next usa `output: export`, caminho `/erp-pousada` e entradas `.tsx`/`.jsx`; handlers do servidor `.ts` ficam fora do pacote. Imports normais de utilitários `.ts` continuam funcionando. O manifesto gerado é verificado para impedir APIs no pacote. É uma escolha de empacotamento, não outro aplicativo. Novas páginas que precisem de servidor devem ser avaliadas antes da inclusão na demo.

O CI gera a exportação também em PRs, mas só publica a `main` após aprovação dos testes da aplicação, painel Windows e exportação. O Pages deve usar **GitHub Actions** como origem. O job de publicação usa `pages:write` e `id-token:write`, sem token adicional de deploy.

Endereço: https://guimayer.github.io/erp-pousada/ . A publicação depende de enviar os commits e concluir o CI com sucesso. O projeto operacional continua usando `pnpm build`, com APIs e PostgreSQL. No Pages não há servidor operacional, worker de notificações, banco compartilhado ou backup; as funções de demonstração existentes ficam locais.

Referências: [exportação estática do Next.js](https://nextjs.org/docs/app/guides/static-exports) e [workflow do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
