# Frente de Caixa: desktop e mobile

## Estado da entrega

Implementação e validação automatizada concluídas. Conferência visual em navegador, medidas reais de rolagem e teste com teclado físico/virtual permanecem pendentes. Esta entrega não apresenta capturas ou tempos de operação como evidência, nem afirma ausência de rolagem medida em Full HD.

Plano: [usabilidade do PDV](PLANO_USABILIDADE_PDV.md).

## Etapas implementadas

1. **Desktop:** enquadramento específico da Frente de Caixa, largura máxima de 1800 px e altura distribuída entre cabeçalho, navegação e área de venda. O enquadramento usa o espaço restante da janela incluindo a faixa de demonstração, sem subtrair alturas fixas de cabeçalho. Ativa a partir de 80 rem de largura e 50 rem de altura; abaixo disso, conserva rolagem normal. Catálogo e carrinho têm listas independentes, cabeçalhos próprios e rodapé de pagamento. O grupo duplicado de quantidade foi removido.
2. **Catálogo mobile:** busca única por nome ou código, foco por F2 fora de diálogos, Enter somente para código exato e único. Busca textual e códigos ambíguos não adicionam produtos. Categorias ficam em faixa horizontal; cartões mostram nome, preço e quantidade selecionada. Não há categoria repetida por bebida, nem lista com altura artificial de 45dvh. O catálogo permanece no fluxo da página.
3. **Revisão e cobrança:** um único carrinho, apresentado como coluna no desktop e painel no celular. Voltar aos produtos preserva busca e itens. Quantidade digitável valida estoque; campo vazio não remove o item. Desconto geral aparece sob demanda e seu efeito continua visível no resumo. O hóspede já escolhido aparece na confirmação com Alterar, sem exigir nova seleção; Marcar na ficha continua sendo uma escolha explícita. Ações secundárias do caixa e histórico de vendas ficam em um menu no celular; abrir/fechar permanece direto conforme permissão. Falha de confirmação mantém o carrinho e sua identificação para o reenvio, inclusive ao sair e voltar à confirmação. Limpar ou concluir a venda inicia outro ciclo.
4. **Validação:** testes de seleção, revisão, estoque, reenvio, caixa e área visual do teclado; suíte completa e builds dos dois ambientes aprovados. O hook de área visual remove seus ouvintes ao desmontar e não altera o desktop.

Revisão e confirmação usam a altura visual disponível no telefone. Quando a área fica baixa, a revisão permite rolar o carrinho inteiro, para evitar itens comprimidos entre cabeçalhos e rodapés. As regras de confirmação e atualização do estoque continuam nas operações existentes: revisar, pesquisar e editar o carrinho não gravam uma venda.

## Evidências automatizadas

- 502 testes em 83 arquivos aprovados, incluindo os testes existentes de POS demonstrativo e pagamentos.
- Verificação de tipos e lint sem erros.
- Build operacional aprovado com destino isolado, sem substituir o desenvolvimento e sem conectar ao banco operacional.
- Exportação estática aprovada e verificação de recursos no caminho `/erp-pousada`, estilos compilados e nenhuma API no pacote.
- Testes específicos preservam versão da hospedagem escolhida, confirmação explícita da cobrança, pagamento sem caixa por meios permitidos e identificação do reenvio.

Os testes com área visual simulada validam os eventos e estilos produzidos pelo hook; não substituem teste do teclado real. Não foram executados novos testes de integração PostgreSQL nesta etapa; não houve mudança de esquema ou das operações de banco.

## Conferência visual pendente

Usar o mesmo roteiro em demonstração e instalação conectada, somente com dados de teste:

- 1920×900 e 1920×1080: com faixa da demo, caixa aberto e fechado, confirmar que a página inteira cabe na janela. Medir `scrollHeight` e altura visível; nomes longos, avisos de caixa antigo e erro de sincronização não podem ocultar ações.
- 100 produtos e 30 itens de carrinho: somente listas devem rolar no modo fixo; pagamento precisa continuar acessível. Verificar final da lista e foco por teclado.
- 1536×760, 1366×650 e zoom 200%: conferir fallback de rolagem sem corte nem rolagem horizontal.
- 360×800 e 390×844, retrato/paisagem e teclado aberto: buscar, adicionar, revisar, alterar quantidade, aplicar desconto, voltar e confirmar. Conferir foco de retorno, posição do catálogo e acesso ao rodapé.
- Nomes longos, estoque desconhecido/insuficiente e valores maiores; modo claro/escuro e movimento reduzido.
- Receber agora, cobrança na hospedagem, pagamentos mistos, caixa fechado e recuperação após falha. A versão escolhida deve ser respeitada e a entrega não pode baixar estoque duas vezes.

A publicação no GitHub Pages segue o CI já configurado depois que os commits forem enviados. Esta documentação não considera a homologação visual concluída apenas porque os testes automatizados passaram.
