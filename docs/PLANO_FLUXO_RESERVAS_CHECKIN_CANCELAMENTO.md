# Simplificação de reservas, check-in e cancelamento

Data: 21/10/2026. Status: implementado e validado em desenvolvimento, incluindo o motivo opcional de cancelamento.

O aplicativo está em pré-produção. Atualizar exemplos e a modelagem atual sem desenvolver conversores de bases legadas. Preservar integridade financeira e histórica das operações que o próprio sistema registrar.

## 1. Regras definidas pelo usuário

- Check-in pode ter chegada efetiva hoje ou em data anterior. Nunca em data futura.
- Datas futuras pertencem ao fluxo de reserva.
- Permitir registrar chegada retroativa esquecida, com autorização, motivo e histórico de quando o registro foi realizado.
- Cancelar reserva permite devolver ou não devolver dinheiro recebido. A reserva também pode não ter pagamento.
- O campo **Motivo do cancelamento (opcional)** permite registrar uma observação sem impedir o cancelamento quando ficar vazio.
- Reduzir cliques e evitar repetir cadastro, escolha de quarto, pagador, preço e datas já conhecidos.

## 2. Problemas confirmados

| Problema atual | Correção planejada |
| --- | --- |
| A reserva não oferece entrada direta | Botão **Fazer check-in** na linha/cartão e nos detalhes da reserva elegível. |
| O mapa reconhece somente reservas com entrada prevista para hoje | Abrir por `reservationId`, reconhecer reservas pendentes com chegada prevista hoje ou antes e pedir escolha apenas quando necessário. |
| Formulário repete CPF e nome editáveis após selecionar uma pessoa | Mostrar resumo da identidade e uma ação **Trocar hóspede**, sem campos duplicados. |
| Edição não cobre quarto, ocupação e pagador | Usar o mesmo formulário da criação, preenchido e limitado pelas regras de pagamentos e preço. |
| Check-in sempre envia hoje, mas o servidor não bloqueia explicitamente entrada futura | Campo de chegada efetiva com hoje por padrão; servidor exige data menor ou igual a hoje. |
| No-show usa 14h fixas na interface | Regra única com horário de entrada configurado e dia operacional, aplicada no servidor e na tela. |
| Cancelamento começa por tratativas técnicas mesmo sem pagamento | Resumo financeiro e escolha direta de devolver ou reter; sem escolha financeira quando não há recebimento. |

## 3. Fluxos finais e quantidade de ações

As contagens abaixo são ações de navegação/confirmação, sem contar digitação ou seleção de campos necessários.

| Caso | Caminho esperado |
| --- | --- |
| Chegada com reserva pronta | **Reservas → Fazer check-in → Confirmar entrada**. A partir da lista, são duas ações. |
| Chegada pelo mapa com uma reserva elegível | **Quarto → Check-in → Confirmar entrada**, com a reserva já preenchida. |
| Chegada sem reserva | **Check-in → selecionar/cadastrar pessoa, saída e quantidade → Confirmar entrada**. Não exigir criar reserva antes. |
| Reserva futura | **Nova reserva → pessoa, datas, quarto e quantidade → Confirmar reserva**. |
| Entrada com pagamento imediato | No mesmo formulário, marcar **Receber agora**, revisar o pagamento e confirmar tudo uma vez. |
| Cancelamento sem pagamento | **Cancelar → Confirmar cancelamento**, com motivo opcional no mesmo formulário. |
| Cancelamento pago | **Cancelar → devolver ou reter → Confirmar**, com motivo opcional no mesmo formulário e justificativa financeira quando exigida. |

Receber agora é opcional e recolhido por padrão. Não exigir pagamento para criar reserva ou iniciar hospedagem. Confirmar operação e recebimento juntos deve ser uma transação única; falha no caixa ou conta não pode deixar uma entrada parcialmente concluída.

## 4. Um atendimento compartilhado

Criar um formulário de hospedagem reutilizado em três contextos: nova reserva, editar reserva e check-in. O contexto define o que está preenchido, editável ou protegido. Não criar um assistente com várias etapas obrigatórias.

Ordem visual:

1. **Pessoa:** busca única; depois, nome e CPF em resumo. Cadastro rápido no próprio fluxo. Observações úteis do hóspede ficam recolhidas.
2. **Responsável:** empresa vinculada ou pessoa, mantendo a opção particular somente para quem tem vínculo. Sem seleção livre de uma empresa não vinculada.
3. **Período:** entrada e saída; no check-in, chegada efetiva hoje por padrão e alteração retroativa em uma opção explícita.
4. **Quarto e quantidade:** quarto preenchido quando a abertura veio do mapa/reserva. Disponibilidade consultada para o período completo.
5. **Preço:** valor calculado, com composição recolhida. Exceção de preço aparece somente para usuários autorizados e exige motivo.
6. **Receber agora:** opcional, com valor, meios e conta/caixa. Reservas pagas mostram recebido e saldo, sem digitar novamente o sinal.
7. **Confirmação:** resumo curto de pessoa, pagador, quarto, datas, preço, recebido e saldo.

Não recalcular preço confirmado silenciosamente. Em alteração de datas, quarto ou quantidade, apresentar nova cotação e diferença. Manter valor excepcional exige permissão e motivo; redução respeita o teto de desconto e o recebido.

## 5. Datas, reservas existentes e retroativos

### Validação obrigatória no servidor

- Comparar chegada com o dia operacional `America/Sao_Paulo`, sem confiar no relógio do dispositivo.
- `chegada efetiva <= hoje`; `saída > chegada efetiva`.
- Data futura enviada à operação de check-in deve ser recusada antes de criar ou modificar qualquer registro.
- Na tela, oferecer **Criar reserva para essa data** ao tentar uma entrada futura, preservando pessoa, pagador, quarto, ocupação e saída preenchidos. Não transformar a operação e confirmá-la silenciosamente.
- Quando já existe uma reserva vinculada, oferecer **Reagendar esta reserva**, sujeito à permissão de edição. A confirmação atualiza o mesmo ID, preserva recebimentos e encerra o atendimento quando a nova chegada é futura; não cria uma segunda reserva nem inicia uma hospedagem.
- Selecionar dia futuro na agenda do mapa serve para consulta/reserva; não deve oferecer uma confirmação de check-in futuro.

### Identificação da reserva

- Entrada vinculada recebe `reservationId` e sua versão; não procurar vínculo por combinação exata de CPF e datas.
- Aceitar reserva confirmada com chegada prevista hoje ou antes, ainda não iniciada nem cancelada.
- Mostrar **Previsto: … / Chegada efetiva: …** apenas quando forem diferentes. Identidade e condições confirmadas ficam em resumo.
- Não selecionar arbitrariamente a primeira reserva se houver ambiguidade. Pedir escolha ou regularização, sem duplicar reservas.
- Uma mudança de pagador, ocupação, pessoa ou quarto abre a edição preenchida pelo mesmo atendimento. Retornar à confirmação sem perder contexto.
- Reserva de grupo continua vinculando as reservas por grupo, mas cada quarto tem sua entrada e ocupação. Não iniciar todos automaticamente.

### Chegada atrasada e registro esquecido

São situações diferentes:

- **Chegou hoje, mas estava previsto antes:** chegada efetiva hoje; rever período e preço quando necessário. Não registrar noites ocupadas que não ocorreram nem conceder desconto automático no acordo original.
- **Chegou antes e a recepção esqueceu de lançar:** registrar a chegada real anterior, motivo e data/hora atual de criação. Não alterar o relógio da auditoria.

Preservar a data prevista no contrato da reserva e usar a chegada efetiva para ocupação e estatísticas. Separar composição de preço contratado da ocupação real, para que uma chegada tardia não gere diária prestada fictícia nos relatórios.

Retroativo exige `hospitality.checkin.backdate`, além da permissão normal, e motivo. Conceder inicialmente a administrador/supervisor; o administrador poderá liberar a recepção explicitamente. Nenhum limite arbitrário de “somente ontem”: usar datas válidas e verificar todo o intervalo.

### Ainda está hospedado ou já saiu

- **Ainda está hospedado:** registrar a entrada anterior, exigir quarto atualmente apto e livre para a hospedagem, respeitar capacidade e períodos já registrados. Se a saída prevista já passou, revisar a previsão sem afirmar que a pessoa já saiu.
- **Já saiu:** oferecer **Registrar hospedagem já encerrada** dentro do atendimento retroativo, com entrada e saída reais. Criar a hospedagem encerrada, verificar conflitos históricos e não alterar o estado atual do quarto nem expulsar seu ocupante atual. Exigir autorização retroativa e de encerramento.
- Na hospedagem encerrada vinculada a uma reserva, manter **Saída prevista** em resumo protegido e oferecer **Saída efetiva** editável. Enviar `actualCheckOut` separadamente, preservando o período contratado e os recebimentos. Usar a saída efetiva na alocação, no encerramento, na verificação de conflitos e nos relatórios. Quando o período real difere do contratado, exigir confirmação explícita de manutenção do valor; eventual renegociação continua na edição autorizada.
- O registro retroativo encerrado não importa consumos do quarto atualmente ocupado por outra pessoa. Os consumos e o estado do ocupante atual permanecem intactos.
- Verificar conflitos também contra alocações de hospedagens encerradas, não apenas reservas abertas. Não assumir que quarto livre hoje esteve livre em todo o passado.
- Registrar entrada retroativa não registra dinheiro automaticamente. Recebimentos usam caixa e conta atuais, com data de registro real. Se um valor já estiver conciliado nos saldos, exigir tratamento supervisionado para não duplicar receita; não reabrir ou reescrever um caixa fechado.

Esse caminho histórico fica em **Opções de data**, sem aumentar a complexidade da entrada normal de hoje. Deve ser entregue após a entrada retroativa de hospedagem ainda ativa e antes de declarar o fluxo retroativo completo.

## 6. Edição da reserva

Permitir editar antes do check-in:

- Quarto, datas e quantidade de pessoas, com capacidade e disponibilidade recalculadas.
- Pagador entre empresa vinculada e particular, com a mesma escolha da criação.
- Titular, quando ainda não houver recebimentos que impeçam a troca.
- Preço por tarifa ou exceção autorizada.

Com recebimentos, não permitir trocar titular/pagador e transferir dinheiro de responsabilidade sem conciliação específica. Uma mudança do vínculo empresarial no cadastro não altera o pagador de reserva já confirmada. Informar o impedimento antes de submeter o formulário.

Após o check-in, transferências, ocupantes, prorrogação e recebimentos continuam pelo atendimento da hospedagem. Não reabrir a edição genérica da reserva iniciada.

## 7. Cancelamento e devolução

Cancelar somente reservas confirmadas; hospedagem iniciada deve usar seu encerramento próprio. A ação não pode alterar o quarto de outro hóspede.

Incluir uma área de texto **Motivo do cancelamento (opcional)**, com limite de 500 caracteres. Não exigir preenchimento, não criar uma etapa adicional e não substituir observações gerais da reserva. Salvar o texto, quando informado, em campo próprio `cancellationReason`, apresentar nos detalhes da reserva cancelada e registrar na auditoria junto ao executor e à data/hora. Campo vazio ou contendo apenas espaços deve ser aceito e armazenado como ausência de motivo.

Esse motivo descreve por que a reserva foi cancelada. A justificativa obrigatória de retenção, devolução parcial ou outra decisão financeira excepcional é um campo separado e não torna obrigatório o motivo geral do cancelamento.

Resumo sempre visível:

- Valor contratado.
- Total efetivamente recebido e devoluções já realizadas.
- Valor disponível para devolver.
- Valor que será devolvido e valor que será retido.

### Nenhum pagamento recebido

Mostrar **Nenhum valor recebido. Não há devolução.** Oferecer o motivo opcional e confirmar o cancelamento. Não exigir conta, caixa, multa, crédito nem uma seleção “devolver ou não”.

### Há pagamento

Mostrar **Devolver o valor recebido?**:

- **Sim:** devolver o saldo disponível dos recebimentos, integralmente por padrão. Se necessária, devolução parcial fica em opção avançada autorizada, com valor e motivo; a diferença aparece explicitamente como retenção.
- **Não:** não gerar estorno nem crédito automático. Registrar integralmente a retenção do saldo recebido e seu motivo. Reter não pode simplesmente apagar o pagamento ou reduzir os saldos bancários.

A confirmação usa texto concreto: **Cancelar e devolver R$ …** ou **Cancelar e reter R$ …**. O valor nunca é o preço total da reserva quando apenas parte foi paga.

Exemplos de aceite: reserva de R$ 500 com sinal de R$ 100 pode devolver R$ 100, reter R$ 100 ou, na opção avançada, devolver R$ 60 e reter R$ 40. Reserva sem sinal devolve zero e não cria movimentação.

Regras financeiras:

- Preservar pagamentos originais e registrar eventos de devolução/retenção separados. Cancelar não deve apagar a prova do que foi recebido.
- Devolver pagamento bancário pela conta de origem; dinheiro pelo caixa aberto e disponível no dia da devolução. Mostrar as exigências antes da confirmação.
- Pagamento feito com crédito interno volta ao crédito de origem, sem convertê-lo em dinheiro. Devolver à empresa/pessoa responsável original, não a um novo vínculo cadastral.
- Devoluções por vários meios recompõem as origens, sem ultrapassar o disponível de cada recebimento e sem estornar duas vezes.
- Sem dinheiro suficiente ou sem autorização: não concluir parcialmente a devolução nem apresentar a reserva como cancelada com reembolso realizado. Preservar formulário e explicar a pendência.
- A opção existente de transformar saldo em crédito fica em **Outras tratativas**, sujeita à autorização, sem concorrer com as duas escolhas principais.
- No-show usa a mesma decisão financeira e o motivo correspondente; não marcar automaticamente apenas porque passou o horário.

## 8. Permissões e no-show

- Preservar permissões de reservar, editar, realizar check-in, receber e cancelar.
- Acrescentar `hospitality.checkin.backdate` para chegada retroativa e registro encerrado retroativo. Encerramento também exige o poder de check-out.
- Reserva paga exige a autorização atual de cancelamento pago. Retenção/devolução parcial/crédito exige o poder correspondente hoje representado por `reservations.feeCredit`; atualizar o rótulo para uma descrição comercial compreensível.
- A interface só oferece ações autorizadas, e o servidor revalida tudo na confirmação e no retorno idempotente.
- Usar `SystemSettings.checkInTime` e `America/Sao_Paulo` para elegibilidade de no-show no servidor e na interface. Não manter 14h fixas.
- Horário previsto é indicação operacional, não prova de ausência: registrar no-show exige ação explícita e motivo.

## 9. Implementação técnica

- Extrair o formulário compartilhado dos atuais `CheckinModal` e `ReservationsTab`, com intenção e origem explícitas e uma única lógica de pessoa/pagador/período/preço.
- Modelar separadamente previsão da reserva e ocupação efetiva. A operação de check-in recebe ID/versão da reserva, chegada real e eventuais decisões autorizadas; o servidor recupera o restante.
- Comandos próprios para criação, edição, entrada, registro retroativo encerrado e cancelamento. Não reutilizar edição genérica para contornar validações.
- Cancelamento recebe decisão de devolução, valor quando aplicável, `cancellationReason` opcional, justificativa financeira quando exigida e versão. O servidor valida os campos separadamente e calcula o valor disponível a partir dos recebimentos e estornos confirmados.
- Reutilizar transações serializáveis, verificação de versão, cotação, idempotência, auditoria e sincronização. Entrada/recebimento e cancelamento/devolução confirmam integralmente ou revertem integralmente.
- Refletir o mesmo comportamento na demonstração e atualizar os exemplos para permitir testar os caminhos sem dados incompletos.
- Atualizar ocupação, receita prestada, histórico do hóspede, notificações, extratos e exportações para distinguir datas contratuais, efetivas e de registro.
- Não incorporar juros e multa de pagamento nessa refatoração: esse recurso tem plano próprio. Retenção de cancelamento não é juro nem taxa de saída tardia.

## 10. Etapas e commits

1. **Domínio de datas e reserva:** regras de hoje/passado/futuro, vínculo por ID, chegada efetiva, disponibilidade histórica, preço e permissões. Testar no servidor antes de expor os novos controles.
2. **Formulário compartilhado e atalhos:** check-in direto da reserva, identidade em resumo, edição completa e sugestões corretas do mapa. Entregar o caminho comum com menos ações.
3. **Retroativos completos:** entrada anterior ainda ativa e depois hospedagem já encerrada, com ocupação/relatórios e pagamentos coerentes.
4. **Recebimento integrado e cancelamento simples:** pagamento opcional na confirmação, devolução/retenção e origens financeiras preservadas.
5. **No-show e homologação:** horário configurado, casos concorrentes, demo, mobile, documentação e revisão de permissões.

Separar os commits por tarefa. Uma etapa só é concluída quando servidor, interface e testes do comportamento correspondente estiverem prontos; não apresentar opções que ainda não funcionem.

## 11. Testes de aceite

- Data futura recusada no servidor sem criar pessoa, reserva, hospedagem ou pagamento; interface encaminha para reserva sem perder preenchimento.
- Entrada de hoje confirmada da lista sem procurar quarto no mapa e sem redigitar identidade.
- Reserva de ontem reconhecida pelo ID: chegada real hoje versus chegada esquecida ontem produzem ocupações corretas e preço revisado explicitamente.
- Retroativo sem permissão/motivo recusado; conflitos com hospedagem encerrada também recusados.
- Registro de estadia encerrada não modifica ocupante atual nem cria saldo de caixa fictício.
- Grupo permite entradas independentes; uma reserva não gera duas hospedagens em duas sessões.
- Troca de quarto/ocupação/datas recalcula capacidade, disponibilidade e preço; alteração de pagador respeita recebimentos e vínculo cadastral.
- Sinal recebido preservado e não recebido novamente; falha no pagamento integrado reverte a entrada/criação.
- Cancelamento sem pagamento não pede dados financeiros nem gera movimentação.
- Cancelamento aceita motivo vazio ou preenchido; texto informado fica nos detalhes e na auditoria, sem sobrescrever observações gerais. Validar espaços em branco e o limite de 500 caracteres. A ausência de motivo geral não dispensa justificativas financeiras obrigatórias.
- Devolução total, parcial e retenção conciliam recebido = devolvido + retido; reenvios e concorrência não duplicam estornos.
- Crédito interno não vira dinheiro; caixa fechado/saldo insuficiente/conta inválida não deixam cancelamento financeiro parcialmente aplicado.
- Cancelar reserva não encerra hospedagem já iniciada nem altera outro ocupante do quarto.
- No-show respeita a configuração real, exige confirmação e usa a mesma regra no cliente e no servidor.
- Interface mobile mantém alvos acessíveis, rascunhos protegidos, erros claros e confirmação única por operação.

## 12. Entrega e validação

O atendimento compartilhado é `BookingForm`, utilizado na criação, edição e entrada. A lista e os detalhes da reserva oferecem **Fazer check-in** para chegadas previstas até hoje. O mapa preenche a única reserva elegível ou pede escolha quando há ambiguidade. Alterar as condições dentro da confirmação retorna ao check-in com a nova versão da reserva. Quarto não preparado é informado antes da confirmação.

Os comandos operacionais confirmam no PostgreSQL com transação serializável, versão e recibo idempotente. A entrada de uma reserva exige ID explícito; uma entrada avulsa não escolhe outra reserva silenciosamente. As validações verificam períodos reais de alocação, inclusive hospedagens encerradas. A saída antecipada encerra a alocação na data efetiva, sem apagar o preço acordado; a transferência de quarto conserva a entrada prevista original.

O pagador de um novo atendimento é a pessoa ou a empresa vinculada em seu cadastro, com validação também no servidor. Alterar esse vínculo posteriormente não muda o responsável já confirmado. Recebimentos impedem trocar titular/pagador sem conciliação.

O cancelamento mantém o recebido original, registra devolução/retenção e recompõe as origens bancárias, de caixa ou crédito interno. O motivo opcional é normalizado e limitado a 500 caracteres. Retenção, devolução parcial e crédito continuam exigindo autorização e justificativa financeira própria. O horário configurado determina a elegibilidade de no-show; nenhuma ausência é marcada automaticamente.

As datas previstas, efetivas e de registro ficam distinguíveis no extrato. O relatório de hospedagem usa as noites efetivamente ocupadas e inclui essas informações na composição exportada em CSV. Registrar uma hospedagem já encerrada verifica conflitos e saldo, preservando o ocupante atual do quarto.

A demonstração no navegador executa comandos em uma cópia isolada antes de publicar alterações, sem usar o banco operacional. Os exemplos novos incluem documentos fictícios válidos para teste, ocupação, pagador, tarifas, recebimentos rastreáveis e conta de exemplo. A inicialização preserva uma demonstração já preenchida; não apaga automaticamente os dados existentes do navegador.

Validação executada nesta entrega:

- 426 testes de interface e domínio, incluindo comportamento do formulário e comandos da demonstração.
- 222 testes de integração no PostgreSQL exclusivo `erp_test`, incluindo devoluções por múltiplos meios, concorrência, permissões, retroativos, disponibilidade e relatórios.
- Verificação de tipos, análise estática e build de produção em diretório isolado.
- Navegador em 390 × 844 e desktop: cadastro rápido, criação, edição de quarto sem sair do atendimento, entrada e cancelamento com motivo consultável nos detalhes.

A migração `20261021000000_booking_flow` acrescenta os campos de registro e cancelamento. Foi aplicada e testada somente no banco isolado. A instalação Docker já possui a etapa `prisma migrate deploy`; atualizar a instalação exige reconstruir/iniciar a versão atual pelo painel. Não foram alterados volumes ou dados da instalação operacional durante esta validação.

Juros e multa de pagamento permanecem no plano específico desse recurso; esta entrega trata da decisão financeira de cancelamento.
