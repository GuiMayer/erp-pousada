export const SETTINGS_SECTIONS = [
  {
    id: "aparencia",
    group: "Minhas preferências",
    title: "Aparência e visualização",
    description: "Tema, animações e métricas neste navegador.",
    permissions: ["settings.personal.edit"],
    keywords: "tema claro escuro gráficos métricas",
  },
  {
    id: "avisos",
    group: "Minhas preferências",
    title: "Meus avisos",
    description: "Escolha os avisos que você recebe.",
    permissions: ["settings.personal.edit"],
    keywords: "notificações navegador",
  },
  {
    id: "pousada",
    group: "Pousada",
    title: "Dados da pousada",
    description: "Nome, contato e identificação empresarial.",
    permissions: ["settings.business.read"],
    keywords: "cnpj endereço telefone email logo",
  },
  {
    id: "hospedagem",
    group: "Pousada",
    title: "Hospedagem",
    description: "Horários padrão de entrada e saída.",
    permissions: ["settings.lodging.read"],
    keywords: "check-in check-out horários",
  },
  {
    id: "comercial",
    group: "Pousada",
    title: "Política comercial",
    description: "Limite de desconto para a operação.",
    permissions: ["settings.commercial.read"],
    keywords: "teto desconto",
  },
  {
    id: "alertas",
    group: "Pousada",
    title: "Regras de alertas",
    description: "Lembretes e limites para toda a pousada.",
    permissions: ["settings.alerts.read"],
    keywords: "notificações estoque caixa",
  },
  {
    id: "usuarios",
    group: "Administração",
    title: "Usuários e acessos",
    description: "Contas, perfis e permissões individuais.",
    permissions: ["users.manage", "users.read"],
    keywords: "senha funcionário administrador",
  },
  {
    id: "importacao",
    group: "Administração",
    title: "Importação de dados",
    description: "Preparação inicial com revisão dos dados.",
    permissions: ["data.import"],
    keywords: "cadastro inicial planilha abertura",
  },
] as const;
export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];
export type GlobalSectionId =
  | "pousada"
  | "hospedagem"
  | "comercial"
  | "alertas";
export const GLOBAL_SECTIONS = {
  pousada: {
    permission: "business",
    fields: [
      "pousadaName",
      "contactPhone",
      "contactEmail",
      "address",
      "cnpj",
      "razaoSocial",
      "inscricaoEstadual",
      "logoUrl",
    ],
    restorable: false,
  },
  hospedagem: {
    permission: "lodging",
    fields: ["checkInTime", "checkOutTime"],
    restorable: true,
  },
  comercial: {
    permission: "commercial",
    fields: ["discountCeiling"],
    restorable: true,
  },
  alertas: {
    permission: "alerts",
    fields: [
      "notifyCheckInReminder",
      "notifyCheckOutReminder",
      "notifyLowStock",
      "notifyPendingPayments",
      "notificationRules",
    ],
    restorable: true,
  },
} as const;
export function visibleSettingsSections(can: (permission: string) => boolean) {
  return can("settings.access")
    ? SETTINGS_SECTIONS.filter((section) => section.permissions.every(can))
    : [];
}
export function canOpenSettings(can: (permission: string) => boolean) {
  return visibleSettingsSections(can).length > 0;
}
export function globalSection(id: string) {
  return Object.hasOwn(GLOBAL_SECTIONS, id)
    ? GLOBAL_SECTIONS[id as GlobalSectionId]
    : undefined;
}
export function selectSectionFields(
  section: GlobalSectionId,
  row: Record<string, unknown>,
) {
  return Object.fromEntries(
    GLOBAL_SECTIONS[section].fields.map((field) => [
      field,
      row[field] ?? (field === "notificationRules" ? {} : ""),
    ]),
  );
}
