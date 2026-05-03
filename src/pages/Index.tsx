import { useState } from "react";
import Icon from "@/components/ui/icon";
import MineModel3D from "@/components/MineModel3D";
import VentScheme2D from "@/components/VentScheme2D";

// ─── Типы ────────────────────────────────────────────────────────────────────
type Section =
  | "projects"
  | "aerodynamics"
  | "equipment"
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
  { id: "thermal", label: "Теплорасчёт", icon: "Thermometer" },
  { id: "charts", label: "Диаграммы", icon: "BarChart3" },
  { id: "standards", label: "Нормы СП/ГОСТ", icon: "BookOpen" },
  { id: "export", label: "Экспорт", icon: "Download" },
];

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, unit, icon, color, trend, delay,
}: {
  label: string; value: string; unit: string; icon: string;
  color: string; trend?: string; delay: number;
}) {
  return (
    <div className={`animate-fade-up delay-${delay} border-glow relative overflow-hidden rounded-lg bg-card p-4`}>
      <div className="scanlines" />
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-md"
          style={{ background: `${color}1a`, border: `1px solid ${color}40` }}>
          <Icon name={icon} size={18} style={{ color }} />
        </div>
        {trend && <span className="font-mono-data text-xs" style={{ color }}>{trend}</span>}
      </div>
      <div className="mt-3">
        <div className="flex items-baseline gap-1">
          <span className="font-display text-2xl font-semibold text-foreground">{value}</span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ─── SVG Диаграмма давления ───────────────────────────────────────────────────
function PressureChart() {
  const data = [120, 145, 132, 168, 155, 190, 178, 210, 195, 225, 212, 240];
  const months = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;
  const h = 120, w = 480, pad = 40;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad / 2 - ((v - min) / range) * (h - pad);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const areaD = `M ${points[0]} L ${points.join(" L ")} L ${pad + (w - pad * 2)},${h - pad / 2} L ${pad},${h - pad / 2} Z`;

  return (
    <div className="animate-fade-up delay-4 rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Депрессия шахты</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Па — 2024 год</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-4 rounded-full" style={{background: 'hsl(var(--amber))'}} />
          <span className="text-xs text-muted-foreground">Факт</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = h - pad / 2 - t * (h - pad);
          const val = Math.round(min + t * range);
          return (
            <g key={t}>
              <line x1={pad} y1={y} x2={w - pad / 2} y2={y} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
              <text x={pad - 6} y={y + 4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="IBM Plex Mono">{val}</text>
            </g>
          );
        })}
        {months.map((m, i) => {
          const x = pad + (i / (data.length - 1)) * (w - pad * 2);
          return <text key={i} x={x} y={h + 2} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="IBM Plex Sans">{m}</text>;
        })}
        <path d={areaD} fill="hsl(var(--amber) / 0.07)" />
        <path d={pathD} fill="none" stroke="hsl(var(--amber))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-draw" />
        {points.map((p, i) => {
          const [x, y] = p.split(",").map(Number);
          return <circle key={i} cx={x} cy={y} r="3" fill="hsl(var(--amber))" stroke="hsl(var(--card))" strokeWidth="1.5" />;
        })}
      </svg>
    </div>
  );
}

// ─── Bar Chart расхода ────────────────────────────────────────────────────────
function AirflowChart() {
  const data = [
    { label: "Гл. ствол", value: 85, color: "hsl(var(--cyan))" },
    { label: "Вент. ствол", value: 72, color: "hsl(var(--amber))" },
    { label: "Откаточный", value: 58, color: "hsl(var(--emerald))" },
    { label: "Уклон №1", value: 44, color: "hsl(var(--cyan))" },
    { label: "Уклон №2", value: 39, color: "hsl(var(--amber))" },
    { label: "Квершлаг", value: 31, color: "hsl(var(--emerald))" },
  ];
  const barW = 38, gap = 18, h = 120, pad = { top: 10, bottom: 30 };
  const totalW = data.length * (barW + gap);

  return (
    <div className="animate-fade-up delay-5 rounded-lg border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Расход воздуха</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">м³/с по выработкам</p>
      </div>
      <svg width="100%" viewBox={`0 0 ${totalW} ${h + pad.top + pad.bottom}`} className="overflow-visible">
        {data.map((d, i) => {
          const x = i * (barW + gap) + gap / 2;
          const barH = (d.value / 100) * (h - pad.top);
          const y = pad.top + (h - pad.top) - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx="3" fill={d.color} opacity="0.15" />
              <rect x={x + barW / 2 - 1} y={y} width={2} height={barH} fill={d.color} opacity="0.7" />
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill={d.color} fontSize="9" fontFamily="IBM Plex Mono" fontWeight="500">{d.value}</text>
              <text x={x + barW / 2} y={h + pad.top + pad.bottom - 4} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8" fontFamily="IBM Plex Sans">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Радарная диаграмма ───────────────────────────────────────────────────────
function RadarChart() {
  const metrics = [
    { label: "Безопасность", value: 0.88 },
    { label: "Давление", value: 0.72 },
    { label: "Расход", value: 0.91 },
    { label: "КПД", value: 0.65 },
    { label: "Температура", value: 0.78 },
    { label: "Запылённость", value: 0.55 },
  ];
  const cx = 90, cy = 90, r = 65;
  const n = metrics.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const toXY = (i: number, radius: number) => {
    const a = startAngle + i * angleStep;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  };

  const dataPoints = metrics.map((m, i) => toXY(i, m.value * r));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <div className="animate-fade-up delay-6 rounded-lg border border-border bg-card p-5">
      <div className="mb-2">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">Показатели системы</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Комплексная оценка</p>
      </div>
      <svg width="180" height="180" viewBox="0 0 180 180" className="mx-auto">
        {[0.25, 0.5, 0.75, 1].map((level) => {
          const pts = metrics.map((_, i) => toXY(i, level * r));
          const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
          return <path key={level} d={path} fill="none" stroke="hsl(var(--border))" strokeWidth="1" />;
        })}
        {metrics.map((_, i) => {
          const p = toXY(i, r);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="hsl(var(--border))" strokeWidth="1" />;
        })}
        <path d={dataPath} fill="hsl(var(--cyan) / 0.12)" stroke="hsl(var(--cyan))" strokeWidth="1.5" />
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="hsl(var(--cyan))" />
        ))}
        {metrics.map((m, i) => {
          const p = toXY(i, r + 14);
          return (
            <text key={i} x={p.x} y={p.y + 3} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8" fontFamily="IBM Plex Sans">
              {m.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Дашборд ──────────────────────────────────────────────────────────────────
function DashboardSection() {
  const stats = [
    { label: "Объёмный расход", value: "248", unit: "м³/с", icon: "Wind", color: "hsl(var(--amber))", trend: "↑ 3.2%", delay: 1 },
    { label: "Статическая депрессия", value: "1840", unit: "Па", icon: "Gauge", color: "hsl(var(--cyan))", trend: "→ 0.1%", delay: 2 },
    { label: "Мощность вентиляторов", value: "456", unit: "кВт", icon: "Zap", color: "hsl(158 60% 42%)", trend: "↓ 1.8%", delay: 3 },
    { label: "Темп. в забое", value: "+18.4", unit: "°C", icon: "Thermometer", color: "hsl(350 70% 55%)", trend: "→ 0.3%", delay: 4 },
  ];

  const alerts = [
    { type: "warn", text: "Уклон №2 — расход ниже нормы СП 88.13330", time: "14:22" },
    { type: "ok", text: "Вентилятор ВОД-40 — КПД 78%, норма выполнена", time: "13:58" },
    { type: "err", text: "Превышение температуры в блоке 5 (+26°C)", time: "13:15" },
    { type: "ok", text: "Аэродинамический расчёт завершён — шахта «Северная»", time: "12:40" },
  ];

  const alertColors: Record<string, string> = {
    warn: "hsl(var(--amber))", ok: "hsl(158 60% 42%)", err: "hsl(350 70% 55%)",
  };

  const projects = [
    { name: "Шахта «Северная»", mine: "Воркутинское месторождение", status: "В работе", progress: 68 },
    { name: "Рудник «Таймыр»", mine: "Норильский горнопромышленный р-н", status: "Расчёт", progress: 35 },
    { name: "ШУ «Кедровское»", mine: "Кузнецкий угольный бассейн", status: "Готово", progress: 100 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><PressureChart /></div>
        <RadarChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="animate-fade-up delay-6 rounded-lg border border-border bg-card p-5">
          <h3 className="font-display mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Активные проекты</h3>
          <div className="space-y-4">
            {projects.map((p) => (
              <div key={p.name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.mine}</p>
                  </div>
                  <span className="rounded px-2 py-0.5 font-mono-data text-xs"
                    style={{ background: p.progress === 100 ? "hsl(158 60% 42% / 0.15)" : "hsl(var(--amber) / 0.12)", color: p.progress === 100 ? "hsl(158 60% 42%)" : "hsl(var(--amber))" }}>
                    {p.status}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${p.progress}%`, background: p.progress === 100 ? "hsl(158 60% 42%)" : "hsl(var(--amber))" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-fade-up delay-7 rounded-lg border border-border bg-card p-5">
          <h3 className="font-display mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Системные уведомления</h3>
          <div className="space-y-3">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="pulse-dot mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: alertColors[a.type] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed text-foreground">{a.text}</p>
                </div>
                <span className="font-mono-data flex-shrink-0 text-xs text-muted-foreground">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Аэродинамика ─────────────────────────────────────────────────────────────
function AerodynamicsSection() {
  const [values, setValues] = useState({ length: "450", width: "3.5", height: "3.0", roughness: "0.00015", airflow: "28" });

  const L = parseFloat(values.length) || 0;
  const B = parseFloat(values.width) || 1;
  const H = parseFloat(values.height) || 1;
  const ks = parseFloat(values.roughness) || 0;
  const Q = parseFloat(values.airflow) || 0;

  const area = B * H;
  const perimeter = 2 * (B + H);
  const Dh = (4 * area) / perimeter;
  const velocity = area > 0 ? Q / area : 0;
  const Re = velocity > 0 ? (velocity * Dh) / 0.000015 : 0;
  const lambda = Re > 0 ? 0.11 * Math.pow(ks / Dh + 68 / Re, 0.25) : 0;
  const R_spec = lambda / (2 * area * area * Dh);
  const deltaP = R_spec * L * Q * Q;

  const resultFields = [
    { label: "Площадь сечения", value: area.toFixed(2), unit: "м²" },
    { label: "Гидравлический диаметр", value: Dh.toFixed(3), unit: "м" },
    { label: "Скорость воздуха", value: velocity.toFixed(2), unit: "м/с" },
    { label: "Число Рейнольдса", value: Re > 0 ? (Re / 1000).toFixed(1) + "k" : "—", unit: "" },
    { label: "Коэфф. сопр. λ", value: lambda > 0 ? lambda.toFixed(4) : "—", unit: "" },
    { label: "Потеря давления", value: deltaP > 0 ? deltaP.toFixed(1) : "—", unit: "Па" },
  ];

  const speedNorm = velocity >= 0.5 && velocity <= 8;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "hsl(var(--amber) / 0.1)" }}>
          <Icon name="Wind" size={20} style={{ color: "hsl(var(--amber))" }} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">Аэродинамический расчёт воздуховода</h2>
          <p className="text-xs text-muted-foreground">Метод λ-коэффициентов по ГОСТ Р 52539, СП 88.13330.2022</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-display mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Параметры выработки</h3>
          <div className="space-y-3">
            {[
              { key: "length", label: "Длина выработки", unit: "м", step: "10" },
              { key: "width", label: "Ширина (B)", unit: "м", step: "0.1" },
              { key: "height", label: "Высота (H)", unit: "м", step: "0.1" },
              { key: "roughness", label: "Шероховатость (ks)", unit: "м", step: "0.00001" },
              { key: "airflow", label: "Расход воздуха (Q)", unit: "м³/с", step: "1" },
            ].map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <label className="w-40 flex-shrink-0 text-xs text-muted-foreground">{f.label}</label>
                <div className="relative flex-1">
                  <input type="number" step={f.step} value={values[f.key as keyof typeof values]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-1.5 pr-10 font-mono text-sm text-foreground outline-none focus:border-primary transition-colors" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono-data text-xs text-muted-foreground">{f.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-display mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Результаты расчёта</h3>
            <div className="grid grid-cols-2 gap-3">
              {resultFields.map((r) => (
                <div key={r.label} className="rounded-md bg-secondary p-3">
                  <p className="mb-1 text-xs text-muted-foreground">{r.label}</p>
                  <p className="font-mono-data text-lg font-medium text-foreground">
                    {r.value} <span className="text-xs font-normal text-muted-foreground">{r.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4"
            style={{ borderColor: speedNorm ? "hsl(158 60% 42% / 0.4)" : "hsl(350 70% 55% / 0.4)", background: speedNorm ? "hsl(158 60% 42% / 0.06)" : "hsl(350 70% 55% / 0.06)" }}>
            <div className="flex items-center gap-2">
              <Icon name={speedNorm ? "CheckCircle" : "AlertTriangle"} size={16}
                style={{ color: speedNorm ? "hsl(158 60% 42%)" : "hsl(350 70% 55%)" }} />
              <span className="text-sm font-medium"
                style={{ color: speedNorm ? "hsl(158 60% 42%)" : "hsl(350 70% 55%)" }}>
                {speedNorm ? "Скорость соответствует нормам" : velocity < 0.5 ? "Скорость ниже 0.5 м/с" : "Скорость выше 8 м/с"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Допустимо: 0.5 — 8 м/с по ПБ 05-618-03</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Оборудование ─────────────────────────────────────────────────────────────
function EquipmentSection() {
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
              {fans.map((f, i) => (
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

// ─── Теплорасчёт ─────────────────────────────────────────────────────────────
function ThermalSection() {
  const [depth, setDepth] = useState("800");
  const [geothermal, setGeothermal] = useState("0.032");
  const [surface, setSurface] = useState("-15");
  const [airflow, setAirflow] = useState("28");

  const D = parseFloat(depth) || 0;
  const G = parseFloat(geothermal) || 0;
  const T0 = parseFloat(surface) || 0;
  const Q = parseFloat(airflow) || 0;

  const T_rock = T0 + G * D;
  const q_rock = 0.6 * 2.5 * (T_rock - (T0 + 10));
  const T_air_in = T0 + 8;
  const T_air_out = T_air_in + (q_rock / (Q * 1.2 * 1005)) * 1000;

  const zones = [
    { depth: 200, temp: T0 + G * 200, label: "Вентил. горизонт" },
    { depth: 400, temp: T0 + G * 400, label: "Осн. горизонт" },
    { depth: D, temp: T_rock, label: "Горизонт добычи" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "hsl(350 70% 55% / 0.1)" }}>
          <Icon name="Thermometer" size={20} style={{ color: "hsl(350 70% 55%)" }} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">Расчёт теплопритоков и теплопотерь</h2>
          <p className="text-xs text-muted-foreground">По методике НКТП, СП 60.13330.2020</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-display mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Исходные данные</h3>
          <div className="space-y-3">
            {[
              { label: "Глубина разработки", value: depth, setter: setDepth, unit: "м" },
              { label: "Геотермич. градиент", value: geothermal, setter: setGeothermal, unit: "°C/м" },
              { label: "T° поверхности", value: surface, setter: setSurface, unit: "°C" },
              { label: "Расход воздуха", value: airflow, setter: setAirflow, unit: "м³/с" },
            ].map((f) => (
              <div key={f.label}>
                <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
                <div className="relative">
                  <input type="number" value={f.value} onChange={(e) => f.setter(e.target.value)}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-1.5 pr-10 font-mono text-sm text-foreground outline-none focus:border-primary transition-colors" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono-data text-xs text-muted-foreground">{f.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-display mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Температурный профиль</h3>
          <div className="space-y-3">
            {zones.map((z) => (
              <div key={z.label} className="rounded-md bg-secondary p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{z.label}</span>
                  <span className="font-mono-data text-xs text-muted-foreground">{z.depth} м</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-xl font-semibold"
                    style={{ color: z.temp > 26 ? "hsl(350 70% 55%)" : z.temp > 18 ? "hsl(var(--amber))" : "hsl(158 60% 42%)" }}>
                    {z.temp.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">°C</span>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.min(((z.temp - T0) / 30) * 100, 100)}%`,
                      background: z.temp > 26 ? "hsl(350 70% 55%)" : z.temp > 18 ? "hsl(var(--amber))" : "hsl(158 60% 42%)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-display mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Тепловой баланс</h3>
          <div className="space-y-3">
            {[
              { label: "T° пород на горизонте", value: T_rock.toFixed(1), unit: "°C" },
              { label: "Теплоприток от пород", value: q_rock.toFixed(0), unit: "кВт" },
              { label: "T° воздуха на входе", value: T_air_in.toFixed(1), unit: "°C" },
              { label: "T° воздуха на выходе", value: T_air_out.toFixed(1), unit: "°C" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-md bg-secondary p-3">
                <span className="text-xs text-muted-foreground">{r.label}</span>
                <span className="font-mono-data text-sm font-medium text-foreground">
                  {r.value} <span className="text-xs text-muted-foreground">{r.unit}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md p-3"
            style={{ background: T_air_out > 26 ? "hsl(350 70% 55% / 0.1)" : "hsl(158 60% 42% / 0.08)",
              border: `1px solid ${T_air_out > 26 ? "hsl(350 70% 55% / 0.3)" : "hsl(158 60% 42% / 0.3)"}` }}>
            <div className="flex items-center gap-2">
              <Icon name={T_air_out > 26 ? "AlertTriangle" : "CheckCircle"} size={14}
                style={{ color: T_air_out > 26 ? "hsl(350 70% 55%)" : "hsl(158 60% 42%)" }} />
              <span className="text-xs font-medium"
                style={{ color: T_air_out > 26 ? "hsl(350 70% 55%)" : "hsl(158 60% 42%)" }}>
                {T_air_out > 26 ? "Требуется кондиционирование" : "Норма соблюдена"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Предел: 26°C по ПБ 05-618-03</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Нормы СП/ГОСТ ────────────────────────────────────────────────────────────
function StandardsSection() {
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
function ChartsSection() {
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
function ExportSection() {
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
function ProjectsSection() {
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

// ─── Главный компонент ────────────────────────────────────────────────────────
import React from "react";

export default function Index() {
  const [activeSection, setActiveSection] = useState<Section>("scheme");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const sectionComponents: Record<Section, React.ReactElement> = {
    scheme: <VentScheme2D />,
    model: <MineModel3D />,
    projects: <ProjectsSection />,
    aerodynamics: <AerodynamicsSection />,
    equipment: <EquipmentSection />,
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

        <main className={`flex-1 overflow-hidden ${(activeSection === "model" || activeSection === "scheme") ? "p-0 flex flex-col" : "overflow-y-auto p-6"}`}>
          <div className={`animate-fade-up ${(activeSection === "model" || activeSection === "scheme") ? "flex-1 flex flex-col min-h-0 h-full" : ""}`} key={activeSection}>
            {sectionComponents[activeSection]}
          </div>
        </main>
      </div>
    </div>
  );
}