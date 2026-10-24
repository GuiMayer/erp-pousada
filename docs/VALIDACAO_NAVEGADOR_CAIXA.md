# Validação do caixa no navegador

Validação local em 23/10/2026, usando a demonstração em `localhost:3002`. Foram usados somente exemplos descartáveis. A demonstração pública e o banco operacional não foram alterados.

## Cobertura visual e funcional

| Contexto | Validação |
| --- | --- |
| Desktop 1920 × 1080, tema claro | Contagem cega, recontagem, diferença obrigando justificativa, fechamento sem diferença e comprovante |
| Desktop 1280 × 720, tema claro | Formulário de fechamento ampliado, suprimento, sangria, retirada depositada e repasse de cartão |
| Mobile 390 × 844, tema claro | Consumo com caixa fechado, abertura pelo atalho preservando quantidade, entrega e quitação por PIX, venda com troco e cartão |
| Mobile 360 × 800, tema escuro | Pagamento dividido, permissões do operador, fechamento com diferença, histórico e conferência pelo supervisor |
| Área reduzida 360 × 480 | Rolagem do pagamento e acesso às ações de confirmação/cancelamento |

## Cenários conferidos

- Caixa fechado bloqueou novas vendas/entregas de bebidas. A quitação por PIX de consumo já existente continuou disponível.
- Abrir o caixa pela ficha preservou a quantidade de três águas. A entrega reduziu três unidades; quitar a ficha não gerou outra entrega.
- Venda de R$5 com R$10 em espécie registrou R$5 e troco de R$5. Pagamento dividido de R$5 registrou R$2 em dinheiro e R$3 em PIX.
- Suprimento de R$20 e sangria de R$5 resultaram em R$15 físicos. O fechamento retirou e depositou esses R$15 sem classificá-los como receita.
- Repasse de R$100 com taxa de R$3 reduziu o controle de cartões em R$100 e aumentou o banco em R$97.
- Uma entrega em outra aba invalidou a prévia do fechamento, preservando a contagem digitada e exigindo nova conferência.
- Diferença de -R$1 exigiu justificativa. Marcar como conferida no histórico preservou esperado de R$2, contado de R$1 e diferença de -R$1.
- Operador pôde vender, mas não movimentar, registrar repasse ou fechar o turno de outro responsável. Configurações exibiram apenas preferências pessoais.

## Problemas encontrados e corrigidos

1. O cartão do quarto exibia consumo já quitado: passou a mostrar somente o saldo pendente.
2. Consultas da demonstração regravavam fichas e podiam remover o vínculo de uma nova entrega com o turno: a leitura deixou de executar essa reconciliação. A entrega passou a aparecer no resumo do caixa.
3. Vendas após meia-noite UTC saíam do contador do dia brasileiro: a seleção passou a usar o dia comercial.
4. Rótulos comprimiam os campos em formulários: campos passaram a ocupar linhas completas; o fechamento ganhou largura no desktop.
5. Fechar um comprovante já salvo solicitava descarte de rascunho: o diálogo agora reconhece a conclusão; uma nova edição de movimentação volta a ser protegida.
6. Comprovantes sem retirada indicavam responsabilidade por uma retirada inexistente: agora informam que não houve retirada.

## Evidências e limites

Capturas locais: `.local/browser-qa/fechamento-desktop.png` e `.local/browser-qa/pagamento-mobile.png`. Testes de regressão cobrem saldo pendente, pureza da consulta da demonstração, dia comercial e fechamento de comprovante salvo.

Os tamanhos mobile são emulação de viewport, não aparelhos físicos. A área reduzida não substitui teste de teclado virtual real. A concorrência visual foi exercitada em duas abas da demonstração; dois dispositivos usando PostgreSQL e zoom nativo de 200% continuam pendentes de homologação visual. Os testes automatizados de integração PostgreSQL da entrega anterior permanecem documentados em [ENTREGA_FECHAMENTO_CAIXA.md](ENTREGA_FECHAMENTO_CAIXA.md).

Tipos, lint, build estático e verificação da exportação passaram nesta revisão. As regressões de caixa, PDV, consumo e cartão passaram. A suíte de contexto autentica usuários e grava dados de demonstração de verdade: excedeu os limites curtos de espera nas primeiras execuções. Recebeu limites de espera próprios, preservando todas as verificações e sem mudar os limites globais das outras suítes.

As preferências temporárias de viewport foram removidas e a sessão voltou ao supervisor. Não houve push nesta revisão.
