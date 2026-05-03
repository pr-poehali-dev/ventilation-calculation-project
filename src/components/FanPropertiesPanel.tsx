import React, { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Типы ─────────────────────────────────────────────────────────────────────
export interface FanObject {
  id: string;
  type?: string;
  label?: string;
  params?: string;
  color?: string;
  angle?: number;
  fanModel?: string;
  fanDiameter?: string;
  fanRPM?: string;
  fanBladeAngle?: string;
  fanDriveType?: string;
  fanMotorPower?: string;
  fanMotorVoltage?: string;
  fanInstallYear?: string;
  fanInstallMonth?: string;
  fanRemarks?: string;
  fanWorkQ?: number;
  fanWorkP?: number;
  fanCurve?: [number, number][];
  fanEffCurve?: [number, number][];
}

interface Props {
  fan: FanObject;
  onUpdate: (patch: Partial<FanObject>) => void;
  onClose: () => void;
  onDelete: () => void;
  inputCls: string;
}

type Tab = "general" | "curve" | "calc";

// ─── Стандартные характеристики вентиляторов ──────────────────────────────────
const FAN_PRESETS: Record<string, { curve: [number,number][]; eff: [number,number][]; power: string; diameter: string }> = {
  "ВОД-40": {
    diameter: "4000",
    power: "2×800",
    curve: [[0,2400],[20,2350],[40,2200],[60,2000],[80,1700],[100,1300],[120,800],[140,200],[150,0]],
    eff:   [[0,0],[20,35],[40,58],[60,72],[80,75],[100,70],[120,55],[140,30],[150,0]],
  },
  "ВОД-30": {
    diameter: "3000",
    power: "2×400",
    curve: [[0,1600],[15,1550],[30,1420],[50,1200],[70,900],[90,500],[105,100],[110,0]],
    eff:   [[0,0],[15,32],[30,55],[50,70],[70,73],[90,60],[105,30],[110,0]],
  },
  "ВОКД-3.6": {
    diameter: "3600",
    power: "1×630",
    curve: [[0,1800],[20,1750],[40,1600],[60,1350],[80,1000],[100,550],[115,100],[120,0]],
    eff:   [[0,0],[20,30],[40,52],[60,68],[80,72],[100,60],[115,35],[120,0]],
  },
  "ВЦД-31.5": {
    diameter: "3150",
    power: "2×500",
    curve: [[0,2000],[15,1970],[35,1850],[55,1600],[75,1200],[95,700],[110,200],[115,0]],
    eff:   [[0,0],[15,28],[35,50],[55,67],[75,72],[95,62],[110,40],[115,0]],
  },
  "ВМЭ-8": {
    diameter: "800",
    power: "1×45",
    curve: [[0,1200],[2,1170],[4,1100],[6,950],[8,700],[10,350],[11,50],[12,0]],
    eff:   [[0,0],[2,30],[4,52],[6,68],[8,70],[10,55],[11,25],[12,0]],
  },
};

const DRIVE_TYPES = ["Прямой привод","Через муфту","Клиноременная передача","Редуктор"];
const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

// ─── Компонент графика Q-P ────────────────────────────────────────────────────
function QPChart({
  curve, effCurve, workQ, workP,
}: {
  curve: [number, number][];
  effCurve?: [number, number][];
  workQ?: number;
  workP?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || curve.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    const PAD = { top: 14, right: 12, bottom: 28, left: 42 };
    const CW = W - PAD.left - PAD.right;
    const CH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    const maxQ = Math.max(...curve.map(p => p[0])) * 1.05;
    const maxP = Math.max(...curve.map(p => p[1])) * 1.1;
    const maxEff = 100;

    const toX = (q: number) => PAD.left + (q / maxQ) * CW;
    const toY = (p: number) => PAD.top + CH - (p / maxP) * CH;
    const toYEff = (e: number) => PAD.top + CH - (e / maxEff) * CH;

    // ── Сетка ─────────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(148,163,184,0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const x = PAD.left + (i / 5) * CW;
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + CH); ctx.stroke();
      const y = PAD.top + (i / 5) * CH;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + CW, y); ctx.stroke();
    }

    // ── Оси ───────────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(148,163,184,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + CH);
    ctx.lineTo(PAD.left + CW, PAD.top + CH);
    ctx.stroke();

    // Подписи осей
    ctx.fillStyle = "rgba(148,163,184,0.8)";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxP * i) / 4);
      ctx.fillText(String(val), PAD.left - 3, toY(maxP * i / 4) + 3);
    }
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxQ * i) / 4);
      ctx.fillText(String(val), toX(maxQ * i / 4), PAD.top + CH + 10);
    }

    // Подписи осей Y
    ctx.save();
    ctx.translate(10, PAD.top + CH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "rgba(96,165,250,0.7)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("P, Па", 0, 0);
    ctx.restore();

    ctx.fillStyle = "rgba(148,163,184,0.6)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Q, м³/с", PAD.left + CW / 2, H - 3);

    // ── КПД (пунктир, правая ось) ─────────────────────────────────────────
    if (effCurve && effCurve.length >= 2) {
      ctx.strokeStyle = "rgba(250,204,21,0.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      effCurve.forEach(([q, e], i) => {
        const x = toX(q), y = toYEff(e);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Кривая Q-P ────────────────────────────────────────────────────────
    // Заливка под кривой
    ctx.beginPath();
    ctx.moveTo(toX(curve[0][0]), PAD.top + CH);
    curve.forEach(([q, p]) => ctx.lineTo(toX(q), toY(p)));
    ctx.lineTo(toX(curve[curve.length - 1][0]), PAD.top + CH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + CH);
    grad.addColorStop(0, "rgba(59,130,246,0.35)");
    grad.addColorStop(1, "rgba(59,130,246,0.03)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Линия
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    curve.forEach(([q, p], i) => {
      const x = toX(q), y = toY(p);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // ── Рабочая точка ─────────────────────────────────────────────────────
    if (workQ !== undefined && workP !== undefined && workQ <= maxQ && workP <= maxP) {
      const wx = toX(workQ);
      const wy = toY(workP);

      // Перекрестие
      ctx.strokeStyle = "rgba(239,68,68,0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(PAD.left, wy); ctx.lineTo(wx, wy);
      ctx.moveTo(wx, PAD.top + CH); ctx.lineTo(wx, wy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Точка
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(wx, wy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Подпись
      ctx.fillStyle = "#fff";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${workQ.toFixed(0)} м³/с`, wx + 7, wy - 4);
      ctx.fillText(`${workP.toFixed(0)} Па`, wx + 7, wy + 6);
    }
  }, [curve, effCurve, workQ, workP]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => {
      c.width = c.offsetWidth;
      c.height = c.offsetHeight;
      draw();
    });
    ro.observe(c);
    c.width = c.offsetWidth;
    c.height = c.offsetHeight;
    return () => ro.disconnect();
  }, [draw]);

  return (
    <canvas ref={canvasRef} style={{ width: "100%", height: 180 }}
      className="rounded-lg border border-slate-800" />
  );
}

// ─── Редактор точек кривой ────────────────────────────────────────────────────
function CurveEditor({
  curve, onChange, label, unit,
}: {
  curve: [number, number][];
  onChange: (c: [number, number][]) => void;
  label: [string, string];
  unit: [string, string];
}) {
  const addPoint = () => {
    const lastQ = curve.length > 0 ? curve[curve.length - 1][0] + 10 : 0;
    onChange([...curve, [lastQ, 0]]);
  };

  const updatePoint = (i: number, col: 0 | 1, val: string) => {
    const next = curve.map((p, idx) =>
      idx === i ? ([col === 0 ? parseFloat(val)||0 : p[0], col === 1 ? parseFloat(val)||0 : p[1]] as [number, number]) : p
    );
    onChange(next);
  };

  const removePoint = (i: number) => onChange(curve.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="grid grid-cols-2 gap-1 flex-1 mr-2">
          <span className="text-xs font-medium text-slate-400">{label[0]}, {unit[0]}</span>
          <span className="text-xs font-medium text-slate-400">{label[1]}, {unit[1]}</span>
        </div>
        <button onClick={addPoint}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs"
          style={{ background: "rgba(59,130,246,0.2)", color: "#60a5fa" }}>
          <Icon name="Plus" size={10} /> Точка
        </button>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {curve.map(([q, p], i) => (
          <div key={i} className="flex items-center gap-1">
            <input type="number" value={q} step="5"
              onChange={e => updatePoint(i, 0, e.target.value)}
              className="flex-1 rounded border px-1.5 py-0.5 text-xs font-mono"
              style={{ background: "#1e293b", borderColor: "#334155", color: "#e2e8f0" }} />
            <input type="number" value={p} step="50"
              onChange={e => updatePoint(i, 1, e.target.value)}
              className="flex-1 rounded border px-1.5 py-0.5 text-xs font-mono"
              style={{ background: "#1e293b", borderColor: "#334155", color: "#e2e8f0" }} />
            <button onClick={() => removePoint(i)}
              className="text-slate-600 hover:text-red-400 transition-colors">
              <Icon name="X" size={10} />
            </button>
          </div>
        ))}
        {curve.length === 0 && (
          <p className="text-xs text-center py-2" style={{ color: "#475569" }}>
            Нет точек. Нажмите «+ Точка» или выберите пресет.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function FanPropertiesPanel({ fan, onUpdate, onClose, onDelete, inputCls }: Props) {
  const [tab, setTab] = useState<Tab>("general");

  const curve: [number,number][] = fan.fanCurve ?? [];
  const effCurve: [number,number][] = fan.fanEffCurve ?? [];

  const applyPreset = (name: string) => {
    const p = FAN_PRESETS[name];
    if (!p) return;
    onUpdate({
      fanModel: name,
      fanCurve: p.curve,
      fanEffCurve: p.eff,
      fanMotorPower: p.power,
      fanDiameter: p.diameter,
      label: name,
    });
  };

  // Интерполяция рабочей точки по заданному Q
  const interpolateP = (q: number): number => {
    if (curve.length < 2) return 0;
    for (let i = 0; i < curve.length - 1; i++) {
      const [q1, p1] = curve[i], [q2, p2] = curve[i + 1];
      if (q >= q1 && q <= q2) {
        const t = (q - q1) / (q2 - q1);
        return p1 + t * (p2 - p1);
      }
    }
    return 0;
  };

  const workQ = fan.fanWorkQ ?? 0;
  const workP = workQ > 0 ? interpolateP(workQ) : (fan.fanWorkP ?? 0);

  const TABS = [
    { id: "general" as Tab, label: "Общие" },
    { id: "curve"   as Tab, label: "Хар-ка Q-P" },
    { id: "calc"    as Tab, label: "Расчёт" },
  ];

  const inp = `w-full rounded border px-2 py-1 text-xs font-mono outline-none transition-colors`;
  const inpStyle = { background: "#1e293b", borderColor: "#334155", color: "#e2e8f0" };
  const labelCls = "text-xs flex-shrink-0 w-28";

  return (
    <div className="flex h-full flex-col" style={{ background: "#0f172a", color: "#e2e8f0" }}>

      {/* Шапка */}
      <div className="flex flex-shrink-0 items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: "#1e293b", background: "#1e3a5f" }}>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded"
            style={{ background: fan.color ?? "#f59e0b", opacity: 0.9 }}>
            <Icon name="Loader" size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white">
            {fan.label || fan.fanModel || "Вентилятор"}
          </span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <Icon name="X" size={14} />
        </button>
      </div>

      {/* Вкладки */}
      <div className="flex flex-shrink-0 border-b" style={{ borderColor: "#1e293b" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-1.5 text-xs font-medium border-b-2 transition-all"
            style={{
              borderColor: tab === t.id ? "#60a5fa" : "transparent",
              color: tab === t.id ? "#60a5fa" : "#475569",
              background: "transparent",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">

        {/* ── Общие ── */}
        {tab === "general" && (
          <>
            {/* Пресеты */}
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "#94a3b8" }}>
                Пресет вентилятора
              </p>
              <select
                className="w-full rounded border px-2 py-1.5 text-xs outline-none"
                style={{ ...inpStyle }}
                value={fan.fanModel ?? ""}
                onChange={e => applyPreset(e.target.value)}>
                <option value="">— выбрать модель —</option>
                {Object.keys(FAN_PRESETS).map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            <div className="h-px" style={{ background: "#1e293b" }} />

            {/* Поля */}
            {[
              { label: "Модель:", key: "fanModel" as const,        placeholder: "ВОД-40" },
              { label: "Диаметр, мм:", key: "fanDiameter" as const, placeholder: "4000" },
              { label: "Об/мин:", key: "fanRPM" as const,          placeholder: "745" },
              { label: "Угол лопаток:", key: "fanBladeAngle" as const, placeholder: "35°" },
              { label: "Мощность, кВт:", key: "fanMotorPower" as const, placeholder: "2×800" },
              { label: "Напряжение, В:", key: "fanMotorVoltage" as const, placeholder: "6000" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="flex items-center gap-2">
                <span className={labelCls} style={{ color: "#64748b" }}>{label}</span>
                <input className={inp} style={inpStyle}
                  value={fan[key] ?? ""} placeholder={placeholder}
                  onChange={e => onUpdate({ [key]: e.target.value })} />
              </div>
            ))}

            {/* Тип привода */}
            <div className="flex items-center gap-2">
              <span className={labelCls} style={{ color: "#64748b" }}>Привод:</span>
              <select className="flex-1 rounded border px-2 py-1 text-xs outline-none"
                style={{ ...inpStyle }}
                value={fan.fanDriveType ?? ""}
                onChange={e => onUpdate({ fanDriveType: e.target.value })}>
                <option value="">—</option>
                {DRIVE_TYPES.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>

            {/* Дата установки */}
            <div className="flex items-center gap-2">
              <span className={labelCls} style={{ color: "#64748b" }}>Установлен:</span>
              <div className="flex flex-1 gap-1">
                <input className="rounded border px-1.5 py-1 text-xs font-mono w-14 outline-none"
                  style={inpStyle} placeholder="Год" type="number"
                  value={fan.fanInstallYear ?? ""}
                  onChange={e => onUpdate({ fanInstallYear: e.target.value })} />
                <select className="flex-1 rounded border px-1 py-1 text-xs outline-none"
                  style={inpStyle}
                  value={fan.fanInstallMonth ?? ""}
                  onChange={e => onUpdate({ fanInstallMonth: e.target.value })}>
                  <option value="">Мес.</option>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Примечания */}
            <div>
              <p className="text-xs mb-1" style={{ color: "#64748b" }}>Примечания:</p>
              <textarea className="w-full rounded border px-2 py-1.5 text-xs outline-none resize-none"
                style={{ ...inpStyle, minHeight: 52 }}
                value={fan.fanRemarks ?? ""}
                onChange={e => onUpdate({ fanRemarks: e.target.value })}
                placeholder="Замечания по эксплуатации..." />
            </div>
          </>
        )}

        {/* ── Характеристика Q-P ── */}
        {tab === "curve" && (
          <>
            {/* Пресет */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs" style={{ color: "#64748b" }}>Загрузить пресет:</span>
              <select className="flex-1 rounded border px-2 py-1 text-xs outline-none"
                style={inpStyle}
                onChange={e => e.target.value && applyPreset(e.target.value)}
                defaultValue="">
                <option value="">—</option>
                {Object.keys(FAN_PRESETS).map(k => <option key={k}>{k}</option>)}
              </select>
            </div>

            {/* График */}
            {curve.length >= 2 ? (
              <div className="rounded-lg overflow-hidden"
                style={{ background: "#0f172a", padding: 2 }}>
                <QPChart curve={curve} effCurve={effCurve}
                  workQ={workQ > 0 ? workQ : undefined}
                  workP={workQ > 0 ? workP : undefined} />
                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <div className="h-0.5 w-5 rounded" style={{ background: "#60a5fa" }} />
                    <span className="text-xs" style={{ color: "#64748b" }}>Q-P</span>
                  </div>
                  {effCurve.length >= 2 && (
                    <div className="flex items-center gap-1.5">
                      <div className="h-0.5 w-5 rounded border-dashed" style={{ background: "#fbbf24" }} />
                      <span className="text-xs" style={{ color: "#64748b" }}>КПД, %</span>
                    </div>
                  )}
                  {workQ > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ background: "#ef4444" }} />
                      <span className="text-xs" style={{ color: "#64748b" }}>Рабочая точка</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg py-8"
                style={{ background: "#1e293b", border: "1px dashed #334155" }}>
                <Icon name="TrendingUp" size={28} style={{ color: "#334155" }} />
                <p className="text-xs mt-2" style={{ color: "#475569" }}>
                  Добавьте точки кривой или выберите пресет
                </p>
              </div>
            )}

            <div className="h-px" style={{ background: "#1e293b" }} />

            {/* Редактор Q-P */}
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "#94a3b8" }}>Кривая Q-P</p>
              <CurveEditor
                curve={curve}
                onChange={c => onUpdate({ fanCurve: c })}
                label={["Q", "P"]}
                unit={["м³/с", "Па"]}
              />
            </div>

            <div className="h-px" style={{ background: "#1e293b" }} />

            {/* Редактор КПД */}
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "#94a3b8" }}>Кривая КПД (необязательно)</p>
              <CurveEditor
                curve={effCurve}
                onChange={c => onUpdate({ fanEffCurve: c })}
                label={["Q", "η"]}
                unit={["м³/с", "%"]}
              />
            </div>
          </>
        )}

        {/* ── Расчёт (рабочая точка) ── */}
        {tab === "calc" && (
          <>
            <p className="text-xs font-semibold mb-2" style={{ color: "#94a3b8" }}>Рабочая точка</p>

            <div className="flex items-center gap-2 mb-1.5">
              <span className={labelCls} style={{ color: "#64748b" }}>Q расчётный:</span>
              <input className={inp} style={inpStyle} type="number" step="1"
                value={fan.fanWorkQ ?? ""}
                onChange={e => onUpdate({ fanWorkQ: parseFloat(e.target.value) || 0 })}
                placeholder="м³/с" />
            </div>

            {workQ > 0 && curve.length >= 2 && (
              <>
                <div className="rounded-lg p-3 mb-2"
                  style={{ background: "#1e293b", border: "1px solid #334155" }}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs" style={{ color: "#64748b" }}>Q:</span>
                    <span className="font-mono text-xs font-bold" style={{ color: "#60a5fa" }}>
                      {workQ.toFixed(1)} м³/с
                    </span>
                  </div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs" style={{ color: "#64748b" }}>P (из кривой):</span>
                    <span className="font-mono text-xs font-bold" style={{ color: "#4ade80" }}>
                      {workP.toFixed(0)} Па
                    </span>
                  </div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs" style={{ color: "#64748b" }}>v = Q/S (S=16м²):</span>
                    <span className="font-mono text-xs" style={{ color: "#e2e8f0" }}>
                      {(workQ / 16).toFixed(1)} м/с
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs" style={{ color: "#64748b" }}>Мощность P·Q:</span>
                    <span className="font-mono text-xs font-bold" style={{ color: "#fbbf24" }}>
                      {Math.round(workP * workQ / 1000)} кВт
                    </span>
                  </div>
                </div>

                {/* Мини-график с рабочей точкой */}
                <div className="rounded-lg overflow-hidden"
                  style={{ background: "#0f172a", padding: 2 }}>
                  <QPChart curve={curve} effCurve={effCurve.length >= 2 ? effCurve : undefined}
                    workQ={workQ} workP={workP} />
                </div>
              </>
            )}

            {curve.length < 2 && (
              <div className="rounded-lg p-3 text-center"
                style={{ background: "#1e293b", border: "1px dashed #334155" }}>
                <p className="text-xs" style={{ color: "#475569" }}>
                  Задайте кривую Q-P на вкладке «Хар-ка Q-P»
                </p>
              </div>
            )}

            <div className="h-px" style={{ background: "#1e293b" }} />

            {/* Проверка нормативов */}
            {workQ > 0 && curve.length >= 2 && (
              <div>
                <p className="text-xs font-semibold mb-1.5" style={{ color: "#94a3b8" }}>
                  Проверка нормативов
                </p>
                {[
                  {
                    label: "Резерв производительности ≥ 20%",
                    maxQ: Math.max(...curve.map(p => p[0])),
                    ok: workQ <= Math.max(...curve.map(p => p[0])) * 0.8,
                    value: `${((1 - workQ / Math.max(...curve.map(p => p[0]))) * 100).toFixed(0)}%`,
                  },
                  {
                    label: "Давление не менее 200 Па",
                    ok: workP >= 200,
                    value: `${workP.toFixed(0)} Па`,
                  },
                ].map(check => (
                  <div key={check.label} className="flex items-center gap-2 mb-1 py-1 px-2 rounded"
                    style={{ background: check.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" }}>
                    <Icon name={check.ok ? "CheckCircle" : "AlertCircle"} size={13}
                      style={{ color: check.ok ? "#22c55e" : "#ef4444", flexShrink: 0 }} />
                    <span className="flex-1 text-xs" style={{ color: "#94a3b8" }}>{check.label}</span>
                    <span className="font-mono text-xs font-bold"
                      style={{ color: check.ok ? "#22c55e" : "#ef4444" }}>
                      {check.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Удалить */}
      <div className="flex-shrink-0 border-t p-2" style={{ borderColor: "#1e293b" }}>
        <button onClick={onDelete}
          className="flex w-full items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-all hover:opacity-80"
          style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
          <Icon name="Trash2" size={12} />
          Удалить вентилятор
        </button>
      </div>
    </div>
  );
}