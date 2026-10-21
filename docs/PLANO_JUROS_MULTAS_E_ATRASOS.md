# Juros, multa e tratamento de atrasos

Data: 21/10/2026. Status: plano para implementação; não altera cobranças existentes.

Contexto: o aplicativo está em pré-produção e contém exemplos. A implementação deve partir da modelagem atual e atualizar os exemplos, sem desenvolver conversores de bases legadas ou avisos de retrocompatibilidade. As regras de preservação abaixo dizem respeito a pagamentos e operações válidas dentro do novo fluxo, não a uma implantação anterior do sistema.

## 1. Objetivo e decisões

Permitir configurar encargos, revisar a composição antes de cobrar e aplicar ou dispensar valores com autorização e histórico. A operação deve continuar simples para a recepção.

Há dois fatos diferentes:

| Situação | Referência | Tratamento |
| --- | --- | --- |
| Pagamento vencido | Vencimento do título ou da parcela e saldo principal pendente | Juros simples e multa de pagamento, ou dispensa dos encargos. |
| Saída atrasada | Data/hora de saída prevista e ocupação atual | Diárias adicionais, taxa de saída tardia ou dispensa desse acréscimo. |

O aviso do quarto não comprova dívida vencida. Uma empresa pode ter prazo de pagamento após a hospedagem. Uma pessoa com saldo quitado pode continuar ocupando o quarto além do combinado.

Decisões para a primeira entrega:

- Nenhuma cobrança automática só por abrir uma tela, trocar de dia ou disparar um lembrete.
- Juros e multa financeiros incidem somente sobre obrigação com vencimento conhecido. O modo atual oferece essa referência em contas a receber e parcelas.
- Não inventar vencimento financeiro em hospedagens ativas: seu atraso de saída usa o tratamento operacional. Vencimentos contratuais durante a estadia exigirão uma evolução própria da modelagem.
- Separar valores originais, diárias adicionais, juros, multa, pagamentos e dispensas. Não aumentar silenciosamente o preço original nem simular venda de bebida.
- Não recomendar ou pré-preencher percentuais de cobrança: iniciar políticas desativadas e valores em zero.
- Dispensar encargos não perdoa diárias contratadas, consumo nem saldo principal.

## 2. Arquitetura atual e pontos de integração

| Parte existente | Aproveitamento e mudança necessária |
| --- | --- |
| `AccountReceivable` e `AccountReceivableInstallment` | Já têm vencimento, principal e valor pago. Acrescentar composição de encargos e separar a alocação do pagamento por componente. |
| `Stay`, `StayPayment` e `stayBalance` | Já separam diárias e consumo. Incluir componentes de atraso sem classificá-los automaticamente como consumo. |
| `StayAdjustment` | Atualmente representa ajustes genéricos; não usar como substituto de um histórico tipado de encargos. |
| `stay-extend` em `lib/server/stays.ts` | Reutilizar cotação e validação de ocupação para quem continuará hospedado. Não reutilizar sua exigência de saída futura para uma pessoa saindo agora. |
| `receiveTargets` em `lib/server/settlements.ts` | Centralizar principal e encargos, pagamentos parciais, parcelamento e recebimento em lote. |
| `receiveStay` e saída empresarial | Preservar vínculo entre hospedagem e título, com um único saldo exigível e um único movimento financeiro por recebimento. |
| Configurações por seção | Acrescentar campos à política comercial e à hospedagem, mantendo permissões e controle de versão. |
| Transações, idempotência, auditoria e sincronização | Reutilizar os mecanismos atuais, sem criar serviços adicionais. |

O cálculo financeiro será uma função de domínio compartilhada, validada novamente no servidor. A interface apresenta a prévia; não determina o valor definitivo da operação.

## 3. Configurações

### Política comercial: atraso de pagamento

- Ativar/desativar a política.
- Carência em dias de calendário, padrão zero. Após a carência, contar somente os dias excedentes, sem cobrança retroativa dos dias dispensados.
- Multa única: percentual ou valor fixo, com valor configurável.
- Juros simples: percentual ao dia, com taxa configurável e precisão superior à de valores monetários.
- Opção de dispensar multa e/ou juros individualmente na revisão, sujeita a permissão.

Uma apresentação mensal poderá converter a taxa para o equivalente diário por divisão por 30, mas o sistema armazenará a taxa diária explícita e exibirá a convenção. Evitar dois campos editáveis com taxas contraditórias.

### Hospedagem: atraso de saída

- Tolerância após o horário previsto, em minutos.
- Tratamento sugerido: revisar diárias, taxa de saída tardia ou dispensa. Sugestão não significa autorização para lançar.
- Taxa de saída tardia em valor fixo ou percentual da diária de referência, com referência exibida. Se não houver diária conhecida, exigir valor autorizado e motivo.
- Os valores de diárias adicionais continuam vindo das tarifas de hospedagem existentes.

As políticas terão versão e vigência. Cada obrigação nova guarda a política combinada. Uma alteração futura de configuração não reprecifica automaticamente cobranças já confirmadas.

## 4. Cálculo e recebimento financeiro

O atraso financeiro começa no dia seguinte ao vencimento, considerando a carência e o dia operacional `America/Sao_Paulo`. Não cobrar juros por diferença de horário do navegador.

**Saldo a receber = principal aberto + encargos aplicados ainda não recebidos.** Encargos apenas sugeridos aparecem separados e não integram saldo, cobrança externa ou receita realizada.

Regras:

1. Multa ocorre uma única vez por obrigação ou parcela vencida. Base percentual: principal aberto no início do atraso, preservado no histórico.
2. Juros simples usam somente o principal aberto em cada intervalo. Não calcular juros sobre multa, juros anteriores ou diárias que ainda não foram lançadas.
3. Pagamento parcial encerra um intervalo de cálculo; os próximos dias usam o principal remanescente. Pagamentos anteriores ao vencimento reduzem a base.
4. Para manter uma regra única e auditável, alocar pagamentos primeiro ao principal, depois à multa e aos juros. Mostrar essa distribuição antes de confirmar. Um título pode ficar sem principal e ainda ter encargos pendentes.
5. Cada confirmação acrescenta somente o período ainda não cobrado ou dispensado. Guardar os limites dos intervalos; não reaplicar o total da prévia a cada recebimento.
6. Usar Decimal para taxas e cálculo e centavos para valores lançados. Arredondar o resultado de cada intervalo confirmado a duas casas, sem arredondamento diário acumulativo.
7. Parcela tem vencimento e saldo próprios. O título agrega as parcelas e seus encargos, sem aplicar novamente a multa no total.
8. Saldo zero ou título quitado/cancelado não gera novos encargos. Prévia zerada não cria um lançamento monetário.
9. Recebimento em lote usa as mesmas regras por obrigação, sem uma multa global sobre o lote.
10. Estorno reverte a distribuição do recebimento na mesma transação. Revisar e invalidar cálculos posteriores dependentes antes de permitir nova cobrança, em vez de deixar bases inconsistentes.

Exemplo exclusivamente para teste: principal de R$ 1.000, multa de 2%, juros de 0,1% ao dia e dez dias de atraso, sem pagamentos anteriores: R$ 20 de multa e R$ 10 de juros, total de R$ 1.030. Esses percentuais não são parâmetros recomendados de operação.

## 5. Diárias adicionais e saída atrasada

No atendimento de um quarto atrasado, mostrar uma única área **Resolver atraso**, sem adicionar três botões permanentes ao cartão.

### Cobrar diárias adicionais

- Exibir período não faturado, quantidade de hóspedes, tarifas por noite e total.
- **Vai continuar hospedado:** abrir a prorrogação já existente, validar disponibilidade e confirmar a nova saída.
- **Está saindo agora:** calcular e lançar as noites adicionais já utilizadas e realizar o check-out com a saída real. Não obrigar a informar amanhã nem reservar um período futuro artificial.
- Noites adicionais usam o intervalo entre a saída contratada e a data real de saída. Atraso apenas no horário do mesmo dia é tratado como saída tardia; não criar uma noite fictícia automaticamente.
- Preservar histórico de diárias e pagamentos. Diárias adicionais entram no componente de hospedagem, não no de juros.
- Apresentar qualquer conflito com reservas do período excedido e encaminhar a regularização. Não alterar silenciosamente reservas de outras pessoas.
- Guardar o período já faturado para não cobrar as mesmas noites novamente após nova prorrogação ou revisão.

### Aplicar taxa de saída tardia

- Exibir o valor configurado, sua base e o motivo.
- Nomear como **taxa de saída tardia**, distinguindo da multa de pagamento vencido.
- Não alterar a saída prevista apenas para esconder o atraso; encerrar a ocupação conforme a saída real.

### Dispensar acréscimo pela saída

- Exigir motivo e permissão, registrando a tolerância concedida e o intervalo tratado.
- A dispensa cobre o atraso revisado até aquele momento. Permanecer mais tempo gera um novo período a revisar, não uma dispensa permanente.
- Não liberar check-out com saldo principal pendente pelas regras atuais. Cobrança empresarial a prazo continua exigindo suas permissões e vencimento.

Na primeira entrega, diárias adicionais e taxa de saída tardia são alternativas para o mesmo intervalo, com controle de períodos. Multa financeira é independente e só existe se uma obrigação financeira estiver vencida. A tela deve explicar quando os dois fatos ocorrem, impedindo cobrança operacional duplicada disfarçada de multa.

## 6. Modelo de dados proposto

Adicionar um registro tipado `BillingCharge` para multa financeira, juros e taxa de saída tardia. Não criar um segundo sistema financeiro completo.

Campos essenciais:

- Identificador, tipo, valor, base de cálculo e regra/taxa usada.
- Destino: hospedagem **ou** título, com parcela opcional pertencente ao mesmo título; restrições no banco para impedir destinos conflitantes.
- Origem da hospedagem, quando houver, independentemente de quem controla a cobrança atual.
- Política/versionamento, data de referência, intervalo de incidência e chave única de aplicação.
- Executor, data/hora, motivo, operação idempotente e eventual autorização.

Adicionar `BillingChargeEvent` para aplicação, dispensa, reversão e migração de responsabilidade. Preservar eventos em vez de apagar encargos. A dispensa pode ser registrada mesmo antes de haver lançamento monetário, guardando o valor estimado e o intervalo dispensado.

Diárias adicionais preservam a composição noturna da hospedagem e ganham referência ao período tratado. Não duplicá-las como encargo financeiro.

Ao transferir saldo de hospedagem para título empresarial, registrar a transferência dos componentes ainda abertos na mesma transação. O principal do título recebe somente o saldo de diárias e consumos; os encargos continuam componentes separados. Não incluí-los no principal e somá-los novamente pelo registro de encargos. Um encargo tem um único destino financeiro exigível por vez. O extrato da hospedagem pode mostrá-lo como transferido; não somá-lo novamente à dívida.

Estender a alocação dos recebimentos com principal/multa/juros/taxa e referências aos encargos. Reutilizar `PaymentAllocation`, `StayPayment` e o movimento financeiro existente, sem criar um novo recebimento para cada representação do mesmo dinheiro.

Dispensar encargo já recebido exige primeiro estorno ou tratamento de crédito autorizado; não reduzir saldo pago por edição. Valor dispensado não gera dinheiro, movimentação bancária ou desconto no principal.

## 7. Permissões

| Poder | Permissão proposta | Concessão inicial |
| --- | --- | --- |
| Consultar prévia | Consulta da hospedagem/título correspondente | Conforme os acessos existentes. |
| Aplicar regra configurada | `billing.charges.apply` | Administrador e supervisor. |
| Alterar valor/taxa para uma operação | `billing.charges.override` | Administrador e supervisor. |
| Dispensar encargo | `billing.charges.waive` | Administrador e supervisor. |
| Reverter encargo aplicado | `billing.charges.reverse` | Administrador e supervisor. |
| Configurar política financeira | `settings.commercial.edit` | Conforme o perfil existente. |
| Configurar saída tardia | `settings.lodging.edit` | Conforme o perfil existente. |
| Acrescentar diárias | `hospitality.extend` e acessos de consulta necessários | Preservar o modelo atual; preço excepcional continua exigindo autorização própria. |

Recepção poderá receber concessões explícitas pelo administrador. Quem pode receber dinheiro não ganha automaticamente o poder de aplicar, alterar ou dispensar encargos. Perfis personalizados permanecem sem novas concessões automáticas.

Revalidar todos os poderes no servidor, inclusive ao recuperar recibos idempotentes. Exigir motivo em dispensa, alteração e reversão. Não criar nesta entrega outro mecanismo de senha de supervisor; usar sessão autorizada e a infraestrutura existente onde aplicável.

## 8. Interface e operação diária

- **Configurações:** incluir os campos nas duas seções existentes, sem uma nova aba principal.
- **Quarto atrasado:** atalho contextual **Resolver atraso** em Mais ações e chamada dentro do atendimento/check-out. Escolhas: diárias adicionais, taxa ou dispensa; mostrar apenas as autorizadas e explicar bloqueios relevantes.
- **Título vencido:** área **Encargos por atraso** no recebimento, inicialmente recolhida ao resumo principal/multa/juros/total. Com política aplicável ativa e valores sugeridos positivos não tratados, exigir uma decisão de quem tem permissão antes de confirmar uma quitação como total. Política desativada ou cálculo zero não cria pendência de decisão nem bloqueia o recebimento.
- **Recepção sem poderes:** pode fazer recebimento parcial do principal; não pode encerrar integralmente a cobrança ou o tratamento operacional omitindo uma decisão pendente de encargos. Informar o encaminhamento ao supervisor, sem registrar um encargo automaticamente.
- **Dispensa:** escolher multa, juros ou ambos e informar motivo. Para juros, mostrar até qual data a dispensa vale. Futuro atraso permanece sujeito à revisão.
- **Extrato e recibo:** mostrar componentes separados e o responsável original, empresa ou pessoa, sem modificar vínculos cadastrais.
- **Cartões mobile:** manter somente o resumo e os atalhos atuais. Resolver detalhes no atendimento.

## 9. Segurança transacional e coerência

- Operações explícitas de prévia, aplicação, dispensa e reversão; aplicação e recebimento podem ser confirmados em uma única operação transacional.
- Assinatura da prévia inclui versão da obrigação/política, pagador, vencimento, intervalo, bases e componentes. Se qualquer dado mudar, exigir revisão.
- Isolamento serializável, controle de versão e chave idempotente existentes; índices únicos para multa e intervalos evitam duplicação entre solicitações diferentes.
- Todas as telas de saldo, relatórios, cobrança, lembretes, backup/exportação e restauração devem entender os novos componentes.
- Só dinheiro efetivamente recebido entra no caixa. Cobrança aplicada e ainda não recebida permanece no contas a receber; dispensa não aparece como saída de caixa.
- A sincronização avisa outras sessões após confirmação. Não criar encargos em um worker de notificações.

## 10. Ordem de implementação e commits

1. **Domínio e esquema:** política tipada, encargos/eventos, intervalos, alocação, invariantes e cálculo Decimal. Inicializar com política desativada e atualizar a carga de exemplos para a modelagem atual, sem rotinas de conversão de dados históricos.
2. **Servidor financeiro:** prévia e comandos, permissões, pagamentos parciais/parcelas/lotes, idempotência, estornos e ponte hospedagem/título. Validar em PostgreSQL isolado.
3. **Saída atrasada:** atendimento único e distinção entre prorrogar e faturar permanência já utilizada; diárias, taxa e dispensa sem afetar futuras reservas indevidamente.
4. **Configurações e recebimento:** campos, revisão de encargos, motivos e mensagens de acesso; espelhar regras no ambiente demonstrativo.
5. **Conferência final:** extratos, relatórios, notificações, importação/exportação, restauração, fluxo mobile e documentação. Preparar atualização com backup.

Cada etapa deve ter testes próprios e commit separado. Não deixar telas de aplicação habilitadas enquanto cálculo, autorização e persistência ainda estiverem incompletos.

## 11. Critérios de aceite

- Vencimento hoje: nenhum encargo; atraso de saída sem dívida vencida: nenhum juro financeiro.
- Carência e virada de dia corretas, independentemente do relógio/fuso do dispositivo.
- Exemplo de R$ 1.030 reproduzível; taxas fixas e percentuais e valores zero validados.
- Pagamento parcial reduz somente a base futura correspondente; multa não se repete.
- Duas sessões e reenvios produzem um único encargo e um único recebimento.
- Dispensa exige permissão/motivo, preserva principal e não movimenta caixa; juros futuros respeitam o limite temporal da dispensa.
- Parcelas vencidas e não vencidas tratadas separadamente; lote equivale às mesmas operações individuais.
- Diárias adicionais preservam preços anteriores e não duplicam períodos; saída imediata não cria uma ocupação futura.
- Taxa e diárias não cobram o mesmo atraso duas vezes; conflitos de reserva são explicitados.
- Cobrança empresarial preserva pagador e não duplica saldo entre hospedagem e título.
- Reversão e restauração recompõem corretamente componentes, períodos, permissões e trilha de auditoria.
- Aplicação e demo apresentam os mesmos valores e decisões; interface mobile mantém o mapa compacto.

## 12. Fora desta entrega

Juros compostos, cobrança bancária automática, integração com boletos, emissão fiscal, acordos financeiros complexos e vencimentos fracionados por diária durante hospedagem ativa. Não são necessários para entregar o fluxo solicitado com manutenção viável.
