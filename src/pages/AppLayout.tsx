import React, { useState } from "react";
import Icon from "@/components/ui/icon";
import MineModel3D from "@/components/MineModel3D";
import VentScheme2D from "@/components/VentScheme2D";
// DashboardSection is exported from DashboardCharts but not used in this layout
// (dashboard section was removed per user request)
import { AerodynamicsSection, ThermalSection } from "@/pages/sections/CalcSections";
import { EquipmentSection, StandardsSection, ChartsSection, ExportSection, ProjectsSection } from "@/pages/sections/DataSections";
import FanCatalog from "@/pages/sections/FanCatalog";

// ─── Типы ────────────────────────────────────────────────────────────────────
type Section =
  | "projects"
  | "aerodynamics"
  | "equipment"
  | "fans"
  | "thermal"
  | "export"
  | "standards"
  | "charts"
  | "model"
  | "scheme";

interface NavItem {
  id: Section;
  label: string;
  icon: string;
  badge?: string;
}

// ─── Данные навигации ─────────────────────────────────────────────────────────
const navItems: NavItem[] = [
  { id: "scheme", label: "Схема 2D", icon: "Map" },
  { id: "model", label: "3D-модель", icon: "Box" },
  { id: "projects", label: "Проекты", icon: "FolderOpen", badge: "3" },
  { id: "aerodynamics", label: "Аэродинамика", icon: "Wind" },
  { id: "equipment", label: "Оборудование", icon: "Settings2" },
  { id: "fans",      label: "Вентиляторы",  icon: "Loader" },
  { id: "thermal", label: "Теплорасчёт", icon: "Thermometer" },
  { id: "charts", label: "Диаграммы", icon: "BarChart3" },
  { id: "standards", label: "Нормы СП/ГОСТ", icon: "BookOpen" },
  { id: "export", label: "Экспорт", icon: "Download" },
];

export default function AppLayout() {
  const [activeSection, setActiveSection] = useState<Section>("scheme");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const sectionComponents: Record<Section, React.ReactElement> = {
    scheme: <VentScheme2D />,
    model: <MineModel3D />,
    projects: <ProjectsSection />,
    aerodynamics: <AerodynamicsSection />,
    equipment: <EquipmentSection />,
    fans: <FanCatalog />,
    thermal: <ThermalSection />,
    charts: <ChartsSection />,
    standards: <StandardsSection />,
    export: <ExportSection />,
  };

  const currentNav = navItems.find((n) => n.id === activeSection);

  return (
    <div className="flex h-screen overflow-hidden bg-background bg-grid">
      {/* Sidebar */}
      <aside className={`flex flex-col border-r border-border transition-all duration-300 ${sidebarOpen ? "w-56" : "w-14"}`}
        style={{ background: "hsl(var(--sidebar-background))" }}>
        <div className="flex h-14 items-center gap-3 border-b border-border px-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ background: "hsl(var(--amber) / 0.15)", border: "1px solid hsl(var(--amber) / 0.3)" }}>
            <span className="font-display text-sm font-bold" style={{ color: "hsl(var(--amber))" }}>М</span>
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in overflow-hidden">
              <p className="font-display text-sm font-semibold text-foreground leading-none">МинВент</p>
              <p className="mt-0.5 font-mono-data text-xs" style={{ color: "hsl(var(--amber))" }}>v2.4 · ГОСТ</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 py-3">
          {navItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                className={`group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-all ${active ? "" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                style={active ? { background: "hsl(var(--amber) / 0.12)", color: "hsl(var(--amber))" } : {}}
                title={!sidebarOpen ? item.label : undefined}>
                <Icon name={item.icon} size={16} fallback="Circle" className="flex-shrink-0" />
                {sidebarOpen && <span className="animate-fade-in flex-1 truncate">{item.label}</span>}
                {sidebarOpen && item.badge && (
                  <span className="font-mono-data rounded-full px-1.5 py-0.5 text-xs"
                    style={{ background: "hsl(var(--amber) / 0.15)", color: "hsl(var(--amber))" }}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border p-2">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground transition-all hover:bg-sidebar-accent">
            <Icon name={sidebarOpen ? "PanelLeftClose" : "PanelLeftOpen"} size={16} className="flex-shrink-0" />
            {sidebarOpen && <span className="animate-fade-in">Свернуть</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-base font-semibold uppercase tracking-wider text-foreground">
              {currentNav?.label}
            </h1>
            {activeSection === "dashboard" && (
              <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5"
                style={{ borderColor: "hsl(158 60% 42% / 0.4)", background: "hsl(158 60% 42% / 0.08)" }}>
                <div className="pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: "hsl(158 60% 42%)" }} />
                <span className="font-mono-data text-xs" style={{ color: "hsl(158 60% 42%)" }}>Система активна</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono-data text-xs text-muted-foreground">03.05.2026 · 14:22</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">ИВ</div>
          </div>
        </header>

        <main className={`flex-1 overflow-hidden ${(activeSection === "model" || activeSection === "scheme" || activeSection === "fans") ? "p-0 flex flex-col" : "overflow-y-auto p-6"}`}>
          <div className={`animate-fade-up ${(activeSection === "model" || activeSection === "scheme" || activeSection === "fans") ? "flex-1 flex flex-col min-h-0 h-full" : ""}`} key={activeSection}>
            {sectionComponents[activeSection]}
          </div>
        </main>
      </div>
    </div>
  );
}