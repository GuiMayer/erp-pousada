# Permissões por usuário

No modo `database`, a autorização é verificada no servidor em cada consulta e operação. Ocultar um botão ou alterar dados no navegador não concede acesso às APIs.

## Perfis iniciais

| Perfil | Acessos iniciais |
| --- | --- |
| Administrador | Todos os módulos, administração de usuários e cópias completas de dados. |
| Supervisor | Operação e supervisão dos setores, auditoria e configurações; sem administração de usuários nem exportação/restauração completa. |
| Recepção | Quartos, reservas, hóspedes, consumos e recebimentos de hospedagem; abertura e fechamento do próprio caixa. |
| Caixa | PDV, histórico de vendas, clientes e próprio caixa. |
| Estoque | Estoque, catálogo, categorias de produtos, fornecedores da pousada. |
| Personalizado | Nenhum acesso inicial; cada permissão é concedida individualmente. |
| Operador — acessos anteriores | Mantém a abrangência do operador antigo durante a migração. Deve ser revisado pelo administrador. |

O restaurante foi arquivado. Suas permissões e perfis legados continuam no servidor por compatibilidade, mas não aparecem como opções ativas no editor de acessos.

O perfil fornece uma base. Em **Administração → Usuários → Editar**, escolha **Herdar**, **Permitir** ou **Bloquear** para cada ação. A busca facilita localizar permissões; a prévia mostra o resultado antes de salvar. Um bloqueio individual prevalece sobre a herança e sobre aprovações temporárias.

Consultar, cadastrar, editar e excluir são permissões independentes nos cadastros. Operações como receber hospedagem, estornar venda, pagar despesa, transferir saldo e fechar caixa têm permissões próprias. Registros operacionais e históricos não podem ser alterados pelas APIs genéricas de cadastro.

Selecionar uma conta para receber pagamentos não permite consultar saldo, agência ou número. Os perfis operacionais recebem somente identificador, nome, tipo e situação das contas ativas. Consultar dados financeiros e movimentar valores são poderes separados.

## Administração e sessões

- Administrar usuários exige `users.manage` e a permissão correspondente de consulta/cadastro/edição/exclusão. Quem administra não pode conceder poderes superiores aos próprios nem alterar credenciais de uma conta mais privilegiada.
- O servidor preserva pelo menos um administrador ativo capaz de consultar, cadastrar e editar acessos. Alterações concorrentes usam transação com isolamento serializável.
- Desativar um usuário ou trocar sua senha encerra todas as suas sessões, fecha o histórico das sessões e revoga aprovações relacionadas. Excluir um usuário desativa seu acesso e preserva a identidade histórica.
- Alterações de perfil ou de exceções passam a valer nas próximas requisições, inclusive para sessões já abertas. Não é necessário sair e entrar novamente.
- O navegador verifica a sessão ao recuperar foco, a cada 15 segundos enquanto visível e após mudanças de autenticação entre abas. Mudanças de identidade ou acesso descartam os dados e formulários carregados anteriormente.
- A sessão dura oito horas e usa cookie HttpOnly. Logout encerra somente a sessão atual; as demais sessões independentes do mesmo usuário continuam válidas. Abas que compartilham o cookie acompanham a mudança.
- Senhas de usuários devem ter no mínimo 12 caracteres e no máximo 72 bytes em UTF-8. Senhas e hashes não são enviados ao navegador nem registrados na auditoria.

O nome de login serve para apresentação. A propriedade do turno de caixa usa o ID imutável do usuário, evitando transferência de responsabilidade após renomear um login. Turnos antigos sem responsável identificável exigem a permissão para fechar o caixa de outro responsável.

## Aprovação por operação

Quando a operação permite aprovação, a tela solicita o **usuário e a senha do responsável** e apresenta os valores a conferir. O responsável deve ter tanto `approvals.issue` quanto a permissão específica.

São elegíveis: desconto acima do teto, estorno de venda ou recebimento, remoção de consumo e cancelamento de reserva paga. Definição de multa/crédito, administração de acessos e restauração de dados exigem a permissão diretamente no usuário executor.

A autorização:

1. Dura dois minutos e vale para o usuário e a sessão solicitantes.
2. Fica vinculada ao identificador da requisição, à operação, aos dados enviados e ao estado/valor do registro.
3. É consumida uma vez, na mesma transação da operação. Reenvio idêntico devolve o resultado já gravado, sem novo movimento.
4. Deixa de valer se o registro mudar, se o responsável perder acesso ou se sua conta for desativada.
5. Não supera um bloqueio explícito do executor.

Se os valores mudarem durante a aprovação, feche a solicitação e tente novamente para conferir os valores atuais. A antiga janela global de cinco minutos e o envio de uma senha isolada não concedem autorização.

Ausência de acesso direto a uma operação elegível pode permitir solicitar aprovação. **Bloquear** impede também essa solicitação. A administração mostra essa diferença na prévia.

## Auditoria e concorrência

O servidor registra cadastros, alterações de acessos e operações na mesma transação das mudanças. A auditoria identifica o executor e, quando houver aprovação, o responsável. Alterações de usuário registram perfil e exceções antes/depois, sem credenciais. Restauração e limpeza completas são auditadas e encerram todas as sessões, evitando reutilizar formulários e aprovações anteriores. O cliente não pode criar eventos de auditoria arbitrários.

Reservas e cadastros compartilhados têm uma versão de registro. O formulário envia a versão originalmente exibida. Uma edição baseada em versão antiga recebe conflito e deve ser reaberta; operações de negócio também atualizam a versão dos registros afetados. Comandas mantêm seu controle específico de versão.

## Atualizar uma instalação existente

1. Faça um backup completo do PostgreSQL e valide sua restauração em outro banco.
2. Aplique `pnpm exec prisma migrate deploy` com a aplicação em manutenção, antes de iniciar esta versão. Não utilize `migrate reset` em uma instalação com dados reais.
3. Inicie a aplicação e confira a conta de administração. Supervisores existentes são migrados para Administrador; operadores recebem o perfil de compatibilidade. Isso preserva o acesso inicial.
4. Revise cada usuário e atribua o perfil de seu setor, adicionando somente as exceções necessárias. O perfil de compatibilidade mantém consultas amplas até essa revisão.
5. Confira seleção de conta sem saldo, recebimentos, limites de desconto, cancelamento pago e propriedade do caixa com contas distintas.

As três migrações adicionam perfis/exceções/versões, aprovações vinculadas ao estado do registro e identificação do responsável pelo caixa. Aprovações antigas são invalidadas. A exportação JSON de dados operacionais continua excluindo usuários, sessões, configurações e auditoria; um backup PostgreSQL completo é necessário para recuperar identidades e permissões.

## Validação automatizada

`pnpm test:run` cobre perfis, catálogo, exceções, mudanças entre abas, respostas atrasadas e descarte de dados sensíveis. `pnpm test:integration` usa exclusivamente o banco descartável `erp_test` e verifica APIs reais com usuários de setores diferentes, ausência de saldo na seleção de contas, proteção do administrador, revogação, escopo das aprovações, concorrência e propriedade do caixa após renomear o login.

A demonstração em `demo-localStorage` é independente: não oferece a segurança, transações e autorizações do servidor. Use `database` para usuários reais.
