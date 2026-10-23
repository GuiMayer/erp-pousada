# Animações de navegação

Abas principais e sub-abas usam uma entrada por opacidade de 200 ms, com `ease-out`, centralizada no CSS global. O seletor usa `data-slot="tabs-content"` e `data-state="active"`, fornecidos pelo componente compartilhado de abas. Assim, voltar a um painel mantido no DOM também ativa o efeito, sem recriar seus formulários.

Seções que não usam Radix, como Configurações e as áreas da ficha da pessoa, usam `data-slot="section-content"` e a identidade da seção existente. Buscar, atualizar dados ou editar o mesmo formulário não reinicia a animação. Os painéis iniciais do Radix mantêm a supressão de animação de montagem para não acumular entradas iniciais de sub-abas e módulos.

Não adicionar `animate-fade-in` na raiz dos módulos: isso duplica o efeito do painel e depende de remontagem. A classe permanece disponível para itens adicionados ao carrinho e consumo. A navegação não usa deslocamento ou `transform`, preservando a referência de posição das barras fixas no celular. A animação não adiciona esperas, timers ou bloqueios aos controles.

`prefers-reduced-motion: reduce` desativa animações, transições e rolagem suave em qualquer largura, inclusive desktop, diálogos e pseudo-elementos. A animação dos painéis só é habilitada com `no-preference`. Não há preferência duplicada dentro do app: a escolha do sistema/navegador é respeitada.

Validação de regressão inclui retornar a um painel retido sem perder valores e navegar em sub-abas sem alterar o formulário ou seleção do módulo pai. A suíte de testes não substitui conferência visual de duração ou emulação real da preferência no navegador.
