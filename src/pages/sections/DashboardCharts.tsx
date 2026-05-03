import Icon from "@/components/ui/icon";

// ─── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({
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
export function PressureChart() {
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
export function AirflowChart() {
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
export function RadarChart() {
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
export function DashboardSection() {
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
