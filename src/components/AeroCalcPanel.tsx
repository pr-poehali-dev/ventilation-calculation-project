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

type Tab = "overview" | "nodes" | "airways" | "loops" | "warnings";

const fmt1 = (v: number) => v.toFixed(1);
const fmt2 = (v: number) => v.toFixed(2);
const fmt0 = (v: number) => Math.round(v).toLocaleString("ru");

const velColor  = (v: number) => v > 8 ? "#ef4444" : v > 4 ? "#f59e0b" : "#22c55e";
const pressColor = (p: number) => {
  const d = Math.abs(p - 101325);
  return d > 5000 ? "#f87171" : d > 2000 ? "#fbbf24" : "#4ade80";
};

// Маленький Spark-бар для визуализации расхода
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function AeroCalcPanel({ result, nodes, airways, onClose, onRecalc, isRunning }: Props) {
  const [tab, setTab] = useState<Tab>("overview");

  const TABS: { id: Tab; label: string; icon: string; count?: number }[] = [
    { id: "overview",  label: "Сводка",    icon: "LayoutDashboard" },
    { id: "nodes",     label: "Узлы",      icon: "Circle",      count: nodes.length },
    { id: "airways",   label: "Ветви",     icon: "Minus",       count: airways.length },
    { id: "loops",     label: "Контуры",   icon: "RefreshCw",   count: result?.loopIds.length },
    { id: "warnings",  label: "Сообщения", icon: "AlertTriangle",
      count: result ? result.errors.length + result.warnings.length : 0 },
  ];

  const maxQ = result ? Math.max(0.01, ...Object.values(result.airwayQ).map(Math.abs)) : 1;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end pointer-events-none">
      <div className="pointer-events-auto flex flex-col overflow-hidden"
        style={{ width: 560, height: "85vh", background: "#0f172a", border: "1px solid #1e293b",
          borderRadius: "12px 0 0 0", boxShadow: "0 0 40px rgba(0,0,0,0.5)" }}>

        {/* ── Шапка ── */}
        <div className="flex flex-shrink-0 items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "#1e293b", background: "#1e3a5f" }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded"
              style={{ background: "rgba(255,255,255,0.1)" }}>
              <Icon name="Calculator" size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">Воздухораспределение</p>
              {result && (
                <p className="text-xs mt-0.5 font-mono" style={{ color: result.converged ? "#4ade80" : "#fbbf24" }}>
                  {result.converged
                    ? `✓ Сошёлся · ${result.iterations} ит. · невязка ${result.maxResidual.toFixed(2)} Па`
                    : `⚠ Не сошёлся · ${result.iterations} ит. · невязка ${result.maxResidual.toFixed(1)} Па`}
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
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* ── Вкладки ── */}
        <div className="flex flex-shrink-0 border-b overflow-x-auto" style={{ borderColor: "#1e293b" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap"
              style={{
                borderColor: tab === t.id ? "#60a5fa" : "transparent",
                color: tab === t.id ? "#60a5fa" : "#475569",
              }}>
              <Icon name={t.icon} size={11} fallback="Circle" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-xs font-mono"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!result ? (
            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "#334155" }}>
              <Icon name="Calculator" size={44} style={{ color: "#1e293b" }} />
              <p className="text-sm">Нажмите «Пересчитать» для запуска расчёта</p>
              <p className="text-xs text-center px-8" style={{ color: "#1e293b" }}>
                Метод Харди-Кросса по независимым контурам сети +<br />
                метод узловых давлений (СЛАУ Гаусс-Зейдель)
              </p>
            </div>
          ) : <>

            {/* ══ Сводка ══ */}
            {tab === "overview" && (
              <div className="p-4 space-y-4">
                {/* KPI */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Суммарный расход",  value: fmt1(result.totalFlow),   unit: "м³/с",  icon: "Wind",    color: "#22c55e" },
                    { label: "Контуров в сети",    value: String(result.loopIds.length), unit: "конт.", icon: "RefreshCw", color: "#60a5fa" },
                    { label: "Макс. скорость",
                      value: fmt1(Math.max(0, ...Object.values(result.airwayV))), unit: "м/с",
                      icon: "Zap",
                      color: Math.max(0, ...Object.values(result.airwayV)) > 8 ? "#ef4444" : "#f59e0b" },
                    { label: "Ошибка баланса",    value: result.balanceError.toFixed(3), unit: "м³/с",
                      icon: "Scale",
                      color: result.balanceError < 0.1 ? "#22c55e" : result.balanceError < 1 ? "#f59e0b" : "#ef4444" },
                  ].map(c => (
                    <div key={c.label} className="rounded-xl p-3 border"
                      style={{ background: c.color + "0d", borderColor: c.color + "30" }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Icon name={c.icon} size={12} style={{ color: c.color }} fallback="Circle" />
                        <span className="text-xs" style={{ color: "#475569" }}>{c.label}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-xl font-bold" style={{ color: c.color }}>{c.value}</span>
                        <span className="text-xs" style={{ color: "#334155" }}>{c.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Сходимость / невязки контуров */}
                {result.loopResiduals.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "#475569" }}>
                      Невязки контуров (Па)
                    </p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {result.loopResiduals.map((r, i) => {
                        const pct = result.maxResidual > 0 ? (r / result.maxResidual) * 100 : 0;
                        const col = r < 1 ? "#22c55e" : r < 10 ? "#f59e0b" : "#ef4444";
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-mono" style={{ color: "#475569" }}>Контур {i + 1}</span>
                              <span className="font-mono text-xs font-semibold" style={{ color: col }}>
                                {r.toFixed(2)} Па
                              </span>
                            </div>
                            <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "#1e293b" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Расходы по ветвям — топ 6 */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#475569" }}>Расходы воздуха (топ ветвей)</p>
                  <div className="space-y-2">
                    {Object.entries(result.airwayQ)
                      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                      .slice(0, 6)
                      .map(([awId, q]) => {
                        const aw  = airways.find(a => a.id === awId);
                        const v   = result.airwayV[awId] ?? 0;
                        const dir = result.airwayDir[awId] ?? 1;
                        return (
                          <div key={awId}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span style={{ color: dir === 1 ? "#22c55e" : "#f87171", fontSize: 11 }}>
                                  {dir === 1 ? "→" : "←"}
                                </span>
                                <span className="text-xs truncate" style={{ color: "#64748b" }}>
                                  {aw?.label ?? awId}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <span className="font-mono text-xs font-bold" style={{ color: "#60a5fa" }}>
                                  {fmt1(Math.abs(q))} м³/с
                                </span>
                                <span className="font-mono text-xs rounded px-1 py-0.5"
                                  style={{ background: velColor(v) + "20", color: velColor(v) }}>
                                  {fmt1(v)} м/с
                                </span>
                              </div>
                            </div>
                            <Bar value={q} max={maxQ} color={velColor(v)} />
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Давления */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#475569" }}>Давление в узлах</p>
                  <div className="space-y-1.5">
                    {Object.entries(result.nodePressure)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 6)
                      .map(([nid, p]) => {
                        const allP  = Object.values(result.nodePressure);
                        const minP  = Math.min(...allP), maxP = Math.max(...allP);
                        const pct   = maxP > minP ? ((p - minP) / (maxP - minP)) * 100 : 50;
                        const col   = pressColor(p);
                        return (
                          <div key={nid}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-mono text-xs truncate max-w-36" style={{ color: "#475569" }}>
                                {nid.replace("n_", "")}
                              </span>
                              <span className="font-mono text-xs font-semibold" style={{ color: col }}>
                                {fmt0(p)} Па
                              </span>
                            </div>
                            <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "#1e293b" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {/* ══ Узлы ══ */}
            {tab === "nodes" && (
              <div className="p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "#1e293b" }}>
                      {["Узел", "Z, м", "P, Па", "T, °C", "CH₄, %", "h_e, Па"].map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-semibold" style={{ color: "#475569" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map((n, i) => {
                      const p    = result.nodePressure[n.id]  ?? 0;
                      const t    = result.nodeAirTemp[n.id]   ?? n.airTemp;
                      const gas  = result.nodeGasConc[n.id]   ?? 0;
                      const he   = result.nodeNatDraft?.[n.id] ?? 0;
                      return (
                        <tr key={n.id} style={{ background: i % 2 === 0 ? "transparent" : "#0d1826", borderColor: "#1e293b" }}
                          className="border-b">
                          <td className="px-2 py-1.5">
                            <span className="font-mono truncate block max-w-28" style={{ color: "#94a3b8" }}>
                              {n.id.replace("n_", "")}
                            </span>
                            {n.connectedToAtm && (
                              <span className="text-xs rounded px-1" style={{ background: "#1e40af22", color: "#60a5fa" }}>атм.</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 font-mono" style={{ color: "#64748b" }}>{n.coordZ}</td>
                          <td className="px-2 py-1.5 font-mono font-semibold" style={{ color: pressColor(p) }}>{fmt0(p)}</td>
                          <td className="px-2 py-1.5 font-mono"
                            style={{ color: t > 30 ? "#f59e0b" : t < 5 ? "#60a5fa" : "#22c55e" }}>{fmt1(t)}</td>
                          <td className="px-2 py-1.5 font-mono"
                            style={{ color: gas > 1 ? "#ef4444" : gas > 0.5 ? "#f59e0b" : "#475569" }}>{fmt2(gas)}</td>
                          <td className="px-2 py-1.5 font-mono" style={{ color: "#64748b" }}>{fmt1(he)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ══ Ветви ══ */}
            {tab === "airways" && (
              <div className="p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "#1e293b" }}>
                      {["Ветвь", "Q, м³/с", "v, м/с", "ΔP, Па", "R, кМюрг", "Вент., Па"].map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-semibold" style={{ color: "#475569" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {airways.map((aw, i) => {
                      const q   = result.airwayQ[aw.id]        ?? 0;
                      const v   = result.airwayV[aw.id]        ?? 0;
                      const dp  = result.airwayDeltaP[aw.id]   ?? 0;
                      const r   = result.airwayR[aw.id]        ?? 0;
                      const fan = result.airwayFanDeltaP?.[aw.id] ?? 0;
                      const dir = result.airwayDir[aw.id]      ?? 1;
                      return (
                        <tr key={aw.id} style={{ background: i % 2 === 0 ? "transparent" : "#0d1826", borderColor: "#1e293b" }}
                          className="border-b">
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1">
                              <span style={{ color: dir === 1 ? "#22c55e" : "#f87171" }}>{dir === 1 ? "→" : "←"}</span>
                              <span className="font-mono truncate max-w-28 block" style={{ color: "#94a3b8" }}>
                                {aw.label ?? aw.id}
                              </span>
                            </div>
                            <span className="text-xs" style={{ color: "#334155" }}>
                              L={fmt1(aw.length)}м  S={fmt2(aw.section)}м²
                            </span>
                          </td>
                          <td className="px-2 py-1.5 font-mono font-bold" style={{ color: "#60a5fa" }}>
                            {fmt1(Math.abs(q))}
                          </td>
                          <td className="px-2 py-1.5 font-mono font-semibold" style={{ color: velColor(v) }}>
                            {fmt1(v)}
                          </td>
                          <td className="px-2 py-1.5 font-mono" style={{ color: "#64748b" }}>
                            {fmt0(Math.abs(dp))}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-xs" style={{ color: "#475569" }}>
                            {r.toExponential(2)}
                          </td>
                          <td className="px-2 py-1.5 font-mono" style={{ color: fan > 0 ? "#fbbf24" : "#334155" }}>
                            {fan > 0 ? fmt0(fan) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ══ Контуры ══ */}
            {tab === "loops" && (
              <div className="p-4 space-y-3">
                <p className="text-xs" style={{ color: "#475569" }}>
                  Метод Харди-Кросса. Независимых контуров: <span className="font-mono font-bold text-white">{result.loopIds.length}</span>.
                  Критерий сходимости: невязка &lt; 0.5 Па по каждому контуру.
                </p>

                {result.loopIds.length === 0 && (
                  <div className="rounded-lg p-4 text-center border" style={{ borderColor: "#1e293b", color: "#334155" }}>
                    <Icon name="GitBranch" size={24} className="mx-auto mb-2" style={{ color: "#1e293b" }} />
                    <p className="text-xs">Граф является деревом — независимых контуров нет.</p>
                    <p className="text-xs mt-1">Расходы однозначно определены структурой сети.</p>
                  </div>
                )}

                {result.loopIds.map((loop, li) => {
                  const resid = result.loopResiduals[li] ?? 0;
                  const col   = resid < 1 ? "#22c55e" : resid < 10 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={li} className="rounded-lg border p-3" style={{ borderColor: "#1e293b", background: "#0d1826" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-white">Контур {li + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs" style={{ color: col }}>
                            Δ = {resid.toFixed(2)} Па
                          </span>
                          <div className="h-2 w-2 rounded-full" style={{ background: col }} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {loop.map((awId, ei) => {
                          const aw  = airways.find(a => a.id === awId);
                          const q   = result.airwayQ[awId] ?? 0;
                          const dir = result.airwayDir[awId] ?? 1;
                          return (
                            <div key={awId} className="flex items-center gap-1 rounded px-2 py-1 text-xs"
                              style={{ background: "#1e293b" }}>
                              <span style={{ color: dir === 1 ? "#22c55e" : "#f87171" }}>
                                {dir === 1 ? "→" : "←"}
                              </span>
                              <span className="font-mono" style={{ color: "#94a3b8" }}>
                                {aw?.label ?? awId.replace(/_seg\d+$/, "")}
                              </span>
                              <span className="font-mono font-bold" style={{ color: "#60a5fa" }}>
                                {fmt1(Math.abs(q))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ══ Сообщения ══ */}
            {tab === "warnings" && (
              <div className="p-4 space-y-2">
                {result.errors.length === 0 && result.warnings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{ background: "rgba(34,197,94,0.1)" }}>
                      <Icon name="CheckCircle" size={24} style={{ color: "#22c55e" }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: "#22c55e" }}>Нет ошибок и предупреждений</p>
                  </div>
                ) : (
                  <>
                    {result.errors.map((e, i) => (
                      <div key={i} className="flex gap-2 rounded-lg p-3" style={{ background: "#450a0a", border: "1px solid #7f1d1d" }}>
                        <Icon name="AlertCircle" size={14} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
                        <p className="text-xs" style={{ color: "#fca5a5" }}>{e}</p>
                      </div>
                    ))}
                    {result.warnings.map((w, i) => (
                      <div key={i} className="flex gap-2 rounded-lg p-3" style={{ background: "#451a03", border: "1px solid #78350f" }}>
                        <Icon name="AlertTriangle" size={14} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
                        <p className="text-xs" style={{ color: "#fcd34d" }}>{w}</p>
                      </div>
                    ))}
                  </>
                )}

                <div className="rounded-lg p-3 mt-2" style={{ background: "#0d1826", border: "1px solid #1e293b" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#475569" }}>Параметры расчёта</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {[
                      ["Метод",         "Харди-Кросс + СЛАУ"],
                      ["Итераций",      String(result.iterations)],
                      ["Сходимость",    result.converged ? "Да ✓" : "Нет ✗"],
                      ["Макс. невязка", result.maxResidual.toFixed(2) + " Па"],
                      ["Ошибка баланса", result.balanceError.toFixed(4) + " м³/с"],
                      ["Независ. контуров", String(result.loopIds.length)],
                      ["Узлов",         String(nodes.length)],
                      ["Ветвей",        String(airways.length)],
                    ].map(([k, v]) => (
                      <React.Fragment key={k}>
                        <span style={{ color: "#334155" }}>{k}:</span>
                        <span className="font-mono" style={{ color: "#64748b" }}>{v}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>}
        </div>
      </div>
    </div>
  );
}