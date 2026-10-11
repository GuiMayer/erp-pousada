# Entrega da Sprint 6 — fechamento dos requisitos

**Data:** 11/10/2026 · **Escopo:** pousada e bebidas · **Revisão:** [PR #11](https://github.com/GuiMayer/erp-pousada/pull/11).

As oito lacunas identificadas depois da S5 receberam implementação e testes. O método de custo foi alinhado deliberadamente na modelagem. Esta é uma entrega técnica; instalação atualizada, homologação com o cliente e recuperação no equipamento final continuam sendo etapas operacionais.

## O que mudou e onde usar

| Requisito | Entrega | Caminho |
| --- | --- | --- |
| CAD-02 | Busca por nome, documento e ambos os telefones, com ou sem máscara; sem mesclar pessoas. | Pessoas e seletor de cliente. |
| CAD-07 | Ficha consultada no servidor: hospedagens, títulos, parcelas, recebimentos/estornos e crédito próprio. Saldos descontam liquidações parciais. | Abra a ficha da pessoa/empresa. |
| PDV-01 | Carrinho considera estoque utilizável. Saldo desconhecido pede atualização; serviço sem controle não exige estoque. | Frente de Caixa. |
| FIN-12 | Projeção diária, horizonte de 1–90 dias, contas selecionadas e caixa aberto opcional, com exportação e origens. | Relatórios → Financeiro → Consultar projeção. |
| EST-09 | Alerta leva ao lote/produto correspondente, remove filtros que o esconderiam e destaca/foca o registro. Alertas antigos continuam abrindo a aba. | Central de notificações → Abrir registro. |
| PRE-06 | Recebimento de compra informa custo anterior/novo por unidade-base e sugere revisar o preço. Não muda o preço de venda. | Estoque → Receber compra. |
| QUA-18 | Consulta CNPJ com cache limitado, data da consulta e atualização explícita. Mantém autorização, limite, timeout, confirmação e cadastro manual. | Cadastro da empresa → Consulta CNPJ. |
| QUA-19 | Importação CSV com modelos, prévia, rejeições, confirmação explícita, revalidação, transação e recibo contra repetição. | Administração → Importação inicial com conferência. |

## Números e critérios

- **Dívida:** título de R$ 600 com R$ 250 liquidados mostra R$ 350 pendentes. Parcelas não são somadas novamente ao título. Crédito aplicado pode liquidar dívida, mas não é recebimento de dinheiro.
- **Recebimento compartilhado:** movimento de R$ 350 aplicado a duas pessoas (R$ 250/R$ 100) mostra R$ 250 na primeira ficha, com o total do movimento separado nos detalhes. A reversão preserva vínculo ao movimento original.
- **Vínculo empresarial:** funcionário, empresa pagadora e crédito pessoal continuam identidades/posições diferentes. Mudar empregador não transfere crédito nem muda o pagador de documentos anteriores.
- **Estoque:** físico 10, utilizável 4: carrinho anuncia 4 e recusa inclusão de cinco. O servidor mantém a autoridade transacional/FEFO para disponibilidade que mudou depois da consulta.
- **Custo:** consumo usa o custo histórico dos lotes alocados. Dez unidades a R$ 5 e dez a R$ 10, retirando as primeiras dez, deixam valor R$ 100 e média do saldo físico R$ 10. Essa média não reavalia vendas/perdas antigas.
- **Preço:** fardo de 12 a R$ 60 e depois R$ 72 compara R$ 5 com R$ 6 por unidade, não R$ 60 com o preço unitário. Sem custo anterior comparável, mostra anterior não conhecido; não inventa margem/percentual.
- **Projeção:** base R$ 1.000 + recebíveis R$ 200 − pagáveis R$ 300 = R$ 900 no dia. Pagamento previsto de R$ 100 no dia seguinte deixa R$ 800. Vencidos não são automaticamente recebidos/pagos hoje.
- **Reservas:** valor restante de reservas confirmadas sem título é cenário separado. Reserva com título de hospedagem já representado não entra duas vezes. Não altera base ou saldo financeiro projetado. Saída planejada ultrapassada fica sem previsão definida.
- **Caixa/cartão:** somente turno aberto é incluído por opção; fundos encerrados não entram. Saldos são internos, não confirmação de disponibilidade bancária nem de repasse de cartão.

## Importação inicial

1. Use o banco de demonstração ou uma cópia restaurada para ensaiar; faça backup antes da implantação real.
2. Baixe o modelo na própria tela. CSV UTF-8, separador `;`, no máximo **100 registros e 128 KB**. Preserve telefones/documentos como texto na planilha e use decimal sem separador de milhar.
3. Importe pessoas/empresas e catálogo antes dos lotes. Categorias devem existir. Empresa pode aparecer no mesmo arquivo que seus funcionários, em qualquer ordem; a confirmação cria primeiro a empresa.
4. Confira a prévia. Igual é ignorado; conflito não sobrescreve. Corrija todas as rejeições e consulte novamente. Não há confirmação parcial silenciosa.
5. Marque a revisão e confirme. Prévia vale 30 minutos. Estado, identidade, unidade e versões dos cadastros relacionados, além das permissões, são conferidos novamente; conflito novo exige nova revisão. Nova revisão recebe outro identificador: uma prévia antiga não pode aprovar os dados revisados. Um erro desfaz o conjunto.
6. Se a resposta se perder, repita a confirmação da mesma prévia. O recibo retorna o resultado sem adicionar os registros novamente. Reenviar o mesmo conteúdo, inclusive reordenado, não soma outra abertura.

### Campos

| Modelo | Campos e regras |
| --- | --- |
| Pessoas | `nome;documento;papeis;telefone;email;empresa`. Papéis `hospede\|pagador\|fornecedor`; documento válido obrigatório neste importador. Hóspede usa CPF; vínculo empresarial usa CNPJ de empresa ativa/pagadora. Cadastro manual mantém suas regras próprias. |
| Produtos | `nome;categoria;unidade;preco;codigo_barras;controla_estoque;exige_validade`. Unidade `un`, `ml` ou `l`; booleanos `sim`/`não`; categoria da pousada existente. Preço não vem de fornecedor automaticamente. |
| Abertura | `produto;codigo_barras;quantidade;lote;validade;custo_total;custo_estimado;motivo`. Nome único ou código de barras identifica produto; quantidade na unidade-base; validade `AAAA-MM-DD` quando exigida; custo total informado e estimativa explícita. |

Nome e código de barras que apontem ao mesmo produto/lote não permitem duas linhas de abertura. Lote de abertura já registrado bloqueia nova abertura com arquivo alterado. Correção de saldo confirmado segue os comandos de estoque, preservando as origens; não apaga histórico.

Tarifas, créditos, saldos financeiros, usuários/senhas e histórico operacional arbitrário não entram pelo importador. Restauração de snapshot é outro fluxo, com permissão própria. O backup completo do PostgreSQL conserva os recibos; restauração portátil substitui o estado operacional e invalida os recibos de importação anteriores. Os próprios cadastros/lotes restaurados continuam impedindo duplicação.

## Arquitetura e acesso

O monólito e PostgreSQL permanecem. Ficha/projeção usam consultas no servidor com snapshot consistente; históricos são paginados, com limites explícitos. Frontend não calcula saldo copiando o banco inteiro. Comandos anteriores, versões, sincronização, auditoria e idempotência continuam em uso.

Importação tem `data.import`, inicialmente do administrador, e exige também permissões de leitura/criação/abertura dos respectivos dados. Isso não concede restauração ou gestão de usuários. Confirmação busca usuário/sessão/permissões atuais. As novas APIs exigem sessão; escrita verifica a origem. Ficha omite seções e valores sem permissão, com mensagem de indisponibilidade. Origem de hospedagem só acompanha título quando há leitura de hospedagem.

Cache CNPJ: memória do servidor, 24 horas, até 1.000 sugestões válidas, consultas simultâneas coalescidas. Reiniciar limpa o cache; falhas não são armazenadas. A sugestão nunca salva cadastro automaticamente.

Migration aditiva `20261011020000_sprint6_initial_import` cria recibos/prévias de importação e índice de ocupantes por pessoa. Não converte saldos/custos existentes. Prévia contém dados necessários à revisão; confirmação remove o payload pessoal. Prévias expiradas são limpas na próxima solicitação de prévia, não por um serviço novo.

## Validação e limites da evidência

Regressão: **354 testes unitários** (incluindo seis de interface S6) e **188 de integração**. Os novos testes cobrem dívida parcial, origem/escopo de recebimento compartilhado, projeção e vencidos/parcelas, reservas/caixa, custo por lote, orientação de preço, destino de alerta, importação/vínculos/deduplicação/repetição/conflito/revogação/expiração/restauração e acesso às novas APIs. Interface testa rejeição, confirmação revisada, resposta perdida/reenvio, troca de usuário, seção indisponível e preservação do horizonte após falha e dia operacional dos recebimentos na virada UTC.

O CI deve aprovar tipos, lint, unitários, PostgreSQL isolado, migrações, build, auditoria de dependências, imagem, instalação com contas restritas, demonstração isolada, backup/restore e painel Windows antes da incorporação. Resultados da versão exata ficam nos [checks do PR #11](https://github.com/GuiMayer/erp-pousada/pull/11/checks).

Inspeção com componentes reais e respostas fictícias, sem banco operacional: importação (rejeição impede confirmar; igual é ignorado; confirmação revisada), ficha parcial e projeção/origem em desktop e largura de 390 px. Controles inspecionados têm 44 px, sem rolagem horizontal essencial. A rota temporária usada para inspeção foi removida da entrega. Isso não substitui os cenários AP-33 em aparelho/rede reais, contraste/foco de todas as telas ou falha de rede integral.

Não se iniciou/reiniciou Docker/WSL local nem se alterou banco operacional. Ensaio PostgreSQL/containers ocorre no ambiente isolado do CI.

## Atualização e demonstração

O painel continua servindo para ligar/desligar e obter o link. Após atualizar o código, a imagem precisa ser reconstruída e a migration aplicada pelo procedimento de atualização do guia Docker; simplesmente iniciar um container antigo não atualiza sua versão. Faça backup pelo painel antes da atualização normal. Use a demonstração para experimentar a importação. Não confirme CSV de exemplo no banco normal.

Sem alterar credenciais ou apagar volumes, `scripts/start-docker.ps1` reconstrói a instalação normal e usa o serviço de migração previsto no Compose. Faça isso na janela de atualização combinada; não foi executado neste desenvolvimento. Depois, o uso diário continua pelo painel da área de trabalho. Tailscale permanece opção externa de acesso.

## Homologação pendente

- AP-33/QUA-08/11/12: ciclo completo no celular, teclado/foco, perda de rede/resposta, reenvio e mudança de permissão com rascunhos.
- QUA-07/09/13/20: cinco contas reais, volume representativo e p95 no computador final, rede local sem internet, inicialização/reinício/atualização.
- QUA-14/15/17: restauração de backup real em máquina separada, segunda cópia/retenção conferidas; confirmar RPO/RTO e prazo de retenção de dados pessoais com o responsável.
- Conferir preços, saldos de abertura, políticas e dados reais com o cliente. Aprovação técnica não declara a instalação atual como produção homologada.

COM-05, PDV-07, FIN-05/10/11 e restaurante continuam fora do escopo desta entrega. Nenhum requisito foi removido para fechar a sprint.
