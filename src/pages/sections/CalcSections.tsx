import { useState } from "react";
import Icon from "@/components/ui/icon";

// ─── Аэродинамика ─────────────────────────────────────────────────────────────
export function AerodynamicsSection() {
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

// ─── Теплорасчёт ─────────────────────────────────────────────────────────────
export function ThermalSection() {
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
