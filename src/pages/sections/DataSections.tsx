import React from "react";
import { useState } from "react";
import Icon from "@/components/ui/icon";
import { PressureChart, AirflowChart } from "@/pages/sections/DashboardCharts";

// ─── Оборудование ─────────────────────────────────────────────────────────────
export function EquipmentSection() {
  const fans = [
    { model: "ВОД-40", type: "Осевой", flow: "80–280", pressure: "200–1400", power: "160–630", rpm: "740/985", weight: "6800", gost: "ГОСТ 11414" },
    { model: "ВЦД-47", type: "Центробежный", flow: "120–350", pressure: "300–2500", power: "250–800", rpm: "500/740", weight: "12500", gost: "ГОСТ 11414" },
    { model: "ВОД-21", type: "Осевой", flow: "25–90", pressure: "100–900", power: "55–200", rpm: "985/1470", weight: "2100", gost: "ГОСТ 11414" },
    { model: "ВЦ-5-35", type: "Центробежный", flow: "5–42", pressure: "80–600", power: "11–75", rpm: "1470", weight: "480", gost: "ГОСТ 10616" },
    { model: "ВМЭ-8", type: "Местный", flow: "8–20", pressure: "2000–4000", power: "22–55", rpm: "2950", weight: "320", gost: "ГОСТ 11414" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "hsl(var(--cyan) / 0.1)" }}>
          <Icon name="Settings2" size={20} style={{ color: "hsl(var(--cyan))" }} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">Подбор вентиляционного оборудования</h2>
          <p className="text-xs text-muted-foreground">База вентиляторов для шахт и рудников</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Модель","Тип","Расход, м³/с","Давление, Па","Мощность, кВт","Об/мин","Масса, кг","Стандарт"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-mono-data text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fans.map((f) => (
                <tr key={f.model} className="border-b border-border/50 transition-colors hover:bg-secondary/50">
                  <td className="px-4 py-3">
                    <span className="font-display font-semibold" style={{ color: "hsl(var(--amber))" }}>{f.model}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{f.type}</td>
                  <td className="px-4 py-3 font-mono-data text-sm text-foreground">{f.flow}</td>
                  <td className="px-4 py-3 font-mono-data text-sm text-foreground">{f.pressure}</td>
                  <td className="px-4 py-3 font-mono-data text-sm text-foreground">{f.power}</td>
                  <td className="px-4 py-3 font-mono-data text-sm text-foreground">{f.rpm}</td>
                  <td className="px-4 py-3 font-mono-data text-sm text-foreground">{f.weight}</td>
                  <td className="px-4 py-3">
                    <span className="rounded border px-1.5 py-0.5 font-mono-data text-xs"
                      style={{ borderColor: "hsl(var(--cyan) / 0.4)", color: "hsl(var(--cyan))" }}>{f.gost}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Нормы СП/ГОСТ ────────────────────────────────────────────────────────────
export function StandardsSection() {
  const [search, setSearch] = useState("");
  const standards = [
    { code: "СП 88.13330.2022", name: "Защитные сооружения гражданской обороны", topic: "Вентиляция убежищ и шахт", year: 2022 },
    { code: "СП 60.13330.2020", name: "Отопление, вентиляция и кондиционирование", topic: "Параметры воздуха, скорости", year: 2020 },
    { code: "ГОСТ 11414-2020", name: "Вентиляторы шахтные главного проветривания", topic: "ВОД, ВЦД — технические условия", year: 2020 },
    { code: "ГОСТ Р 52539", name: "Чистота воздуха в шахтах", topic: "Нормы загрязнений, методы контроля", year: 2006 },
    { code: "ПБ 05-618-03", name: "Правила безопасности в угольных шахтах", topic: "Скорости воздуха, температура, газы", year: 2003 },
    { code: "ГОСТ 10616-2020", name: "Вентиляторы радиальные и осевые", topic: "Технические условия, типоразмеры", year: 2020 },
    { code: "РД 05-365-00", name: "Инструкция по составлению вентиляционных планов", topic: "Требования к схемам и расчётам", year: 2000 },
    { code: "СТО РосГорТехнадзор", name: "Нормативы проветривания рудников", topic: "Удельный расход воздуха на забой", year: 2019 },
  ];

  const filtered = standards.filter((s) =>
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.topic.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "hsl(var(--amber) / 0.1)" }}>
          <Icon name="BookOpen" size={20} style={{ color: "hsl(var(--amber))" }} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">Справочник норм СП и ГОСТ</h2>
          <p className="text-xs text-muted-foreground">Актуальные нормативные документы по вентиляции шахт</p>
        </div>
      </div>

      <div className="relative">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Поиск по коду, названию или теме..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-4 text-sm text-foreground outline-none focus:border-primary transition-colors" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filtered.map((s, i) => (
          <div key={s.code} className="border-glow animate-fade-up rounded-lg bg-card p-4" style={{ animationDelay: `${i * 0.04}s` }}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="font-mono-data rounded px-2 py-0.5 text-xs font-semibold"
                style={{ background: "hsl(var(--amber) / 0.12)", color: "hsl(var(--amber))" }}>{s.code}</span>
              <span className="font-mono-data text-xs text-muted-foreground">{s.year}</span>
            </div>
            <p className="mb-1 text-sm font-medium text-foreground">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.topic}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Диаграммы ────────────────────────────────────────────────────────────────
export function ChartsSection() {
  const heatRows = [
    { label: "−200м", base: 10 },
    { label: "−400м", base: 16 },
    { label: "−600м", base: 22 },
    { label: "−800м", base: 28 },
  ];
  const monthsHeat = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "hsl(var(--cyan) / 0.1)" }}>
          <Icon name="BarChart3" size={20} style={{ color: "hsl(var(--cyan))" }} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">Интерактивные диаграммы</h2>
          <p className="text-xs text-muted-foreground">Визуализация расчётных параметров вентиляционной сети</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <PressureChart />
        <AirflowChart />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="font-display mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
          Тепловая карта — Температура воздуха по горизонтам (°C)
        </h3>
        <div className="overflow-x-auto">
          <div className="inline-grid gap-1" style={{ gridTemplateColumns: "72px repeat(12, 38px)" }}>
            <div />
            {monthsHeat.map((m) => (
              <div key={m} className="text-center font-mono-data text-xs text-muted-foreground">{m}</div>
            ))}
            {heatRows.map((row) => {
              const sinVals = Array.from({ length: 12 }, (_, i) =>
                row.base + Math.sin((i / 12) * Math.PI * 2) * 3
              );
              return (
                <React.Fragment key={row.label}>
                  <div className="flex items-center font-mono-data text-xs text-muted-foreground">{row.label}</div>
                  {sinVals.map((v, i) => {
                    const t = Math.max(0, Math.min(1, (v - 8) / 24));
                    const red = Math.round(30 + t * 200);
                    const green = Math.round(120 - t * 80);
                    const blue = Math.round(180 - t * 160);
                    return (
                      <div key={i} className="flex h-8 items-center justify-center rounded font-mono-data text-xs"
                        style={{ background: `rgb(${red},${green},${blue})`, color: v > 20 ? "#fff" : "#999" }}>
                        {v.toFixed(0)}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4">
          {[
            { color: "rgb(30,120,180)", label: "≤10°C" },
            { color: "rgb(130,90,100)", label: "18–22°C" },
            { color: "rgb(230,40,20)", label: ">26°C" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <div className="h-2 w-6 rounded" style={{ background: l.color }} />
              <span className="text-xs text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Экспорт ──────────────────────────────────────────────────────────────────
export function ExportSection() {
  const reports = [
    { name: "Аэродинамический расчёт — Шахта «Северная»", type: "PDF", size: "2.4 МБ", date: "03.05.2026" },
    { name: "Ведомость оборудования — Рудник «Таймыр»", type: "XLSX", size: "540 КБ", date: "01.05.2026" },
    { name: "Тепловой расчёт — ШУ «Кедровское»", type: "PDF", size: "1.1 МБ", date: "28.04.2026" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "hsl(158 60% 42% / 0.1)" }}>
          <Icon name="Download" size={20} style={{ color: "hsl(158 60% 42%)" }} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">Экспорт результатов</h2>
          <p className="text-xs text-muted-foreground">Формирование отчётов в PDF и Excel</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          { format: "PDF", icon: "FileText", desc: "Полный технический отчёт с расчётами, схемами и заключением", color: "hsl(350 70% 55%)" },
          { format: "Excel", icon: "Table2", desc: "Сводные таблицы параметров, ведомость оборудования", color: "hsl(158 60% 42%)" },
          { format: "DXF/DWG", icon: "Pencil", desc: "Схема вентиляции для AutoCAD и других САПР", color: "hsl(var(--cyan))" },
          { format: "JSON", icon: "Code2", desc: "Исходные данные и результаты в машиночитаемом формате", color: "hsl(var(--amber))" },
        ].map((f) => (
          <button key={f.format}
            className="border-glow group flex items-center gap-4 rounded-lg bg-card p-5 text-left transition-all hover:bg-secondary">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${f.color}18` }}>
              <Icon name={f.icon} size={20} style={{ color: f.color }} fallback="FileText" />
            </div>
            <div className="flex-1">
              <p className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">Экспорт {f.format}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{f.desc}</p>
            </div>
            <Icon name="ChevronRight" size={16} className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="font-display mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">История экспортов</h3>
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.name} className="flex cursor-pointer items-center gap-4 rounded-md bg-secondary p-3 transition-colors hover:bg-secondary/80">
              <span className="font-mono-data w-12 flex-shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-semibold"
                style={{ background: r.type === "PDF" ? "hsl(350 70% 55% / 0.15)" : "hsl(158 60% 42% / 0.15)", color: r.type === "PDF" ? "hsl(350 70% 55%)" : "hsl(158 60% 42%)" }}>
                {r.type}
              </span>
              <span className="flex-1 text-sm text-foreground">{r.name}</span>
              <span className="font-mono-data text-xs text-muted-foreground">{r.size}</span>
              <span className="font-mono-data text-xs text-muted-foreground">{r.date}</span>
              <Icon name="Download" size={14} className="flex-shrink-0 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Проекты ──────────────────────────────────────────────────────────────────
export function ProjectsSection() {
  const projects = [
    { name: "Шахта «Северная»", location: "Воркутинское месторождение", depth: 920, airflow: 248, status: "В работе", updated: "03.05.2026", progress: 68 },
    { name: "Рудник «Таймыр»", location: "Норильский горнопромышленный р-н", depth: 1100, airflow: 185, status: "Расчёт", updated: "01.05.2026", progress: 35 },
    { name: "ШУ «Кедровское»", location: "Кузнецкий угольный бассейн", depth: 680, airflow: 312, status: "Готово", updated: "28.04.2026", progress: 100 },
  ];

  const statusColor: Record<string, string> = {
    "В работе": "hsl(var(--amber))",
    "Расчёт": "hsl(var(--cyan))",
    "Готово": "hsl(158 60% 42%)",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "hsl(var(--amber) / 0.1)" }}>
            <Icon name="FolderOpen" size={20} style={{ color: "hsl(var(--amber))" }} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">Управление проектами</h2>
            <p className="text-xs text-muted-foreground">Вентиляция рудников и шахт</p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all hover:opacity-90"
          style={{ background: "hsl(var(--amber))", color: "hsl(220 20% 8%)" }}>
          <Icon name="Plus" size={14} />
          Новый проект
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {projects.map((p, i) => (
          <div key={p.name} className="border-glow animate-fade-up rounded-lg bg-card p-5" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-display font-semibold text-foreground">{p.name}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.location}</p>
              </div>
              <span className="rounded px-2 py-0.5 font-mono-data text-xs"
                style={{ background: `${statusColor[p.status]}18`, color: statusColor[p.status] }}>{p.status}</span>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3">
              {[{ label: "Глубина", value: `${p.depth} м` }, { label: "Расход воздуха", value: `${p.airflow} м³/с` }].map((s) => (
                <div key={s.label} className="rounded-md bg-secondary p-2.5">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-mono-data text-sm font-medium text-foreground">{s.value}</p>
                </div>
              ))}
            </div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Завершённость</span>
              <span className="font-mono-data">{p.progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${p.progress}%`, background: statusColor[p.status] }} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Обновлено {p.updated}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
