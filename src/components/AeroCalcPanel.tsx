import React, { useState } from "react";
import Icon from "@/components/ui/icon";
import { CalcResult, CalcAirway, CalcNode } from "@/lib/aeroCalc";

interface Props {
  result: CalcResult | null;
  nodes: CalcNode[];
  airways: CalcAirway[];
  onClose: () => void;
  onRecalc: () => void;
  isRunning: boolean;
}

type Tab = "overview" | "nodes" | "airways" | "warnings";

const fmt1 = (v: number) => v.toFixed(1);
const fmt2 = (v: number) => v.toFixed(2);
const fmt0 = (v: number) => Math.round(v).toLocaleString("ru");

// Цвет скорости: зелёный < 4, жёлтый 4-8, красный > 8 м/с
const velColor = (v: number) =>
  v > 8 ? "#ef4444" : v > 4 ? "#f59e0b" : "#22c55e";

// Цвет давления относительно нормы
const pressColor = (p: number) => {
  const diff = Math.abs(p - 101325);
  if (diff > 5000) return "#f87171";
  if (diff > 2000) return "#fbbf24";
  return "#4ade80";
};

export default function AeroCalcPanel({ result, nodes, airways, onClose, onRecalc, isRunning }: Props) {
  const [tab, setTab] = useState<Tab>("overview");

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "overview",  label: "Сводка",     icon: "LayoutDashboard" },
    { id: "nodes",     label: "Узлы",       icon: "Circle" },
    { id: "airways",   label: "Выработки",  icon: "Minus" },
    { id: "warnings",  label: `Сообщения${result ? ` (${result.errors.length + result.warnings.length})` : ""}`, icon: "AlertTriangle" },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end pointer-events-none">
      <div className="pointer-events-auto flex flex-col rounded-tl-xl shadow-2xl overflow-hidden"
        style={{ width: 520, height: "80vh", background: "#fff", border: "1px solid #e2e8f0" }}>

        {/* Шапка */}
        <div className="flex flex-shrink-0 items-center justify-between px-4 py-3"
          style={{ background: "#1e3a5f" }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded"
              style={{ background: "rgba(255,255,255,0.12)" }}>
              <Icon name="Calculator" size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">Аэродинамический расчёт</p>
              {result && (
                <p className="text-xs mt-0.5" style={{ color: result.converged ? "#4ade80" : "#fbbf24" }}>
                  {result.converged ? `Сошёлся за ${result.iterations} итераций` : `Не сошёлся (${result.iterations} ит.)`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRecalc} disabled={isRunning}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: "#22c55e", color: "#fff" }}>
              {isRunning
                ? <><Icon name="Loader" size={12} className="animate-spin" />Расчёт...</>
                : <><Icon name="Play" size={12} />Пересчитать</>}
            </button>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex flex-shrink-0 border-b border-slate-100">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all"
              style={{
                borderColor: tab === t.id ? "#1e3a5f" : "transparent",
                color: tab === t.id ? "#1e3a5f" : "#94a3b8",
              }}>
              <Icon name={t.icon} size={11} fallback="Circle" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!result ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <Icon name="Calculator" size={40} className="text-slate-200" />
              <p className="text-sm">Нажмите «Пересчитать» для запуска расчёта</p>
              <p className="text-xs text-center px-8 text-slate-300">
                Расчёт определит давление, расходы воздуха и температуру<br />
                во всех узлах и выработках схемы
              </p>
            </div>
          ) : (
            <>
              {/* ── Сводка ── */}
              {tab === "overview" && (
                <div className="p-4 space-y-4">
                  {/* KPI карточки */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Суммарный расход", value: fmt1(result.totalFlow), unit: "м³/с", icon: "Wind", color: "#22c55e" },
                      { label: "Узлов в сети",     value: String(nodes.length),   unit: "узл.", icon: "Circle", color: "#3b82f6" },
                      { label: "Выработок",        value: String(airways.length), unit: "шт.", icon: "Minus", color: "#8b5cf6" },
                      {
                        label: "Макс. скорость",
                        value: fmt1(Math.max(0, ...Object.values(result.airwayV))),
                        unit: "м/с",
                        icon: "Zap",
                        color: Math.max(0, ...Object.values(result.airwayV)) > 8 ? "#ef4444" : "#f59e0b",
                      },
                    ].map(card => (
                      <div key={card.label} className="rounded-xl p-3"
                        style={{ background: card.color + "10", border: `1px solid ${card.color}30` }}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Icon name={card.icon} size={13} style={{ color: card.color }} fallback="Circle" />
                          <span className="text-xs text-slate-500">{card.label}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono text-xl font-bold" style={{ color: card.color }}>{card.value}</span>
                          <span className="text-xs text-slate-400">{card.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Диаграмма давлений (нормализованная) */}
                  {Object.keys(result.nodePressure).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-2">Давление в узлах</p>
                      <div className="space-y-1.5">
                        {Object.entries(result.nodePressure)
                          .sort(([,a],[,b]) => b - a)
                          .slice(0, 8)
                          .map(([nodeId, p]) => {
                            const allP = Object.values(result.nodePressure);
                            const minP = Math.min(...allP);
                            const maxP = Math.max(...allP);
                            const range = maxP - minP || 1;
                            const pct = ((p - minP) / range) * 100;
                            return (
                              <div key={nodeId}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-xs text-slate-500 truncate max-w-32">
                                    {nodes.find(n => n.id === nodeId)?.id.replace("n_","") ?? nodeId}
                                  </span>
                                  <span className="font-mono text-xs font-medium" style={{ color: pressColor(p) }}>
                                    {fmt0(p)} Па
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div className="h-full rounded-full transition-all"
                                    style={{ width: `${pct}%`, background: pressColor(p) }} />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Расходы по выработкам (топ) */}
                  {Object.keys(result.airwayQ).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-2">Расходы воздуха (топ выработок)</p>
                      <div className="space-y-1.5">
                        {Object.entries(result.airwayQ)
                          .sort(([,a],[,b]) => Math.abs(b) - Math.abs(a))
                          .slice(0, 6)
                          .map(([awId, q]) => {
                            const aw = airways.find(a => a.id === awId);
                            const v = result.airwayV[awId] ?? 0;
                            return (
                              <div key={awId} className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-600 truncate">
                                      {aw?.label ?? awId}
                                    </span>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                      <span className="font-mono text-xs font-bold text-blue-600">
                                        {fmt1(Math.abs(q))} м³/с
                                      </span>
                                      <span className="font-mono text-xs rounded px-1"
                                        style={{ background: velColor(v) + "20", color: velColor(v) }}>
                                        {fmt1(v)} м/с
                                      </span>
                                    </div>
                                  </div>
                                  {/* Стрелка направления */}
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-xs text-slate-400">
                                      {result.airwayDir[awId] === 1 ? "→" : "←"}
                                      {" "}ΔP={fmt0(Math.abs(result.airwayDeltaP[awId] ?? 0))} Па
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Узлы ── */}
              {tab === "nodes" && (
                <div className="p-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th className="text-left px-2 py-1.5 text-slate-500 font-medium">Узел</th>
                        <th className="text-right px-2 py-1.5 text-slate-500 font-medium">Z, м</th>
                        <th className="text-right px-2 py-1.5 text-slate-500 font-medium">P, Па</th>
                        <th className="text-right px-2 py-1.5 text-slate-500 font-medium">T, °C</th>
                        <th className="text-right px-2 py-1.5 text-slate-500 font-medium">CH₄, %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodes.map((n, i) => {
                        const p = result.nodePressure[n.id] ?? 0;
                        const t = result.nodeAirTemp[n.id] ?? n.airTemp;
                        const gas = result.nodeGasConc[n.id] ?? 0;
                        return (
                          <tr key={n.id}
                            style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                            className="border-b border-slate-50">
                            <td className="px-2 py-1.5">
                              <span className="font-mono text-slate-600 truncate block max-w-28">
                                {n.id.replace("n_", "")}
                              </span>
                              {n.connectedToAtm && (
                                <span className="text-xs rounded px-1" style={{ background: "#dbeafe", color: "#1d4ed8" }}>
                                  атм.
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-600">{n.coordZ}</td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono font-semibold" style={{ color: pressColor(p) }}>
                                {fmt0(p)}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono" style={{ color: t > 30 ? "#f59e0b" : t < 5 ? "#60a5fa" : "#22c55e" }}>
                                {fmt1(t)}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono" style={{ color: gas > 1 ? "#ef4444" : gas > 0.5 ? "#f59e0b" : "#64748b" }}>
                                {fmt2(gas)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Выработки ── */}
              {tab === "airways" && (
                <div className="p-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th className="text-left px-2 py-1.5 text-slate-500 font-medium">Выработка</th>
                        <th className="text-right px-2 py-1.5 text-slate-500 font-medium">Q, м³/с</th>
                        <th className="text-right px-2 py-1.5 text-slate-500 font-medium">v, м/с</th>
                        <th className="text-right px-2 py-1.5 text-slate-500 font-medium">ΔP, Па</th>
                        <th className="text-right px-2 py-1.5 text-slate-500 font-medium">R, кмург</th>
                      </tr>
                    </thead>
                    <tbody>
                      {airways.map((aw, i) => {
                        const q   = result.airwayQ[aw.id] ?? 0;
                        const v   = result.airwayV[aw.id] ?? 0;
                        const dp  = result.airwayDeltaP[aw.id] ?? 0;
                        const r   = result.airwayR[aw.id] ?? 0;
                        const dir = result.airwayDir[aw.id] ?? 1;
                        return (
                          <tr key={aw.id}
                            style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                            className="border-b border-slate-50">
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1">
                                <span className="text-xs" style={{ color: dir === 1 ? "#22c55e" : "#f87171" }}>
                                  {dir === 1 ? "→" : "←"}
                                </span>
                                <span className="font-mono text-slate-600 truncate max-w-28 block">
                                  {aw.label ?? aw.id}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400">
                                L={fmt1(aw.length)}м  S={fmt2(aw.section)}м²
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono font-bold text-blue-600">{fmt1(Math.abs(q))}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono font-semibold" style={{ color: velColor(v) }}>
                                {fmt1(v)}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-600">
                              {fmt0(Math.abs(dp))}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-500">
                              {r.toExponential(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Сообщения ── */}
              {tab === "warnings" && (
                <div className="p-4 space-y-2">
                  {result.errors.length === 0 && result.warnings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ background: "#f0fdf4" }}>
                        <Icon name="CheckCircle" size={24} className="text-green-500" />
                      </div>
                      <p className="text-sm font-medium text-green-600">Нет ошибок и предупреждений</p>
                    </div>
                  ) : (
                    <>
                      {result.errors.map((e, i) => (
                        <div key={i} className="flex gap-2 rounded-lg p-3"
                          style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                          <Icon name="AlertCircle" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700">{e}</p>
                        </div>
                      ))}
                      {result.warnings.map((w, i) => (
                        <div key={i} className="flex gap-2 rounded-lg p-3"
                          style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                          <Icon name="AlertTriangle" size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">{w}</p>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Параметры расчёта */}
                  <div className="mt-4 rounded-lg p-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <p className="text-xs font-semibold text-slate-600 mb-2">Параметры расчёта</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span className="text-slate-400">Итераций:</span>
                      <span className="font-mono text-slate-700">{result.iterations}</span>
                      <span className="text-slate-400">Сходимость:</span>
                      <span className="font-mono" style={{ color: result.converged ? "#22c55e" : "#f59e0b" }}>
                        {result.converged ? "Да" : "Нет"}
                      </span>
                      <span className="text-slate-400">Метод:</span>
                      <span className="font-mono text-slate-700">Харди-Кросс</span>
                      <span className="text-slate-400">Узлов:</span>
                      <span className="font-mono text-slate-700">{nodes.length}</span>
                      <span className="text-slate-400">Рёбер:</span>
                      <span className="font-mono text-slate-700">{airways.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
