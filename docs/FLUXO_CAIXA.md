# Operação e passagem de turno do caixa

O caixa é único e compartilhado pela pousada. A Frente de Caixa concentra a abertura, movimentação, fechamento e consulta de turnos. O Financeiro mantém cobranças, despesas, movimentos e contas bancárias. O Mapa mantém as tarefas de hospedagem.

## Rotina do operador

1. Em **Frente de Caixa**, selecionar **Abrir caixa**, conferir o fundo sugerido e confirmar. Zero é permitido. Se houver um fechamento anterior, o fundo reservado é sugerido; mudar o valor exige motivo e a abertura fica vinculada ao turno anterior. A abertura não gera receita nem movimenta conta bancária.
2. Vender ou receber normalmente. Somente dinheiro movimenta o turno físico. PIX e cartões movimentam a conta ativa escolhida. Lançar consumo na hospedagem não recebe dinheiro; a baixa de estoque continua no momento da entrega, sem repetição no pagamento.
3. Usar **Movimentar** para suprimento ou sangria, com conta, valor e motivo. Os dois lados da transferência ficam registrados sem receita artificial. Saídas não podem exceder o saldo disponível.
4. Selecionar **Fechar caixa**, contar o dinheiro e informar o total. O esperado não é apresentado antes da primeira confirmação. Uma diferença mantém o turno aberto e oferece recontagem ou confirmação com justificativa obrigatória.
5. Informar quanto ficará como fundo; deixar o campo vazio mantém todo o valor contado. O restante é retirada em espécie sob responsabilidade de quem fecha. Só selecionar **Já depositei a retirada em uma conta** quando o depósito foi efetivamente realizado. Este registro incrementa a conta como transferência, não receita.
6. Conferir o comprovante com fundo inicial, entradas, saídas, esperado antes da retirada, contado, diferença, fundo reservado e retirada. O botão **Turnos anteriores** permite consultar novamente. Quem tem autorização de conferência pode registrar observação sobre uma diferença sem alterar os números do fechamento.

A retirada em espécie fica no fechamento, separada da movimentação de vendas e pagamentos usada na contagem. Se for depositada, o movimento bancário aponta para o fechamento (`cash-closing-deposit`). Não somar novamente esse depósito como venda ou receita. O relatório financeiro usa o esperado registrado no fechamento, preservando a conferência daquele turno.

## Consumo e pagamentos

A ficha lateral continua abrindo no próprio Mapa. Com caixa fechado, exibe aviso e **Abrir caixa**; sem permissão, orienta pedir a abertura a um usuário autorizado. O formulário é compartilhado com a Frente de Caixa e preserva a ficha e os campos do atendimento. Somente receber em dinheiro exige caixa aberto: marcar consumo e receber em PIX/cartão continuam disponíveis.

O topo do Mapa e o Financeiro não repetem os controles de turno. Atalhos contextuais de abertura em pagamentos permanecem para não interromper o atendimento. Um turno de dia anterior recebe aviso na Frente de Caixa; não há encerramento automático, pois o dinheiro precisa ser contado.

## Permissões

- `cash.open`: abrir e consultar o fundo sugerido.
- `cash.close`: fechar o próprio turno, identificado pelo ID do usuário.
- `cash.closeAny`: autorizar o fechamento de outro responsável, em conjunto com `cash.close`.
- `cash.move`: suprimentos, sangrias e depósito da retirada do fechamento.
- `cashCloses.read`: histórico e comprovantes de turnos.
- `cash.review`: registrar conferência de divergência; a interface exige também leitura dos turnos.
- A Frente de Caixa pode ser acessada para controlar turnos sem `pos.sell`; nesse caso não mostra o catálogo de venda.
- O estado operacional usa uma consulta reduzida quando o usuário não tem leitura dos fechamentos. Não expõe valores de vendas, contagens ou diferenças. A sincronização atualiza esse estado após abertura ou fechamento por outro usuário.

## Persistência e validação

No PostgreSQL, as operações passam por autorização no servidor, transação serializável e identificador de operação. O índice único impede dois caixas abertos. Tentativas concorrentes de recebimento e fechamento são resolvidas sem anexar um recebimento novo ao turno já encerrado. A migração `20261022000000_cash_handover` adiciona os campos de passagem e conferência; deve ser aplicada pelo procedimento normal de atualização do banco (`pnpm exec prisma migrate deploy`). Não reinicializar o banco para instalar a mudança.

A demonstração no navegador também permite operar turnos. Usa o armazenamento local e a transação de demonstração, sem acessar o banco do servidor. Ela não representa compartilhamento entre dispositivos; para esse uso, utilizar o modo conectado ao PostgreSQL. Vendas e recebimentos em dinheiro identificam o turno nos dois modos.

Validação inclui abertura concorrente, movimento durante fechamento, diferença com justificativa, fundo do próximo turno, depósito sem receita nem repetição, autorização, estado sem acesso financeiro e preservação da ficha de consumo ao abrir caixa.

## Verificação da entrega

- 463 testes unitários e de interface aprovados.
- 99 testes de integração aprovados em PostgreSQL isolado, incluindo caixa, pagamentos, permissões e notificações.
- Verificação de tipos, lint sem avisos e build de produção aprovados.
- Interface conferida no navegador em viewport mobile: controle explícito de turno na Frente de Caixa, formulário de fechamento e padding da ficha de consumo.
- A migração foi aplicada somente ao banco isolado de validação. A versão web local atual usa demonstração no navegador; a atualização de uma instalação PostgreSQL precisa executar as migrações normalmente.
