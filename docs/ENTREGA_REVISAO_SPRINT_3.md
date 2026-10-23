# Entrega — Sprint 3 da revisão de usabilidade

**Data:** 22/10/2026. Revisão de atendimento rápido sobre as sprints 1 e 2. Implementação e testes técnicos entregues; homologação com a recepção e matriz visual completa continuam pendentes, explicitamente separadas do resultado técnico.

## Funcionalidades

- Reservas contém somente chegadas pendentes. Pesquisa por hóspede, nome da empresa pagadora, quarto, referência de reserva e referência do grupo, sem distinguir maiúsculas ou acentos; palavras da busca são combinadas.
- Filtros de chegada: todas, hoje, amanhã até os próximos sete dias e chegada pendente em atraso. Intervalo de entrada inclusivo, com validação. Filtros se combinam; limpar restaura a lista. Não há filtro para trazer hospedagens ou cancelamentos do Histórico.
- Paginação de **25 atendimentos por página**, após identificar as reservas correspondentes. Um grupo nunca é dividido entre páginas. Busca/período mudam a página para o início; sincronização ajusta uma página que deixou de existir. Filtros e página são guardados na sessão do operador ao trocar de módulo.
- Se apenas parte de um grupo corresponder ao filtro, a linha mostra o grupo inteiro e informa quantos e quais quartos correspondem. Ao abrir, cada quarto mantém suas ações e a indicação de estar fora do filtro, sem ocultar integrantes silenciosamente.
- Check-in e Receber permanecem diretos. Check-in usa nome acessível com hóspede/quarto; editar, desconto, cancelamento e ausência ficam nas ações secundárias já existentes. As permissões continuam controlando leitura e alteração. Pagador, referência, total/recebido/saldo e chegada em atraso ficam identificados.
- Contato aparece nos detalhes individuais e nos quartos do grupo, usando a pessoa vinculada ao hóspede por identidade/documento. Nunca usa automaticamente o telefone da empresa pagadora. Dados de contato exigem customers.read. Telefone opcional; número válido oferece WhatsApp e cópia; número incompleto permite copiar e orienta a revisão. Falha de clipboard mostra alternativa de seleção do texto.
- DDD brasileiro assume +55; internacional precisa de +DDI explícito (também aceitamos 55 + número brasileiro completo). O DDI é mostrado antes do clique. A validação usa metadados completos de libphonenumber-js, sem tentar extrair telefones de frases ou aceitar ramais como destino. Link externo é explícito, sem texto de mensagem, sem envio automático e sem serviço pago.
- Demonstração contém telefones fictícios da faixa reservada NANPA 555-0100 a 555-0199, e também pessoas sem telefone. Não foram enviados avisos ou mensagens durante os testes. Dados de clientes não são reescritos por esta revisão.

A consulta usa o conjunto autorizado já carregado pelo aplicativo, com seletor puro compartilhado entre UI e testes; não introduz consulta financeira paralela ou dependência de um serviço externo. O servidor PostgreSQL continua sendo a autoridade para escrita e concorrência. Não houve migração de esquema nem mudança das políticas comerciais.

## Comparação com a interface anterior

| Uso | Antes (855a3bb) | Depois |
| --- | --- | --- |
| Encontrar reserva entre 200 | Lista inteira; percorrer linhas, sem busca ou filtros. | Buscar referência/nome/quarto/empresa e abrir resultado. |
| Quantidade de linhas renderizadas, cenário de 200 atendimentos individuais | 200, além do cabeçalho. | Até 25, além do cabeçalho; resultado único ocupa uma linha. |
| Grupo com datas ou quartos diferentes | Contexto íntegro, mas sem busca. | Contexto íntegro mesmo quando só um integrante corresponde, com aviso explícito. |
| Entrada com reserva | Botão direto + confirmar entrada, sem redigitar identidade. | Mesmo fluxo de duas ações, com contexto acessível do quarto. |
| Receber, lançar bebida, quitar e fechar caixa | Controles financeiros e confirmações já existentes. | Etapas preservadas; revisão não adiciona confirmação ao atendimento. |
| WhatsApp | Sem acesso contextual. | Abrir detalhes e clicar no contato válido; nenhum envio automático. |

Não foi medido tempo humano de atendimento antes/depois; não há alegação de redução percentual de tempo ou cliques de toda a rotina. Os testes de interação asseguram o caminho de duas ações do check-in e a identidade individual dos quartos, mas não substituem observação da recepção.

## Medição reproduzível

Executar `pnpm exec tsx scripts/measure-reservation-worklist.ts`. O script não conecta ao banco nem escreve dados; usa 200 reservas fictícias com nomes longos, aquece os seletores e registra mediana/p95 de 100 execuções.

Resultado nesta máquina: seletor original sem filtro **2,263 / 3,820 ms** (mediana/p95); consulta paginada completa **3,322 / 4,743 ms**; busca de referência **3,191 / 4,813 ms**. A filtragem acrescenta cerca de um milissegundo ao seletor neste ensaio e permite limitar a renderização; esses tempos não incluem rede, renderização ou operação humana. Não existe limite temporal rígido de CI baseado nesses números.

O teste de interface com 200 reservas verifica o limite de linhas e abre a reserva correta após busca. O teste de consulta percorre 200 reservas agrupadas, confere ausência de grupos duplicados/perdidos e ajusta paginação após redução do conjunto.

## Integridade, permissões e exceções

A nova jornada de integração executa abertura com fundo 100, reserva de 200 com sinal PIX 50, venda de duas águas de 12 na ficha, recebimento parcial concorrente de 100 (PIX 60 + dinheiro 40), quitação PIX 74, check-out e fechamento. Resultado: estoque 10 → 8, receita total 224, saldo bancário 184 e caixa físico 140 sem diferença. Repetição da venda, quitação e saída com a mesma chave não duplica efeitos. Duas sessões recebendo com a mesma versão produzem somente um vencedor.

Outro cenário fecha o caixa após preparar o pagamento: recebimento em dinheiro é recusado sem criar pagamento/transação; reabrir o caixa permite reenviar a mesma operação. As demais suítes conferem recepção/caixa/administrador e permissões individuais, empresa vinculada versus pagamento particular, reserva futura, retroativo autorizado, cancelamento com ou sem sinal/motivo, retenção/reembolso, estoque concorrente e sincronização.

A regressão também encontrou uma expectativa de teste que comparava o dia UTC do instante de registro com o dia comercial de Brasília. A expectativa passou a verificar o dia comercial, preservando o instante UTC do aplicativo.

## Validação e aceite

- **490 testes unitários/interface em 81 arquivos aprovados**; tipos, lint sem avisos e compilação de produção aprovados. Resultados registrados nos logs locais da execução final.
- **122 testes de integração em oito arquivos aprovados**, usando somente erp_test isolado. PostgreSQL de testes desligado ao término; banco operacional não foi usado.
- Dependências de produção: auditoria sem alertas após adicionar a biblioteca de telefones. O alerta de desenvolvimento em braces descrito no [registro de segurança](SEGURANCA_DEPENDENCIAS.md) não foi ocultado.
- Roteiro completo de cliques, preenchimentos, tempo, interrupções, concorrência e conferência visual: [homologação da rotina diária](HOMOLOGACAO_ROTINA_DIARIA.md). Campos humanos e aceite da recepção permanecem em aberto. A ferramenta de navegador havia bloqueado acesso nesta sessão; não houve tentativa de contornar a política nem alegação de novas capturas ou zoom real validado.
- Não houve push/deploy. Restaurante permanece arquivado; vendas operacionais permanecem limitadas a bebidas. A alteração anterior de next-env.d.ts foi preservada.

Logs ignorados em .local: s3-baseline-volume.log, s3-reservations-benchmark.json, s3-worklist-tests.log, s3-company-regression.log, s3-full-acceptance.log, s3-integration-tests.log, s3-final-types.log, s3-final-lint.log, s3-build.log e s3-security-prod.json.

Referências: [documentação da biblioteca de telefones](https://github.com/catamphetamine/libphonenumber-js), [faixa fictícia NANPA](https://nanpa.com/numbering/555-line-numbers).
