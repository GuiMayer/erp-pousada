# Sprint 1 — Cadastros e preços da pousada

**Data:** 09/10/2026 · **Escopo:** [Sprint 1](SPRINTS_POUSADA.md#s1--base-cadastral-e-preços).

A implementação entrega pessoas e empresas, fornecedores, bebidas, capacidade dos quartos e tarifas por pessoa/noite. A aba **Cadastros** reúne essas funções e respeita o acesso de cada usuário. Restaurante permanece arquivado. O financeiro empresarial após o check-out, compras e lotes continuam nas sprints seguintes.

## Como apresentar o protótipo

Abra o atalho **ERP Pousada - Servidores** na área de trabalho e clique em **Iniciar** na coluna **Demonstração**. O painel atualiza a imagem, restaura os exemplos e prepara o link privado pelo Tailscale; aguarde o estado **Pronto** e use **Abrir site** ou **Copiar link**. Após atualizar o código do painel, feche e abra o painel novamente para carregar a mudança.

Como alternativa, na pasta do projeto, com o motor Docker funcionando, execute:

```powershell
.\scripts\start-demo.ps1
```

Esse comando reconstrói a imagem e recria **somente o banco temporário de demonstração**. As alterações da apresentação anterior são descartadas. Nesta primeira atualização, não use `-NoBuild`: ele reaproveitaria a versão anterior da aplicação. O endereço privado já definido na demonstração é preservado; Tailscale continua sendo uma opção externa da instalação.

Entre com usuário **teste** e senha **teste**, salvo se a senha exclusiva de demonstração tiver sido alterada. Acesse **Cadastros → Quartos e tarifas**. Há categorias casal, triplo e suíte, com capacidades explícitas e tarifas fictícias. Para um quarto casal, simule uma noite:

| Ocupação | Preço por pessoa/noite | Total |
| --- | --- | --- |
| Uma pessoa | R$ 120 | R$ 120 |
| Duas pessoas | R$ 100 | R$ 200 |

Depois, busque uma pessoa em **Pessoas e empresas**, confira seus papéis e veja uma bebida com seu preço padrão. Na reserva ou entrada, selecione o hóspede e quem paga. A empresa pode ser pagadora mesmo sem ser hóspede. A prévia mostra cada noite; a confirmação recalcula no servidor.

Para encerrar a apresentação e descartar suas alterações:

```powershell
.\scripts\stop-demo.ps1
```

## Decisões implementadas

| Área | Comportamento |
| --- | --- |
| Identidade | `Customer.id` identifica a pessoa/empresa de forma estável. Papéis `guest`, `payer` e `supplier` pertencem ao mesmo cadastro. Cadastro rápido e completo usam essa identidade. |
| Documento | CPF/CNPJ normalizado e único quando informado, inclusive em gravação direta no banco. CNPJ alfanumérico é validado com os dígitos verificadores. Fornecedor pode ser cadastrado sem documento; hóspede exige CPF e pagador exige documento. |
| Fornecedor | Reaproveita a pessoa pelo documento, sem duplicá-la. Nome/contato/situação são compartilhados; condições comerciais continuam na ficha de fornecedor. Não há união automática por nome. |
| Consulta de CNPJ | Consulta opcional à BrasilAPI, com prévia e confirmação antes de preencher. Falha ou indisponibilidade permite cadastro manual. Consulta não salva o cadastro nem executa função fiscal. |
| Bebida | Nome, categoria existente, unidade `un`, `ml` ou `l`, preço padrão positivo, barcode opcional único, situação e controle de estoque. Inativação retira das novas vendas/consumos e preserva o cadastro histórico. |
| Unidade com estoque | Unidade base existente é herdada na migração quando reconhecida. Não pode ser alterada pela ficha da bebida depois de vinculada a estoque. Conversões de compra ficam em S4. |
| Quarto | Capacidade explícita entre 1 e 100 pessoas. A categoria usa o cadastro de tipo já existente, sem criar uma segunda classificação. Redução de capacidade não pode contrariar reserva ativa com ocupação conhecida. |
| Tarifa | Faixa de pessoas, vigência inclusiva e preço por pessoa/noite; escopo por categoria ou por quarto. Regra específica do quarto prevalece sobre a categoria. Faixas/vigências conflitantes no mesmo escopo são recusadas, também sob concorrência. |
| Cálculo | Entrada inclusiva, saída sem diária, entre 1 e 366 noites por simulação. Soma em centavos, quantidade multiplicada pelo preço de cada noite. Sem tarifa ou acima da capacidade, há erro explícito. |
| Preço acordado | Reserva guarda ocupação, pagador e composição por noite, com identificação/versão da tarifa. Alterar tarifa não modifica reserva confirmada. Check-in mantém o preço confirmado. |
| Exceção | Nova hospedagem com valor excepcional exige `lodgingTariffs.override` e motivo. A permissão é distinta do limite de desconto, e o valor acordado fica registrado. Recepção usa tarifas, sem conceder essa exceção. |
| Histórico | Inativar pessoa, fornecedor, bebida ou tarifa não apaga suas referências. Nome atual é compartilhado no cadastro; valores e registros operacionais anteriores não são recalculados. |

As mutações de produção continuam transacionais, com autorização no servidor, auditoria, versão de registro e sincronização já existentes. A camada de exemplos do navegador é exclusiva do modo explícito `demo-localStorage`; não substitui PostgreSQL no uso compartilhado.

## Migração e ativação operacional

A migration `20261009000000_sprint1_contacts_tariffs` é aditiva e transacional. Antes de alterar as tabelas, verifica documentos duplicados normalizados em pessoas, hóspedes e fornecedores e códigos de barras duplicados. Se encontrar duplicidade, interrompe a atualização para revisão; não elimina registros nem escolhe automaticamente qual saldo conservar.

Os IDs existentes de clientes e fornecedores são preservados. `GuestProfile.cpf` continua como chave de compatibilidade das reservas e créditos antigos, ligado à identidade estável por `customerId`. Corrigir o documento da pessoa não transfere crédito nem recria o histórico. Na migração, registros com o mesmo documento normalizado são vinculados; registros sem documento mantêm identidade própria. Nome sozinho nunca define correspondência.

Capacidades, ocupações, pagadores e composições de preços ausentes nos registros antigos ficam desconhecidos, em vez de receber números inventados. Reservas antigas conservam seu valor e podem entrar pelo fluxo confirmado. Antes de cadastrar novas hospedagens com tarifa, configure **capacidades e tarifas**. Alterar datas ou preço de uma reserva antiga deve ser uma decisão explícita, respeitando as permissões existentes.

Para atualizar uma instalação operacional, faça e confira o backup conforme o [guia de instalação](INSTALACAO_POUSADA.md), teste a atualização em cópia e execute o fluxo de atualização existente:

```powershell
.\scripts\start-docker.ps1
```

O serviço de migração usa suas credenciais próprias antes da aplicação. Uma falha de pré-verificação precisa ser resolvida antes de liberar atendimento; mantenha a cópia de backup para recuperação. A execução desta sprint validou a migration em PostgreSQL isolado, incluindo dados legados. **Não foi aplicada ao banco operacional nem reconstruída a demonstração em uso durante o desenvolvimento.**

## Validação e limites

Foram aprovados 280 testes unitários e 104 testes de integração da suíte completa, incluindo a carga demonstrativa. Também passaram verificação de tipos, lint e compilação de produção. Os testes de interação cobrem simulação, alteração de ocupação, capacidade, edição versionada de tarifa, confirmação de preenchimento de CNPJ e acesso à aba Cadastros em navegação mobile.

| Critério da modelagem | Evidência nesta entrega |
| --- | --- |
| AP-01 | Documento normalizado único e reutilização da identidade como fornecedor, com proteção no banco. |
| AP-02 | CNPJ numérico/alfanumérico, resposta externa conferida, prévia e caminho manual. Serviço externo simulado nos testes; disponibilidade real depende da BrasilAPI. |
| AP-03 | Uma pessoa a R$ 120; duas a R$ 100 cada; soma em centavos e vigências por noite. |
| AP-04 | Parcela de diárias calculada e preservada. Extrato integrado com bebidas, sinal e cobrança final depende de S2/S3; o cenário completo não está concluído. |
| AP-05 | Reajuste de tarifa não muda reserva ou valor do check-in. |
| AP-06 | Capacidade, precedência por quarto, ausência/ambiguidade e tarifas concorrentes verificadas. |

A inicialização de um servidor temporário para inspeção visual foi bloqueada pela revisão automática da sessão, sem motivo detalhado. Os testes de interação não equivalem à homologação visual em celular real; faça essa conferência no protótipo reconstruído antes da aprovação pelo cliente.

Permanecem para S2: hospedagem independente do quarto, ocupantes individuais, consumo por produto/hospedagem, troca de quarto com histórico e dívida empresarial após a saída. Apenas selecionar empresa pagadora em S1 não libera check-out com saldo. Compras, lotes, validade e conversões são S4. A modelagem completa e o módulo de restaurante arquivado continuam preservados.

Referências da consulta/validação: [documentação CNPJ da BrasilAPI](https://github.com/BrasilAPI/BrasilAPI/blob/main/pages/docs/doc/cnpj.json) e [manual de dígitos verificadores da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf).
