import React, { useState } from "react";
import Icon from "@/components/ui/icon";

// ─── Тип узла ─────────────────────────────────────────────────────────────────
export interface NodeProperties {
  id: string;
  // Общие
  name: string;
  number: string;
  // Физические координаты
  coordX: number;
  coordY: number;
  coordZ: number;  // высотная отметка
  // Вентиляция
  airTemp: number;           // температура воздуха, °C
  connectedToAtm: boolean;   // связь с атмосферой
  // Теплофизика
  wallTemp: number;          // температура стенок, °C
  // Воздушная съёмка
  appliedPressure: number;   // приведённое давление, Па
  // Вычисленные (только чтение)
  calcGasConc: number;       // концентрация газа, %
  calcAirTemp: number;       // температура воздуха вычисл., °C
  calcWallTemp: number;      // температура стенок вычисл., °C
  calcPressure: number;      // давление, Па
  calcExplosionPressure: number; // давление взрыва, кПа
}

// Замер
export interface NodeMeasurement {
  id: string;
  date: string;
  param: string;
  value: string;
  unit: string;
  author: string;
}

// Труба (подключённые)
export interface NodePipe {
  id: string;
  name: string;
  diameter: string;
  length: string;
  material: string;
}

// Индикатор
export interface NodeIndicator {
  id: string;
  name: string;
  type: string;
  value: string;
  status: "ok" | "warn" | "alarm";
}

export function defaultNode(id: string, x: number, y: number, z?: number): NodeProperties {
  return {
    id,
    name: "",
    number: "",
    coordX: Math.round(x),
    coordY: Math.round(y),
    coordZ: z !== undefined ? Math.round(z) : -419,
    airTemp: 20,
    connectedToAtm: false,
    wallTemp: 20,
    appliedPressure: 0,
    calcGasConc: 0,
    calcAirTemp: 20,
    calcWallTemp: 0,
    calcPressure: 608,
    calcExplosionPressure: 0,
  };
}

// ─── Стили ────────────────────────────────────────────────────────────────────
const inp = "w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-400 transition-colors";
const inpRo = "w-full rounded border border-slate-100 bg-slate-50 px-2 py-1 text-xs text-slate-600 outline-none cursor-default";
const row = "flex items-center justify-between gap-2 py-0.5";
const rowLabel = "flex-shrink-0 text-xs text-slate-500 w-36";
const sectionTitle = "text-xs font-semibold text-slate-700 mt-3 mb-1 pb-0.5 border-b border-slate-100";
const calcSection = "text-xs font-bold text-slate-800 mt-3 mb-1 pb-0.5 border-b border-slate-200";

type Tab = "params" | "measures" | "pipes" | "indicators";

interface Props {
  node: NodeProperties;
  measures: NodeMeasurement[];
  pipes: NodePipe[];
  indicators: NodeIndicator[];
  onUpdate: (patch: Partial<NodeProperties>) => void;
  onClose: () => void;
}

export default function NodePropertiesPanel({
  node, measures, pipes, indicators, onUpdate, onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("params");

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "params",     label: "Параметры",  icon: "Settings2" },
    { id: "measures",   label: "Замеры",     icon: "Gauge" },
    { id: "pipes",      label: "Трубы",      icon: "Pipette" },
    { id: "indicators", label: "Индикаторы", icon: "Activity" },
  ];

  const statusColor: Record<NodeIndicator["status"], string> = {
    ok: "#22c55e", warn: "#f59e0b", alarm: "#ef4444",
  };

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-white" style={{ width: 260 }}>
      {/* Шапка */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2"
        style={{ background: "#1e3a5f" }}>
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/30">
            <Icon name="Circle" size={10} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-white">
            {node.name || node.number ? `Узел ${node.number || node.name}` : "Свойства узла"}
          </span>
        </div>
        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
          <Icon name="X" size={13} />
        </button>
      </div>

      {/* Вкладки — вертикальные как в оригинале */}
      <div className="flex flex-1 min-h-0">
        <div className="flex w-8 flex-col border-r border-slate-100 bg-slate-50">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              title={t.label}
              className="flex flex-col items-center py-3 gap-1 transition-all"
              style={{
                background: tab === t.id ? "#fff" : "transparent",
                borderRight: tab === t.id ? "2px solid #1e3a5f" : "2px solid transparent",
                color: tab === t.id ? "#1e3a5f" : "#94a3b8",
              }}>
              {/* Вертикальный текст */}
              <span style={{
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                transform: "rotate(180deg)",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.05em",
                lineHeight: 1,
              }}>
                {t.label}
              </span>
            </button>
          ))}
        </div>

        {/* Содержимое вкладки */}
        <div className="flex-1 overflow-y-auto p-3">

          {/* ── Параметры ──────────────────────────────────────────────────────── */}
          {tab === "params" && (
            <div className="space-y-0">
              {/* Выбор из дропдауна — заголовок как в оригинале */}
              <div className="mb-3 flex items-center gap-1 rounded border border-slate-200 px-2 py-1"
                style={{ background: "#f8fafc" }}>
                <Icon name="ChevronLeft" size={10} className="text-slate-400" />
                <select className="flex-1 bg-transparent text-xs font-medium text-slate-600 outline-none"
                  defaultValue="properties">
                  <option value="properties">Свойства</option>
                </select>
              </div>

              <p className={sectionTitle}>Общие свойства</p>

              <div className={row}>
                <span className={rowLabel}>Название:</span>
                <input className={inp} value={node.name}
                  onChange={e => onUpdate({ name: e.target.value })} />
              </div>
              <div className={row}>
                <span className={rowLabel}>Номер:</span>
                <input className={inp} value={node.number}
                  onChange={e => onUpdate({ number: e.target.value })} />
              </div>

              <p className={sectionTitle}>Физические координаты</p>

              <div className={row}>
                <span className={rowLabel}>Высотная отметка Z:</span>
                <div className="flex items-center gap-1 flex-1">
                  <input className={inp} type="number" value={node.coordZ}
                    onChange={e => onUpdate({ coordZ: parseFloat(e.target.value) || 0 })} />
                  <span className="text-xs text-slate-400 flex-shrink-0">м</span>
                </div>
              </div>
              <div className={row}>
                <span className={rowLabel}>Координата X:</span>
                <div className="flex items-center gap-1 flex-1">
                  <input className={inp} type="number" value={node.coordX}
                    onChange={e => onUpdate({ coordX: parseFloat(e.target.value) || 0 })} />
                  <span className="text-xs text-slate-400 flex-shrink-0">м</span>
                </div>
              </div>
              <div className={row}>
                <span className={rowLabel}>Координата Y:</span>
                <div className="flex items-center gap-1 flex-1">
                  <input className={inp} type="number" value={node.coordY}
                    onChange={e => onUpdate({ coordY: parseFloat(e.target.value) || 0 })} />
                  <span className="text-xs text-slate-400 flex-shrink-0">м</span>
                </div>
              </div>

              <p className={sectionTitle}>Вентиляция</p>

              <div className={row}>
                <span className={rowLabel}>Температура воздуха:</span>
                <div className="flex items-center gap-1 flex-1">
                  <input className={inp} type="number" value={node.airTemp}
                    onChange={e => onUpdate({ airTemp: parseFloat(e.target.value) || 0 })} />
                  <span className="text-xs text-slate-400 flex-shrink-0">°C</span>
                </div>
              </div>
              <div className={row}>
                <span className={rowLabel}>Связь с атмосферой:</span>
                <div className="flex flex-1 justify-end">
                  <input type="checkbox" checked={node.connectedToAtm}
                    onChange={e => onUpdate({ connectedToAtm: e.target.checked })}
                    className="h-3.5 w-3.5 cursor-pointer" />
                </div>
              </div>

              <p className={sectionTitle}>Теплофизика</p>

              <div className={row}>
                <span className={rowLabel}>Температура стенок:</span>
                <div className="flex items-center gap-1 flex-1">
                  <input className={inp} type="number" value={node.wallTemp}
                    onChange={e => onUpdate({ wallTemp: parseFloat(e.target.value) || 0 })} />
                  <span className="text-xs text-slate-400 flex-shrink-0">°C</span>
                </div>
              </div>

              <p className={calcSection}>Вычисленные параметры</p>

              <div className={row}>
                <span className={rowLabel}>Концентрация газа:</span>
                <div className="flex items-center gap-1 flex-1">
                  <input className={inpRo} readOnly value={node.calcGasConc} />
                  <span className="text-xs text-slate-400 flex-shrink-0">%</span>
                </div>
              </div>
              <div className={row}>
                <span className={rowLabel}>Температура воздуха:</span>
                <div className="flex items-center gap-1 flex-1">
                  <input className={inpRo} readOnly value={node.calcAirTemp} />
                  <span className="text-xs text-slate-400 flex-shrink-0">°C</span>
                </div>
              </div>
              <div className={row}>
                <span className={rowLabel}>Температура стенок:</span>
                <div className="flex items-center gap-1 flex-1">
                  <input className={inpRo} readOnly value={node.calcWallTemp} />
                  <span className="text-xs text-slate-400 flex-shrink-0">°C</span>
                </div>
              </div>

              <p className={sectionTitle}>Воздушная съёмка</p>

              <div className={row}>
                <span className={rowLabel}>Приведённое давление:</span>
                <div className="flex items-center gap-1 flex-1">
                  <input className={inp} type="number" value={node.appliedPressure}
                    onChange={e => onUpdate({ appliedPressure: parseFloat(e.target.value) || 0 })} />
                  <span className="text-xs text-slate-400 flex-shrink-0">Па</span>
                </div>
              </div>

              <p className={calcSection}>Вычисленные параметры</p>

              <div className={row}>
                <span className={rowLabel}>Давление:</span>
                <div className="flex items-center gap-1 flex-1">
                  <input className={inpRo} readOnly value={node.calcPressure} />
                  <span className="text-xs text-slate-400 flex-shrink-0">Па</span>
                </div>
              </div>

              <p className={sectionTitle}>Аварии</p>
              <p className={calcSection}>Вычисленные параметры</p>

              <div className={row}>
                <span className={rowLabel}>Давление взрыва:</span>
                <div className="flex items-center gap-1 flex-1">
                  <input className={inpRo} readOnly value={node.calcExplosionPressure} />
                  <span className="text-xs text-slate-400 flex-shrink-0">кПа</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Замеры ─────────────────────────────────────────────────────────── */}
          {tab === "measures" && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Замеры в узле</p>
              {measures.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Icon name="Gauge" size={28} className="text-slate-200" />
                  <p className="text-xs text-slate-400 text-center">Нет замеров.<br />Добавьте первый замер.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {measures.map(m => (
                    <div key={m.id} className="rounded-lg border border-slate-100 p-2.5"
                      style={{ background: "#f8fafc" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700">{m.param}</span>
                        <span className="font-mono text-xs text-slate-500">{m.date}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-sm font-bold text-slate-800">{m.value}</span>
                        <span className="text-xs text-slate-500">{m.unit}</span>
                      </div>
                      {m.author && <p className="mt-0.5 text-xs text-slate-400">{m.author}</p>}
                    </div>
                  ))}
                </div>
              )}
              <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-slate-200 py-2 text-xs text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                <Icon name="Plus" size={12} />
                Добавить замер
              </button>
            </div>
          )}

          {/* ── Трубы ──────────────────────────────────────────────────────────── */}
          {tab === "pipes" && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Подключённые трубы</p>
              {pipes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Icon name="Pipette" size={28} className="text-slate-200" />
                  <p className="text-xs text-slate-400 text-center">Нет подключённых труб.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pipes.map(p => (
                    <div key={p.id} className="rounded-lg border border-slate-100 p-2.5"
                      style={{ background: "#f8fafc" }}>
                      <p className="text-xs font-medium text-slate-700 mb-1">{p.name}</p>
                      <div className="grid grid-cols-2 gap-1 text-xs text-slate-500">
                        <span>Ø {p.diameter}</span>
                        <span>L={p.length} м</span>
                        <span className="col-span-2">{p.material}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-slate-200 py-2 text-xs text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                <Icon name="Plus" size={12} />
                Добавить трубу
              </button>
            </div>
          )}

          {/* ── Индикаторы ─────────────────────────────────────────────────────── */}
          {tab === "indicators" && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Индикаторы</p>
              {indicators.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Icon name="Activity" size={28} className="text-slate-200" />
                  <p className="text-xs text-slate-400 text-center">Нет индикаторов.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {indicators.map(ind => (
                    <div key={ind.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2"
                      style={{ background: "#f8fafc" }}>
                      <div className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ background: statusColor[ind.status] }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{ind.name}</p>
                        <p className="text-xs text-slate-400">{ind.type}</p>
                      </div>
                      <span className="font-mono text-xs font-bold flex-shrink-0"
                        style={{ color: statusColor[ind.status] }}>
                        {ind.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
