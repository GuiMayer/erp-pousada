# Revisão do modo noturno

Data: 21/10/2026.

## Direção visual

O modo escuro usa superfícies em grafite com uma discreta tonalidade verde. Fundo, cartões e menus têm níveis distintos de luminosidade. Textos principais usam branco suave; textos de apoio usam cinza claro. O verde identifica ações e seleção, enquanto amarelo, azul, lilás e vermelho preservam o significado dos estados operacionais.

As decisões seguem a separação entre superfícies e suas cores de conteúdo descrita pelo [Material Design](https://m3.material.io/styles/color/the-color-system), a orientação de [temas escuros](https://m2.material.io/design/color/dark-theme.html) e as referências da WCAG para [texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) e [componentes visuais](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast).

## Aplicação

- Os tokens de `.dark` em `app/globals.css` centralizam a paleta e os gráficos. Os valores de `:root` do modo claro foram preservados.
- Campos usam fundo escuro e bordas mais visíveis, sem transformar a cor da borda em preenchimento do campo.
- Botões e etiquetas destrutivos usam vermelho sólido com texto branco. Mensagens de erro usam vermelho claro sobre superfícies escuras. Essa distinção evita reutilizar o mesmo vermelho em combinações incompatíveis.
- Indicadores e mensagens de cadastros, cobrança e estoque recebem variantes escuras; fundos claros de erro não vazam para o tema noturno.
- Status continuam identificados por rótulos e ícones, além da cor. Layout e regras de negócio permanecem os mesmos.

## Contrastes medidos

Razões calculadas com luminância relativa sRGB, para os pares opacos abaixo. A referência de texto comum é 4,5:1; para limites necessários de controles, 3:1.

| Combinação | Contraste |
| --- | ---: |
| Texto principal / fundo | 14,91:1 |
| Texto secundário / menu elevado | 6,53:1 |
| Texto do botão primário / verde | 8,91:1 |
| Verde / superfície selecionada | 5,90:1 |
| Texto / etiqueta disponível | 8,54:1 |
| Texto / etiqueta ocupado | 9,40:1 |
| Texto / etiqueta bloqueado | 8,50:1 |
| Texto / etiqueta limpeza | 7,87:1 |
| Mensagem de erro / cartão | 7,91:1 |
| Texto branco / botão destrutivo | 6,08:1 |
| Borda de campo / cartão | 3,81:1 |

Essas medições validam os pares da paleta; não constituem certificação integral de acessibilidade. Transparências, estados desabilitados, cores escolhidas por usuários e todos os gráficos não foram auditados individualmente.

## Verificação

- Verificação de tipos, lint e compilação de produção aprovados.
- Nove testes existentes dos cartões e do atendimento aprovados.
- Conferência no navegador: mapa em mobile e desktop, menu contextual, tabela de produtos e formulário de nova bebida, sem salvar alterações operacionais.
- Alternância entre claro e escuro conferida; tokens do modo claro comparados com a versão anterior e preservados.
