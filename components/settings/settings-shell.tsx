"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useActiveTab } from "@/contexts/active-tab-context";
import {
  visibleSettingsSections,
  type GlobalSectionId,
} from "@/lib/settings/sections";
import { usePhoneLayout } from "@/hooks/use-phone-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
const GlobalSection = dynamic(
  () =>
    import("./sections/global-settings-section").then(
      (m) => m.GlobalSettingsSection,
    ),
  { loading: () => <p role="status">Carregando seção…</p> },
);
const Appearance = dynamic(() =>
  import("./sections/appearance-section").then((m) => m.AppearanceSection),
);
const Notifications = dynamic(() =>
  import("./sections/personal-notifications-section").then(
    (m) => m.PersonalNotificationsSection,
  ),
);
const Users = dynamic(() =>
  import("./sections/users-section").then((m) => m.UsersSection),
);
const InitialImport = dynamic(() =>
  import("@/components/initial-import").then((m) => m.InitialImport),
);
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
export function SettingsShell() {
  const { can } = useAuth(),
    { settingsSection, setSettingsSection } = useActiveTab(),
    phone = usePhoneLayout();
  const [search, setSearch] = useState(""),
    heading = useRef<HTMLHeadingElement>(null),
    nav = useRef<HTMLElement>(null),
    previous = useRef<string | undefined>(undefined);
  const allowed = visibleSettingsSections(can),
    selected = allowed.find((s) => s.id === settingsSection) ?? allowed[0],
    showSection = !phone || !!settingsSection;
  useEffect(() => {
    if (settingsSection && !allowed.some((s) => s.id === settingsSection))
      setSettingsSection(allowed[0]?.id);
  }, [settingsSection, allowed, setSettingsSection]);
  useEffect(() => {
    if (phone && settingsSection) heading.current?.focus();
    else if (phone && previous.current)
      nav.current
        ?.querySelector<HTMLAnchorElement>(
          `[data-section="${previous.current}"]`,
        )
        ?.focus();
    previous.current = settingsSection;
  }, [phone, settingsSection]);
  if (!allowed.length)
    return (
      <p role="status">
        Nenhuma seção de configuração foi liberada para seu usuário. Procure o
        administrador.
      </p>
    );
  const filtered = allowed.filter((s) =>
    normalize(`${s.title} ${s.description} ${s.keywords}`).includes(
      normalize(search),
    ),
  );
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-semibold">Configurações</h2>
      <div className="grid min-w-0 gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
        {(!phone || !showSection) && (
          <nav
            ref={nav}
            aria-label="Seções de configuração"
            className="space-y-5"
          >
            <Input
              aria-label="Buscar configuração"
              placeholder="Buscar configuração"
              className="min-h-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {["Minhas preferências", "Pousada", "Administração"].map(
              (group) => {
                const sections = filtered.filter((s) => s.group === group);
                return sections.length ? (
                  <div key={group} className="space-y-1">
                    <h3 className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </h3>
                    {sections.map((section) => (
                      <a
                        key={section.id}
                        data-section={section.id}
                        href={`?modulo=configuracoes&secao=${section.id}`}
                        aria-current={
                          showSection && selected?.id === section.id
                            ? "page"
                            : undefined
                        }
                        className={`flex min-h-11 flex-col rounded-md px-3 py-2 focus-visible:outline focus-visible:outline-2 ${showSection && selected?.id === section.id ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"}`}
                        onClick={(e) => {
                          if (
                            e.button !== 0 ||
                            e.metaKey ||
                            e.ctrlKey ||
                            e.shiftKey ||
                            e.altKey
                          )
                            return;
                          e.preventDefault();
                          setSettingsSection(section.id);
                        }}
                      >
                        <span className="text-sm font-medium">
                          {section.title}
                        </span>
                        {phone && (
                          <span className="text-xs text-muted-foreground">
                            {section.description}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                ) : null;
              },
            )}
            {!filtered.length && (
              <p role="status" className="text-sm">
                Nenhuma configuração encontrada.
              </p>
            )}
          </nav>
        )}
        {showSection && selected && (
          <div className="min-w-0 max-w-3xl space-y-5">
            {phone && (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setSettingsSection(undefined)}
              >
                Voltar às configurações
              </Button>
            )}
            <header className="space-y-2">
              <h3 ref={heading} tabIndex={-1} className="text-xl font-semibold">
                {selected.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {selected.description}
              </p>
              <p className="text-xs text-muted-foreground">
                {selected.group === "Minhas preferências"
                  ? "Somente suas preferências."
                  : "Afeta a administração ou a operação da pousada."}
              </p>
            </header>
            <div key={selected.id} data-slot="section-content">
              {selected.id === "aparencia" ? (
                <Appearance />
              ) : selected.id === "avisos" ? (
                <Notifications />
              ) : selected.id === "usuarios" ? (
                <Users />
              ) : selected.id === "importacao" ? (
                <InitialImport />
              ) : (
                <GlobalSection section={selected.id as GlobalSectionId} />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
