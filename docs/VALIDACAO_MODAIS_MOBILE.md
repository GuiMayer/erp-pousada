# Revisão dos modais no mobile

## Correções

- O modal de acessos da demonstração passou a usar a estrutura mobile com cabeçalho e conteúdo rolável. As ações ocupam a largura disponível, quebram o texto e mantêm uma área de toque de pelo menos 44 px.
- A base de diálogos e confirmações passou a usar uma coluna que pode encolher, filhos sem largura mínima intrínseca e quebra de palavras longas. No mobile, a largura respeita as margens da tela, os botões podem crescer verticalmente e títulos de diálogos comuns reservam espaço para fechar.
- A mudança de botões é restrita aos diálogos no mobile. Tabelas com rolagem própria continuam com seu comportamento.

## Verificação no navegador

Na versão local, o acesso original tinha 326 px de largura útil e 365 px de conteúdo em uma viewport de 360 px, reproduzindo o corte relatado. Após a correção, o modal e seu conteúdo mediram 358 px em 360 px e 318 px em 320 px, sem transbordamento horizontal. A borda ocupa os dois pixels restantes.

Amostras revisadas em 320 × 568: acesso da demonstração, movimentação de estoque, configuração do estoque mínimo, abertura de caixa e detalhes de bloqueio de quarto. A configuração de estoque mínimo respeitou as margens e a rolagem vertical. As outras tarefas respeitaram a largura da tela. A captura do acesso em 360 × 800 está em `.local/browser-qa/modal-demo-mobile.png`.

Foram preservados os testes de preenchimento de credenciais, login e restauração da demonstração. Os 26 casos selecionados de acesso, caixa, PDV e pagamentos passaram, assim como tipos e lint. O teste visual usa viewport emulada; não substitui homologação em aparelho físico com ampliação de fonte do Android.
