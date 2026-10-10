# Instalação local no Windows

Siga [Instalação no computador da pousada](INSTALACAO_POUSADA.md) para usar PostgreSQL e Docker Desktop com armazenamento persistente.

O menu `pousada-menu.bat` reúne configuração inicial, iniciar/atualizar, verificar, backup manual e abertura do sistema. Ele usa `.env.docker.local` e o perfil de HTTPS interno. Não contém opções de apagar volumes ou restaurar dados sem acompanhamento.

Para demonstração sem banco, siga o README. O modo de demonstração é separado da operação real. Para desenvolvimento com banco, consulte [Produção](PRODUCAO.md).
