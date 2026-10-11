# Plano — Configurações unificadas

Data: 11/10/2026. Base examinada: `63abc87`. Status: proposta de implementação; nenhuma mudança funcional nesta entrega.

## Objetivo

Substituir Configurações e Administração por um único destino **Configurações**, organizado em seções. O administrador controla quais seções cada usuário pode consultar e quais ações pode executar. Preservar o estilo atual e as regras de negócio, melhorando organização, navegação, feedback e segurança.

Não transformar configurações em outro módulo de operação: hóspedes, empresas, produtos, fornecedores e tarifas continuam em Cadastros; pagamentos e caixa continuam em Financeiro/atendimento. A auditoria permanece como módulo próprio, com eventual atalho sujeito a `auditLog.read`.

## Diagnóstico do código atual

- `components/settings-tab.tsx` reúne aparência, visualizações e preferências de notificação em uma página; `components/admin-tab.tsx` reúne informações da pousada, contato, dados empresariais, horários, políticas comerciais, regras de alertas, importação e usuários em outra página longa.
- `lib/permissions.ts` libera Configurações apenas por `systemSettings.edit`. Portanto, preferências pessoais ficam ligadas indevidamente à edição das regras da empresa. Administração usa `users.manage`, `systemSettings.edit` ou `data.import`, com verificações adicionais para criar/editar usuários.
- O formulário administrativo salva o objeto global inteiro e restaura todos os padrões. Dividi-lo visualmente sem mudar o contrato permitiria enviar campos de outras seções e sobrescrever mudanças não relacionadas.
- `UserPreferencesProvider` usa a chave global `userPreferences` no navegador: preferências de visualização podem ser compartilhadas por usuários do mesmo dispositivo. Tema também é preferência do navegador atualmente. Preferências de notificações já têm endpoint autenticado por usuário.
- Preferências pessoais de notificações e regras globais de alertas possuem o mesmo nome visual, embora tenham efeitos diferentes.
- A API de preferências de notificações autentica o usuário, mas não exige uma permissão administrativa específica para alteração pessoal. O novo controle configurável deve alcançar esse endpoint, além da interface.
- A navegação principal e a mobile mantêm dois destinos separados. Somente mudar o título de Administração não resolveria estrutura, salvamento ou autorização.

## Organização proposta

Uma navegação local por seções, apresentada como sub-abas para o usuário. Grupos são apenas títulos visuais: não exigem um clique intermediário.

| Grupo | Seção | Conteúdo e origem | Acesso proposto |
| --- | --- | --- | --- |
| Minhas preferências | Aparência e visualização | Tema, animações, métricas do mapa; SettingsTab | `settings.personal.edit` |
| Minhas preferências | Meus avisos | Tipos de avisos pessoais, notificações do navegador, estado de permissão; SettingsTab | `settings.personal.edit` |
| Pousada | Dados da pousada | Nome, contato, endereço e identificação empresarial; AdminTab | `settings.business.read` / `.edit` |
| Pousada | Hospedagem | Horários padrão de entrada e saída; AdminTab | `settings.lodging.read` / `.edit` |
| Pousada | Política comercial | Teto de desconto e campos comerciais efetivamente existentes; AdminTab | `settings.commercial.read` / `.edit` |
| Pousada | Regras de alertas | Ativação e limites globais efetivamente existentes; AdminTab | `settings.alerts.read` / `.edit` |
| Administração | Usuários e acessos | Usuários, perfil e exceções individuais; AdminTab + UserPermissionsEditor | `users.manage` e `users.read`; ações exigem também `users.create`/`users.edit` |
| Administração | Importação de dados | Importação inicial existente, com revisão e confirmação | `data.import` |

Não criar uma seção vazia de Segurança ou uma tela fictícia de backup. Backup agendado, pasta sincronizada e restauração operacional têm ferramentas próprias; podem ganhar integração futura, quando houver contrato de servidor e permissões adequados. A importação inicial não deve ser rotulada como restauração de backup.

Campos já existentes de CNPJ/razão social/inscrição estadual serão preservados em Dados da pousada. Usar “Identificação empresarial”, evitando sugerir emissão fiscal que o aplicativo não oferece.

### Desktop

- Coluna lateral local com grupos e seções, conteúdo à direita e destaque claro da seção atual.
- Cabeçalho curto com nome da seção, explicação do alcance: “Somente suas preferências” ou “Afeta toda a pousada”.
- Formulários com largura legível, campos relacionados juntos e barra de ações da seção. Não espalhar cada campo em um cartão separado.
- Busca opcional simples **Buscar configuração**, filtrando títulos e palavras-chave apenas das seções autorizadas. Sem busca remota ou indexador.
- Abrir uma seção em um clique depois de entrar em Configurações; nenhuma hierarquia além de grupo → seção.

### Mobile

- Ao abrir Configurações, mostrar lista de seções autorizadas com nome e descrição breve.
- Tocar abre a seção em largura total, com botão **Voltar às configurações**. Voltar do navegador também respeita esse caminho.
- Não usar uma fileira longa de abas horizontais cortadas ou um menu lateral permanentemente aberto.
- Barra Salvar/Descartar acessível com teclado aberto, sem cobrir campos; foco, mensagens e ações testados em 360, 390 e 768 px.
- Alvos de toque de pelo menos 44 px; rótulos completos e indicação de estado que não dependa apenas de cor.

## Controle de acesso

### Entrada e seções

1. Introduzir `settings.access` como autorização explícita para entrar no módulo. Essa permissão sozinha não libera conteúdo nem escrita.
2. A entrada principal aparece somente quando houver `settings.access` **e** pelo menos uma seção autorizada. O registro de seções aplica a mesma regra à navegação local, busca e conteúdo.
3. Configurações globais separam leitura e edição. Edição exige ambas; usuário com leitura vê os valores sem ações de alteração.
4. Permissões pessoais controlam alteração das próprias preferências; não autorizam editar preferências de terceiros. Leitura das preferências necessárias ao funcionamento pode continuar autenticada mesmo quando o menu estiver bloqueado.
5. Ao revogar acesso durante uso, interromper novas ações, retirar a seção e encaminhar à primeira seção permitida ou ao módulo permitido. Dados e rascunhos administrativos ficam fora da sessão do próximo usuário.
6. Não usar `isSupervisor`, nome do perfil ou presença do botão como autorização. Usar permissões efetivas, com exceções individuais e revogação já existentes.

### Servidor

- Criar contrato por seção para consultar/alterar configurações globais. Uma tabela central define campos aceitos e permissões; não confiar no nome da seção enviado pelo cliente.
- Escrita valida sessão, origem, autorização, esquema de dados, versão e campos permitidos antes da alteração. Rejeitar campos desconhecidos ou pertencentes a outra seção, em vez de ignorá-los silenciosamente.
- Enviar somente os campos da seção e `recordVersion`. Manter transação, auditoria e publicação de sincronização do sistema existente.
- Auditar somente alterações confirmadas, com seção, campos, antes/depois e executor; nenhuma senha ou dado secreto nos eventos. Evitar duplicar auditoria no cliente.
- Revisar também caminhos genéricos `admin-update`, CRUD de `systemSettings`, importações e restauração de padrões. Nenhum caminho alternativo pode usar uma permissão antiga para escapar do controle novo.
- `systemSettings.read`, presente nos perfis operacionais, continua atendendo dados mínimos necessários à operação. Não equipará-lo automaticamente à autorização para consultar todas as páginas de configuração. Revisar projeções genéricas de leitura e separar valores operacionais dos dados administrativos que devem ser restritos.
- Aplicar `settings.personal.edit` ao PATCH de preferências de notificações e a qualquer novo endpoint de preferências pessoais. Tema/animações locais também respeitam o controle de interface; não são uma barreira de segurança do navegador ou do computador.
- Preservar limites atuais de delegação de permissões e proteção do último administrador. Quem administra acessos não pode conceder poderes acima dos seus, inclusive as novas permissões.

### Compatibilidade e transição

- Administrador recebe as novas permissões; supervisor conserva edição global atual, mas não recebe gestão de usuários/importação por causa da fusão.
- Perfis operacionais recebem, como padrão proposto, `settings.access` + `settings.personal.edit`; o administrador pode negar qualquer uma. Isso libera preferências pessoais sem liberar regras globais.
- Perfis personalizados não ganham novas permissões automaticamente, salvo migração explícita das capacidades globais já concedidas.
- Migrar concessões individuais de `systemSettings.edit` para os grupos globais correspondentes. Negação explícita antiga deve manter a negação de edição nos grupos migrados; não perder restrições existentes. Definir e testar precedência quando já existirem overrides novos.
- Os acessos antigos de gestão de usuários e importação geram acesso ao novo destino, com suas mesmas limitações. Não conceder acesso a outras seções.
- Guardar a compatibilidade no procedimento de migração/testes, evitando um fallback permanente que torne impossível ao administrador revogar uma seção.
- Tratar `administracao` como destino legado redirecionado para Configurações e a primeira seção administrativa permitida. Remover seu botão na navegação principal/mobile; revisar todos os consumidores de `TabValue` e referências antigas.

## Comportamento dos formulários

- Preferências pessoais: salvamento automático com estado claro “Salvando”, “Salvo” ou erro; solicitar permissão de notificação somente por ação explícita. Não afirmar salvamento quando houve falha.
- Preferências de aparência/visualização: chave por usuário e instalação, validar dados armazenados, carregar antes de gravar para não sobrescrever valores na montagem. Migrar chave antiga sem compartilhar silenciosamente as preferências entre contas. Identificar que esses valores são específicos deste navegador; sincronização de tema entre dispositivos fica fora desta rodada.
- Regras da pousada: **Salvar alterações** e **Descartar** por seção, nunca um botão que grave todas as sub-abas.
- Ao sair com alteração pendente: permanecer, descartar ou salvar; falha mantém o formulário. Rascunho em memória por sessão, sem guardar dados administrativos em armazenamento persistente do navegador.
- Durante envio: impedir edição e novo envio, bloquear descarte/fechamento; resultado confirmado atualiza o baseline e a versão.
- Manter `recordVersion` global da configuração nesta fase. Edições concorrentes, mesmo em seções diferentes, podem produzir conflito: mostrar aviso, preservar rascunho e permitir carregar a versão atual para revisão. Não fazer retry cego nem misturar valores silenciosamente. Versionamento por seção só se a frequência de conflito justificar migração adicional.
- Restaurar padrões somente da seção selecionada, com autorização de edição e `settings.restore`, resumo e confirmação. Não restaurar nome/endereço da pousada indiscriminadamente nem usuários, importações ou preferências alheias. Definir explicitamente quais seções oferecem restauração e os campos afetados.
- Erros próximos aos campos, resumo acessível quando necessário e foco no primeiro erro. Formulários mantêm o padrão visual do aplicativo.

## Arquitetura de implementação

Separar apresentação, catálogo de navegação e autorização de negócio. Reutilizar APIs/componentes existentes; não adicionar biblioteca visual, serviços ou microserviços.

```text
lib/settings/sections.ts          IDs, grupos, títulos, palavras-chave, acessos
lib/settings/schemas.ts           campos e validação por seção
lib/server/settings.ts           leitura, escrita, padrões, versão e auditoria
components/settings/
  settings-shell.tsx             layout, navegação e seção autorizada
  settings-navigation.tsx        desktop + lista mobile, busca autorizada
  settings-form-actions.tsx      salvar/descartar, estado e erros
  sections/
    appearance-section.tsx
    personal-notifications-section.tsx
    business-section.tsx
    lodging-section.tsx
    commercial-section.tsx
    alert-rules-section.tsx
    users-section.tsx
    import-section.tsx
```

Os nomes são propostos, não arquivos existentes. O servidor importa apenas metadados/esquemas puros; os componentes são carregados sob demanda no cliente. Renderizar somente a seção ativa e autorizada, conservando rascunho via mecanismo de sessão já existente, sem manter todas as sub-abas executando efeitos ocultas.

Usar parâmetro de URL estável, por exemplo `?modulo=configuracoes&secao=usuarios`, sem trocar todas as rotas do aplicativo nesta tarefa. Validar IDs, autorização e estado de sessão na resolução. Voltar/Avançar funciona, link direto não contorna permissões e uma seção inválida conduz à primeira permitida. Não alterar o módulo ativo por parâmetros de URL sem passar pelo mesmo controle da navegação.

Para seções com URL e histórico, usar semântica de navegação e `aria-current`; não simular uma navegação inteira com roles de tab inadequados. Sub-abas locais reais, se necessárias futuramente, seguem o padrão acessível de tabs. Foco deve ir ao título da seção no mobile, com retorno ao item anterior ao voltar.

## Ordem de execução e entregas

1. **Contrato de acesso e migração.** Consolidar catálogo, novas permissões, perfis e overrides; testar matriz e proteção de administrador. Implementar contratos por seção e fechar os caminhos genéricos de escrita antes de expor botões novos.
2. **Estrutura de navegação.** Criar shell responsivo, seção na URL, busca autorizada e estados de acesso vazio/revogado. Unificar os destinos desktop/mobile e tratar Administração legado.
3. **Preferências pessoais.** Extrair aparência/visualização e avisos pessoais; isolamento por usuário, feedback de autosave e permissão administrativa no PATCH.
4. **Configurações da pousada.** Extrair dados empresariais, horários, política e alertas; salvar/descartar por seção, versões, conflitos e restauração limitada.
5. **Usuários e importação.** Mover componentes existentes, preservando controles de ação, delegação, último administrador e confirmação da importação. Remover telas monolíticas antigas depois da migração dos conteúdos.
6. **Homologação e documentação.** Testar mobile/desktop, teclado, histórico, duas sessões, permissões e integridade. Atualizar README/guia e registrar a matriz de acesso. Commit separado por entrega validada; sem mudar regras de negócio nem funcionalidades fiscais.

## Critérios de aceite

- Há somente um destino Configurações no menu; usuários antigos continuam chegando à seção correta conforme seus acessos.
- Usuário vê apenas grupos/seções autorizados; busca e link direto não revelam seções bloqueadas. Entrada sem seção válida é tratada sem tela vazia ou loop.
- Concessão para preferências pessoais não permite alterar teto de desconto, usuários ou regras de alerta globais.
- Leitura sem edição não salva por botão, link direto, endpoint ou operação genérica. PATCH com campos de outra seção é recusado; seção falsificada não muda permissão exigida.
- Administrador pode conceder e revogar entrada e acessos por seção no editor existente, sujeito aos limites de delegação.
- Salvar horário não sobrescreve contato ou política comercial. Conflito de versão preserva rascunho e exige revisão. Falha mantém dados, envio duplicado é bloqueado e auditoria não duplica.
- Dois usuários no mesmo navegador não herdam rascunhos administrativos nem preferências pessoais de visualização um do outro.
- Tema, avisos, horários, desconto, regras, usuários e importação existentes continuam funcionando. Não surgem configurações desconectadas das regras reais.
- Em telas estreitas não há rolagem horizontal; navegação, teclado e barra de ações não ocultam campos/erros. Teclado e leitor de tela identificam seção e estado.
- Testes unitários/componentes para catálogo, formulário e navegação; integração PostgreSQL para autorização, caminhos alternativos, versão, auditoria e permissões revogadas; ensaio no navegador com dois perfis e dispositivo mobile. Testes simulados não substituem a validação integrada.

## Referências e decisões

- [PatternFly — Navigation](https://www.patternfly.org/components/navigation/): navegação agrupada e identificação acessível de regiões. Aplicação proposta: grupos de configuração e navegação local consistente.
- [PatternFly — Tabs, design guidelines](https://www.patternfly.org/components/tabs/design-guidelines/): abas agrupam conteúdos relacionados e devem manter quantidade reduzida. Aplicação proposta: evitar uma fila extensa de abas e hierarquias repetidas.
- [Carbon — Tabs guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/tabs/guidelines): distinguir abas de organização de conteúdo de navegação. Aplicação proposta: menu local com links e histórico para as seções principais.
- [OWASP — Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): menor privilégio, negação por padrão e validação de autorização em cada requisição. Aplicação proposta: controle por seção/campo no servidor, além de visibilidade no menu.

A divisão em oito seções, o comportamento mobile e os nomes de permissões são decisões deste projeto, baseadas no código atual e nessas referências; não são imposições dos design systems. A arquitetura mantém um único aplicativo e banco para ser viável de manter na pousada.
