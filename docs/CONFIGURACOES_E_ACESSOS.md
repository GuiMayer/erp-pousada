# Configurações e acessos

Implementado em 11/10/2026. Configurações e Administração passam a ter um único destino no menu. Cadastros, operação, financeiro e auditoria continuam nos seus módulos.

## Navegação e uso

No computador, as seções ficam numa coluna lateral, agrupadas em **Minhas preferências**, **Pousada** e **Administração**. A busca filtra somente as seções autorizadas. No celular, abre uma lista; tocar numa seção mostra o formulário completo, com **Voltar às configurações** e foco no título.

Links usam `?modulo=configuracoes&secao=usuarios`, por exemplo. Histórico, navegação principal e links de seção respeitam o mesmo controle de acesso. O destino antigo `administracao` conduz às configurações; uma seção inválida ou bloqueada abre a primeira permitida.

Tema, animações e métricas salvam automaticamente por usuário e origem do site, neste navegador. Os valores antigos são migrados para uma única conta, sem distribuí-los entre todos os usuários do dispositivo. Meus avisos salvam na conta autenticada, com confirmação ou mensagem de erro; notificações do navegador dependem também da autorização do próprio navegador. Desativar avisos comuns não suprime alertas críticos ativos.

Os formulários da pousada usam **Salvar alterações** e **Descartar**. Ao navegar com edição pendente, é possível salvar, descartar ou permanecer. Falha conserva o rascunho. Rascunhos administrativos ficam na memória da sessão; fechar o aplicativo ou mudar de conta elimina essa memória. Durante envio, edição e navegação ficam bloqueadas para aguardar a confirmação.

## Matriz de permissões

Todas as seções exigem `settings.access`. Essa permissão, sozinha, não libera conteúdo. O destino do menu aparece somente se pelo menos uma seção também estiver autorizada.

| Seção | Consultar/abrir | Alterar |
| --- | --- | --- |
| Aparência e visualização | `settings.personal.edit` | Mesma permissão; somente preferências próprias |
| Meus avisos | `settings.personal.edit` | Mesma permissão; somente preferências próprias |
| Dados da pousada | `settings.business.read` | Leitura + `settings.business.edit` |
| Hospedagem | `settings.lodging.read` | Leitura + `settings.lodging.edit` |
| Política comercial | `settings.commercial.read` | Leitura + `settings.commercial.edit` |
| Regras de alertas | `settings.alerts.read` | Leitura + `settings.alerts.edit` |
| Usuários e acessos | `users.manage` + `users.read` | Também `users.create` ou `users.edit`, conforme a ação |
| Importação de dados | `data.import` | Também as permissões de cadastro/estoque exigidas pelo tipo importado |

Para configurar uma conta, abra **Configurações → Usuários e acessos**, edite o usuário e use o editor existente de perfil e exceções. Um acesso pode ser herdado, permitido ou negado individualmente. Para permitir somente consulta aos horários, libere entrada e leitura de Hospedagem e negue edição. Para bloquear todo o módulo, negue a entrada.

Delegação continua limitada aos poderes do executor. O servidor impede retirar a capacidade de gestão do último administrador ativo, inclusive negando sua entrada em Configurações. Revogação é verificada novamente no servidor; esconder um botão não é a barreira de autorização.

Por padrão, administrador possui todas as permissões. Supervisor conserva configurações globais sem receber gestão de usuários/importação. Perfis operacionais recebem preferências pessoais; o administrador pode revogar esses acessos. Perfis personalizados continuam dependendo das concessões existentes e da migração explícita descrita abaixo.

## Salvamento, concorrência e padrões

Cada seção global possui uma lista fechada de campos e validação própria. Salvar Hospedagem altera somente horários; não envia endereço, contatos ou desconto. Campos desconhecidos e campos de outra seção são rejeitados.

Há uma versão global do registro de configuração. Se duas pessoas editarem a mesma versão, somente uma gravação confirma. A outra conserva o rascunho e pode consultar os valores atuais, adotá-los ou manter sua edição sobre a versão revisada antes de salvar novamente. Mesmo edições em seções diferentes podem exigir essa revisão; não há combinação nem reenvio automático de alterações concorrentes.

**Atualizar valores** consulta o servidor. Sem rascunho, atualiza o formulário; com rascunho, abre a comparação sem sobrescrevê-lo. Atualizações recebidas pela sincronização recarregam apenas formulários sem edição pendente.

**Restaurar padrões desta seção** exige leitura, edição e `settings.restore`, além de confirmação. Está disponível em Hospedagem, Política comercial e Regras de alertas. Não restaura dados da pousada, usuários, importações ou preferências de terceiros.

## Arquitetura entregue

| Camada | Responsabilidade |
| --- | --- |
| `lib/settings/sections.ts` | Catálogo de oito seções, campos, grupos e acesso |
| `lib/settings/schemas.ts` | Validação e contrato fechado por seção |
| `lib/server/settings.ts` | Leitura autorizada, escrita transacional, versão, auditoria e sincronização |
| `app/api/settings/[section]/route.ts` | Consulta autenticada da seção, sem cache |
| Operações `settings-update` / `settings-restore` | Gravação autenticada, mesma origem e idempotência existente |
| `components/settings/settings-shell.tsx` | Navegação responsiva e carregamento da seção ativa |
| `components/settings/sections/global-settings-section.tsx` | Formulário comum das quatro seções globais, conflitos e rascunho |
| Demais componentes em `components/settings/sections/` | Preferências pessoais e gestão de usuários |
| `components/initial-import.tsx` | Importação existente, confirmação e proteção durante envio |
| `contexts/active-tab-context.tsx` | URL, histórico e proteção da saída |
| `contexts/user-preferences-context.tsx` | Preferências locais isoladas por conta/origem |

Navegação e ações compartilham o catálogo; a autorização definitiva continua no servidor. O CRUD genérico e as operações administrativas antigas não podem gravar `systemSettings`. Leituras operacionais desse registro recebem apenas identificação, versão, nome, logotipo, horários e teto de desconto. Contatos e identificação empresarial exigem a seção correspondente.

Escritas confirmadas registram seção, antes/depois e executor na auditoria e publicam a sincronização existente. Repetir uma solicitação confirmada não duplica a alteração nem a auditoria; o servidor também revalida autorização antes de entregar uma resposta idempotente. A aplicação permanece com um único servidor e banco; nenhuma biblioteca ou serviço adicional foi introduzido.

## Atualização da instalação

A migração `20261011170000_settings_sections` deve executar antes de usar a nova interface, pelo procedimento de atualização já adotado pela instalação. Ela converte exceções individuais antigas de edição global para as novas permissões, preservando negações e dando precedência a exceções novas já definidas. Permissões antigas de usuários/importação concedidas explicitamente permitem entrar no novo destino sem liberar outras seções. A versão de acesso das contas é incrementada para renovar os controles da sessão.

Nenhuma migração foi aplicada ao banco operacional durante esta implementação. A validação usou um banco descartável separado.

Para testar no painel da demonstração: **Mais opções → Atualizar versão**. Essa ação constrói a imagem com o código local, prepara o banco de exemplos com as migrações e inicia a demonstração. Apenas iniciar a imagem já construída não inclui código novo. Atualizar a demonstração descarta suas alterações fictícias, conforme a confirmação do painel. O sistema normal usa seu procedimento próprio de atualização e preservação dos dados; esta entrega não alterou nem reiniciou a instalação normal.

## Validação e limite atual

- 392 testes unitários/de componentes passaram em 58 arquivos: catálogo, consulta sem edição, payload limitado à seção, falha com rascunho preservado, bloqueio durante envio/leitura, revisão de versão, histórico, lista mobile, busca autorizada e isolamento de preferências.
- A suíte completa de integração passou com 195 testes em 20 arquivos, usando PostgreSQL 17 nativo num banco temporário separado: migração, APIs autenticadas, origem, autorização, caminhos genéricos, concorrência, idempotência, auditoria, revogação e último administrador, além das regressões operacionais existentes. Uma regressão adicional para leitura de usuários e recibos administrativos após revogação foi adicionada na revisão final; os dois arquivos de segurança/configurações foram então reexecutados com 46 testes aprovados. Ao todo, foram validados 196 casos integrados distintos.
- Verificação de tipos e lint passaram. A compilação de produção foi validada com saída separada da instalação em execução.
- A inspeção visual no navegador e o ensaio em celular real estão pendentes. A revisão automática de aprovação bloqueou iniciar o servidor web temporário com a resposta “blocked by policy”, sem razão detalhada. Os testes de componentes verificam comportamento; não substituem essa homologação visual.

O Docker/WSL não foi iniciado nem reiniciado para esses testes. O banco temporário foi encerrado após a validação.
