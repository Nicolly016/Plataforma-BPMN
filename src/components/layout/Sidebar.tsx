"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { BarChart3, FolderKanban, LayoutDashboard, PanelLeft, Settings, Shield, Workflow } from "lucide-react";
import type { UserRole } from "@/types/domain";
import { cn } from "@/utils/format";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/processos", label: "Processos", icon: FolderKanban },
  { href: "/modelagem", label: "Modelagem", icon: Workflow },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/administracao", label: "Administração", icon: Shield, adminOnly: true },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

const SIDEBAR_EVENT = "sidebar-collapsed";

function collapsedSnapshot(): boolean {
  const stored = window.localStorage.getItem("sidebar-collapsed");
  if (stored === "1") {
    return true;
  }
  if (stored === "0") {
    return false;
  }
  return window.innerWidth < 1024;
}

function subscribeSidebar(onStoreChange: () => void) {
  window.addEventListener(SIDEBAR_EVENT, onStoreChange);
  return () => window.removeEventListener(SIDEBAR_EVENT, onStoreChange);
}

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeSidebar, collapsedSnapshot, () => false);

  function toggle() {
    window.localStorage.setItem("sidebar-collapsed", collapsed ? "0" : "1");
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }

  return (
    <aside className={cn("flex h-screen shrink-0 flex-col bg-slate-900 text-slate-100", collapsed ? "w-16" : "w-60")}>
      <div className={cn("flex h-14 items-center border-b border-slate-800", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        {collapsed ? null : <span className="text-sm font-semibold tracking-wide">Processos BPMN</span>}
        <button type="button" className="rounded p-1.5 text-slate-300 hover:bg-slate-800" onClick={toggle} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
          <PanelLeft size={18} />
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {ITEMS.filter((item) => !("adminOnly" in item) || role === "administrador").map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn("flex h-10 items-center gap-3 px-3 text-sm", active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/70", collapsed && "justify-center px-0")}
            >
              <Icon size={18} />
              {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
