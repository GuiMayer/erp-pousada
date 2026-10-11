# Sprint 6 — fechamento dos requisitos e preparação do aceite

**Data:** 11/10/2026 · **Estado:** implementação técnica entregue; validação final nos checks do PR #11. Homologação cliente/equipamento pendente. Consulte [a entrega](ENTREGA_SPRINT_6.md).

**Base:** [conferência dos requisitos](CONFERENCIA_REQUISITOS_IMPLEMENTADOS.md), código S1–S5 e [modelagem funcional](REQUISITOS_E_MODELAGEM_ERP.md). Objetivo: fechar os seis requisitos funcionais parciais e as duas lacunas técnicas de qualidade, resolver a divergência de custo e preparar a homologação dos fluxos completos.

## Escopo e arquitetura

Manter o monólito Next.js/PostgreSQL, comandos transacionais, permissões por usuário, auditoria, versões, recibos idempotentes e sincronização existentes. Consultas agregadas e projeções ficam no servidor; componentes exibem os resultados. Evitar outra camada de saldo paralela, serviços distribuídos, Redis, filas ou geração de documentos fiscais.

Preservar o estilo desktop/mobile. Complementar as fichas e telas existentes; a importação fica na administração de dados. Uma alteração de esquema só entra quando necessária ao controle de importação ou integridade, com migration aditiva e ensaio de recuperação. Nenhuma tarefa executa escrita no banco operacional durante desenvolvimento.

**Fora desta sprint:** COM-05 (pedidos/recebimentos parciais), PDV-07 (estorno parcial), FIN-05 (agenda de cartão), FIN-10 (extrato bancário importado), FIN-11 (gerador recorrente), orçamento avançado, prazo avulso e restaurante. São condicionais/evoluções já adiadas; “restante” aqui significa o núcleo obrigatório auditado, não ativar automaticamente todo o backlog.

## Ordem de execução

### S6.1 — Fixar o critério de custo antes de ampliar os indicadores

**Decisão proposta:** conservar o custo histórico por lote já implementado na S4, com retirada FEFO e valor de consumo/perda vindo das alocações. Para bebidas com validade, aproveita a rastreabilidade atual e evita reavaliar documentos antigos ou manter dois critérios de valorização.

- Registrar essa decisão explicitamente na modelagem, em lugar da regra conflitante de custo médio de saída. Isso é uma revisão deliberada de requisito, não alegar que os dois métodos são equivalentes.
- Identificar o campo de catálogo como **média do saldo físico atual**, que pode mudar ao retirar lotes de custos diferentes. Não usá-lo para recalcular venda, perda ou devolução histórica.
- Preservar custos estimados de abertura e avisos de custo ausente. Critérios devem aparecer nas telas pertinentes, relatórios e exportações.
- Testar dois lotes de 10 unidades, a R$ 5 e R$ 10: retirar o primeiro custa R$ 50, restam R$ 100 de estoque e média atual R$ 10. Devolver mercadoria restaura a origem/custo, sem reprecificar passado.

**Saída:** código, rótulos e documento descrevem o mesmo método. Sem migração de valores antigos. Se for escolhido outro método durante revisão, tratar a mudança e reconciliação como tarefa própria antes de prosseguir.

### S6.2 — Corrigir a ficha e os resumos da pessoa

**Requisito:** CAD-07; apoio a FIN-01/02/03 e QUA-04.

- Criar consulta de ficha no servidor por ID estável, com partes autorizadas separadamente: dados cadastrais, hospedagens como ocupante/pagador, títulos, recebimentos e crédito.
- Pagamentos e títulos precisam conservar a distinção entre obrigação e dinheiro. Somar saldo remanescente válido (`valor ajustado − liquidado`) uma vez por título; parcelas não entram novamente como outros títulos.
- Exibir recebimentos parciais/integrais e reversões com origem, sem chamar crédito interno de dinheiro recebido. Evitar usar apenas o status `pago` para totalizar recebimentos.
- Crédito pessoal e crédito da empresa são posições distintas; mudar vínculo empregador não transfere saldo. Pessoa e empresa não ganham duas cópias da mesma dívida.
- Omitir dados sem acesso, com mensagem clara quando a seção estiver indisponível, em vez de apresentar zero ou “nenhum registro” como fato. API aplica a autorização mesmo na consulta direta.
- Paginar históricos, carregar apenas ao abrir a ficha e consultar por relacionamentos/indexes; não baixar o banco inteiro para montar a ficha no navegador.
- Abrir hospedagem/título de origem a partir da ficha, respeitando a permissão correspondente.

**Aceitação S6-A1:** título de R$ 600 com R$ 250 liquidados mostra R$ 350 pendentes e R$ 250 aplicados. Reversão válida restaura o saldo. Operador apenas cadastral não recebe dados financeiros na resposta. Empresa mostra dívida própria e funcionários, sem absorver crédito deles.

### S6.3 — Alinhar PDV ao estoque realmente utilizável

**Requisito:** PDV-01; preservar EST-01/03/10.

- No banco conectado, exibir e pré-validar `usableStock`; mostrar físico separadamente apenas quando útil. Usar o mesmo conceito em carrinho, inclusão/alteração de quantidade e mensagem de insuficiência.
- Extrair validação compartilhada que aceite explicitamente saldo utilizável. Saldo desconhecido não vira disponibilidade infinita nem zero apresentado como saldo confirmado.
- Catálogo sem controle de estoque mantém comportamento de serviço. Compatibilidade do modo antigo de exemplos fica explícita; não substituir um saldo utilizável conhecido pelo físico.
- Servidor continua autoridade FEFO/transacional. Mudança concorrente depois da prévia pode recusar a confirmação, atualizar saldo e preservar carrinho/identidade da operação.

**Aceitação S6-A2:** físico 10, utilizável 4 por validade/bloqueio: carrinho anuncia 4 e impede prévia de cinco. Dois usuários disputando a última unidade não geram negativo. Falha/reenvio não duplica entrega.

### S6.4 — Entregar projeção financeira com saldo base explícito

**Requisito:** FIN-12; preservar REL-01/06/07 e regras de cartão.

- Reutilizar títulos, parcelas e movimentações atuais. Criar projeção prospectiva a partir da data de negócio de hoje, por dia, com horizonte configurável e limite definido. Filtro histórico de atividade continua separado: não inventar um snapshot de previsão passada.
- Selecionar contas autorizadas e apresentar **saldo interno atual usado como base**, data da consulta, entradas/saídas previstas e saldo acumulado. Caixa só entra por inclusão explícita, sem contar fundos encerrados ou dinheiro já transferido para conta duas vezes.
- Fórmula: saldo projetado do dia = saldo projetado anterior + recebimentos previstos − pagamentos previstos. Parcela substitui o título na agenda; só saldo remanescente entra.
- Vencidos aparecem em um grupo anterior/pendente, sem presumir que serão pagos hoje. Reprogramação para uma data exige ação explícita; não mudar o título ao consultar uma previsão.
- Reservas confirmadas ainda sem título aparecem em **cenário comercial separado**, pelo valor restante acordado e data estimada de cobrança declarada. Sinal/crédito já aplicado é descontado; reserva com obrigação representada não entra outra vez. Data sem definição deve ficar “sem previsão”, não ser inventada.
- Cenário de reservas não altera dívida real, contas, resultado prestado ou dinheiro disponível. Não inclui ocupação cancelada/no-show como recebimento esperado.
- Identificar saldo interno, valores em cartão e ausência de confirmação bancária: projeção não comprova dinheiro disponível nem repasse de cartão. Não construir agenda/taxas de cartão nesta tarefa.
- Exportação conserva saldo base, horizonte, contas selecionadas, datas, saldos diários e critérios; origem e autorização permanecem verificadas no servidor.

**Aceitação S6-A3:** base R$ 1.000, receber R$ 200 e pagar R$ 300 no primeiro dia resulta em R$ 900; pagar R$ 100 no segundo resulta em R$ 800. Vencido fica separado. Reserva/título da mesma origem não duplicam previsão. Transferência própria não cria receita. Consulta não modifica nenhum saldo.

### S6.5 — Transformar alertas em acesso à tarefa correta

**Requisito:** EST-09.

- Acrescentar destino de navegação tipado: módulo, seção e identificador. Fazer a interface encaminhar o contexto à tela existente de lotes/produtos, sem disparar nenhuma alteração automaticamente.
- Validade abre o lote e suas ações autorizadas; mínimo abre o produto/reposição. Estado pendente de abertura encaminha à revisão correspondente.
- Revalidar permissão e existência ao abrir. Lote esgotado/removido ou alerta antigo oferece mensagem e retorno ao módulo. Leitura da notificação não autoriza perda, compra ou ajuste.
- Permitir destacar o registro, rolar até ele e mover foco adequadamente no desktop/mobile. Compatibilidade: notificação antiga sem destino continua abrindo o módulo.

**Aceitação S6-A4:** alerta de um lote abre esse lote, mesmo com filtros anteriores ativos. Usuário sem acesso não recebe detalhes. Abrir o alerta não baixa estoque e não resolve uma condição crítica por conta própria.

### S6.6 — Completar busca e orientação sobre preço

**Requisitos:** CAD-02 e PRE-06.

- Busca compartilhada por nome, documento e telefones, na lista e seletor rápido. Normalizar pontuação de telefone sem alterar validação de CPF/CNPJ; apresentar possíveis correspondências, sem mesclar pessoas.
- Após compra que altere o custo-base comparável, mostrar custo anterior/novo, unidade-base e sugestão de revisar preço. Embalagem não pode ser comparada diretamente ao preço de uma unidade.
- Informação de custo é autorizada; editar preço exige permissão própria. A sugestão não aumenta preço automaticamente nem altera venda/reserva confirmada.
- Custos estimados, produto gratuito e custo anterior ausente recebem tratamento explícito; não mostrar variação percentual ou margem definitiva quando indefinidas.

**Aceitação S6-A5:** telefone com/sem máscara encontra a mesma pessoa; dois telefones iguais não mesclam cadastros. Receber fardo com custo novo gera orientação por unidade, mantendo o preço vigente até edição autorizada.

### S6.7 — Adicionar cache limitado para a consulta CNPJ

**Requisito:** QUA-18.

- Cache em memória do único servidor, chave pelo CNPJ normalizado, TTL proposto de 24 horas, tamanho limitado e limpeza de expirados. Reiniciar esvazia cache; não há obrigação de persistência nem novo serviço.
- Coalescer consultas simultâneas do mesmo CNPJ; armazenar somente sugestões válidas conferidas. Falhas não viram cache prolongado de indisponibilidade.
- Autenticar/autorizar inclusive cache hit. Manter timeout/rate limit; atualização explícita também respeita o limite. Exibir data da consulta e oferecer atualização sob demanda.
- Operador continua confirmando antes de preencher/salvar. Dados cadastrais não são atualizados automaticamente. Manual funciona durante falha externa.

**Aceitação S6-A6:** duas consultas dentro do TTL usam um retorno externo; expiração/atualização autorizada consulta novamente. Usuário sem acesso é recusado mesmo se houver cache. API indisponível não impede cadastro manual.

### S6.8 — Importação inicial revisável, distinta da restauração

**Requisito:** QUA-19; preservar QUA-01/02/04/14/17.

- Entregar modelos CSV UTF-8 para pessoas/empresas/fornecedores e catálogo de bebidas. Abertura de saldo de bebidas usa importação própria, com produto, quantidade-base, lote, validade, custo e indicação de custo estimado quando aplicável; reutilizar o comando de abertura, não escrever o agregado diretamente.
- Pessoas vêm antes de vínculos empresariais; produto vem antes de lotes. Não inferir empregador, identidade por nome, validade ou saldos pessoais. Tarifas, políticas e saldos financeiros/créditos legados continuam pelos fluxos/migrações específicos já existentes, com conferência, sem importador genérico de histórico operacional.
- Prévia sem efeitos: quantidade de novos/iguais/conflitantes/rejeitados, erro por linha/campo e dependências. Validar documentos, unidade, duplicatas no arquivo/banco, relações, limites e política de validade. Disponibilizar relatório de rejeições protegido contra fórmulas de planilha.
- Registros iguais podem ser ignorados; conflito com cadastro existente exige correção/revisão e não sobrescreve automaticamente. Não fazer mescla por telefone/nome.
- Confirmar somente após a revisão. Unidades de importação pequenas, com limite de arquivo/linhas, confirmação atômica por lote e relatório final. O conjunto aprovado deve ser explícito; uma rejeição não autoriza importação parcial silenciosa.
- Registrar lote de importação com executor, hash do conteúdo, opções, resultado e recibo. Ligá-lo às origens de abertura; mesmo arquivo/conjunto aprovado reenviado não duplica saldo. Revalidar estado/permissão no servidor na confirmação; prévia expirada ou conflito novo exige outra revisão.
- Usar permissão específica de importação, inicialmente administrador, e permissões das ações importadas. Isso não concede restauração, gestão de usuários ou consulta financeira.
- Restaurar snapshot completo continua uma ação independente. Importador não recebe usuários/senhas, notificações ou movimentos arbitrários; não apaga o banco para inserir cadastros.
- Antes de usar em dados reais: backup e ensaio em cópia. Confirmação cria origens auditáveis; correção de saldo confirmado segue operações compensatórias, não remoção em cascata.

**Aceitação S6-A7:** prévia identifica CPF duplicado, empresa inexistente e lote inválido. Corrigir/revisar permite confirmar o conjunto. Repetir arquivo de abertura não soma saldo duas vezes. Falha no lote desfaz seus efeitos; pessoa sem permissão não confirma. Importar cadastro não muda registros anteriores.

### S6.9 — Conferência integrada e homologação

- Reexecutar AP-01–AP-33 e acrescentar S6-A1–A7 aos testes dirigidos. Não considerar uma contagem de testes como prova de todos os requisitos.
- Tipos, lint, unitários, PostgreSQL isolado, migrações, build, imagem/contas restritas, recuperação e painel Windows devem passar no commit final. Commits por tarefa com código/testes/documentação juntos.
- Inspecionar T01/T03/T04/T05 e nova prévia no celular, teclado/foco/44 px e ausência de rolagem horizontal essencial. Testar falha de rede, resposta incerta, reenvio, permissões alteradas e duas sessões sem perder rascunho. QUA-08/11/12 e AP-33 continuam pendentes até a evidência apropriada.
- Preparar e registrar execução no equipamento final: cinco contas distintas, volume representativo, ciclo sem internet mantendo rede local, inicialização/reinício, notificações, auditabilidade e tempo p95. Para evitar os travamentos anteriores, Docker/WSL local não é requisito para desenvolver; CI faz o ensaio isolado. Medição final usa a instalação de destino quando disponível.
- Restaurar backup real em ambiente separado, conferir usuários/permissões/origens/saldos, segunda cópia e retenção; medir recuperação da instalação completa. RPO/RTO e retenção de dados pessoais são decisões operacionais a registrar com o responsável no aceite.
- Atualizar auditoria requisito por requisito. Se houver lacuna, manter P/H com motivo, evidência e responsável; não remover requisito para encerrar a sprint.

**Aceitação S6-A8:** ciclo reserva → entrada → consumo → saída empresarial → pagamento parcial → ficha/relatórios reconcilia. Compra → alerta → venda → inventário → relatório → backup/restore conserva quantidade, custo e origens. Não há acesso financeiro indireto pelo cadastro/importação.

## Critério de conclusão

**Entrega técnica S6:** as oito lacunas da auditoria estão fechadas, método de custo alinhado deliberadamente, testes novos e regressão aprovados, documentação atualizada e versão demonstrável pelo painel. Roteiro e resultados de homologação ficam disponíveis.

**Aceite operacional:** execução com cliente/equipamento final, conferência de dados/preços/políticas, medições e recuperação aprovadas. Se equipamento/cliente não estiver disponível, registrar entrega técnica e pendências H; não declarar produção homologada.

Não há prazo em semanas presumido. Executar na ordem acima, com um conjunto de commits por tarefa; corrigir divergências encontradas nos ciclos integrados antes de fechar a entrega.
