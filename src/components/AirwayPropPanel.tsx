import React, { useState } from "react";
import Icon from "@/components/ui/icon";
import { CalcResult } from "@/lib/aeroCalc";

// ─── Типы (дублируем минимально нужное) ──────────────────────────────────────
type AirwayStyle = "main" | "branch" | "intake" | "exhaust" | "tube";

interface Airway {
  id: string;
  points: { x: number; y: number; z?: number }[];
  style: AirwayStyle;
  label?: string;
  q?: string;
  l?: string;
  s?: string;
  color?: string;
  z?: number;
  ventType?: string;
  sectionShape?: string;
  sectionArea?: string;
  sectionManual?: boolean;
  perimeter?: string;
  lengthManual?: boolean;
  aerResistMode?: string;
  surface?: string;
  alpha?: string;
  vMaxManual?: boolean;
  vMax?: string;
  isVertical?: boolean;
  isDashed?: boolean;
  appearYear?: string;
  appearMonth?: string;
  appearDay?: string;
  disappearYear?: string;
  disappearMonth?: string;
  disappearDay?: string;
  borderWidth?: string;
  borderThick?: string;
  layerName?: string;
}

interface Position {
  id: string;
  x: number; y: number; z?: number;
  num: number;
  color: string;
  label?: string;
}

interface SchemeObject {
  id: string;
  type: string;
  x: number; y: number;
  angle: number;
  label?: string;
  params?: string;
  color?: string;
}

interface Props {
  propPanel: { type: string; id: string };
  selectedAirway: Airway | null | undefined;
  selectedPos: Position | null | undefined;
  selectedObj: SchemeObject | null | undefined;
  selectedId: string | null;
  calcResult: CalcResult | null;
  inputCls: string;
  POSITION_COLORS: string[];
  AIRWAY_STYLES: Record<string, { width: number; color: string; dash: number[] }>;
  updateAirway: (id: string, patch: Partial<Airway>) => void;
  updatePosition: (id: string, patch: Partial<Position>) => void;
  updateObject: (id: string, patch: Partial<SchemeObject>) => void;
  onClose: () => void;
  onDelete: () => void;
}

type Tab = "general" | "ventilation" | "aerodynamics";

const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

const VENT_TYPES = ["ВНС","ВОД","Штрек","Квершлаг","Уклон","Бремсберг",
  "Ствол","Шурф","Гезенк","Ходок","Лава","Штольня","Тоннель"];

const SECTION_SHAPES = ["Арочное","Прямоугольное","Трапециевидное",
  "Круглое","Полигональное","Эллиптическое"];

const SURFACES = [
  "Наклонная арочная выработка с сеткой закреплённой",
  "Горизонтальная выработка, бетон",
  "Горизонтальная выработка, дерево",
  "Вертикальная выработка, кирпич",
  "Вертикальная выработка, бетон",
  "Горная выработка без крепи",
  "Металлическая крепь (арки)",
];

const RESIST_MODES = [
  "Проектными данными",
  "Вручную",
  "По аналогу",
];

const rowCls = "flex items-center gap-1 mb-1.5";
const labelCls = "flex-shrink-0 text-xs text-slate-500";
const unitCls = "text-xs text-slate-400 flex-shrink-0";
const sectionHdr = "text-xs font-semibold text-slate-700 mb-1.5 mt-2 pt-1 border-t border-slate-100";
const calcHdr = "text-xs font-bold text-slate-800 mb-1.5 mt-2 pt-1 border-t border-slate-200 bg-slate-50 px-2 py-1 -mx-2 rounded";
const calcRow = "flex items-center justify-between mb-1 px-1";

function CalcValue({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className={calcRow}>
      <span className="text-xs text-slate-500">{label}</span>
      <span className="font-mono text-xs font-bold" style={{ color: highlight ?? "#1e3a5f" }}>{value}</span>
    </div>
  );
}

export default function AirwayPropPanel({
  propPanel, selectedAirway, selectedPos, selectedObj, selectedId,
  calcResult, inputCls, POSITION_COLORS, AIRWAY_STYLES,
  updateAirway, updatePosition, updateObject, onClose, onDelete,
}: Props) {
  const [tab, setTab] = useState<Tab>("general");

  const aw = selectedAirway;
  const isAirway = propPanel.type === "airway" && aw;

  const TABS: { id: Tab; label: string }[] = [
    { id: "general",     label: "Общие" },
    { id: "ventilation", label: "Вентиляция" },
    { id: "aerodynamics",label: "Аэродинамика" },
  ];

  // Расчётные данные по выработке
  const segKey = aw ? `${aw.id}_seg0` : "";
  const cq  = calcResult?.airwayQ[segKey];
  const cv  = calcResult?.airwayV[segKey];
  const cdp = calcResult?.airwayDeltaP[segKey];
  const cr  = calcResult?.airwayR[segKey];
  const cdir = calcResult?.airwayDir[segKey];

  // Вычисляемые параметры для вентиляции
  const calcS = aw?.sectionArea ? parseFloat(aw.sectionArea) : (aw?.s ? parseFloat(aw.s) : 0);
  const calcL = aw?.l ? parseFloat(aw.l) : 0;
  const calcAlpha = aw?.alpha ? parseFloat(aw.alpha) : 0.0025;
  const perim = aw?.perimeter ? parseFloat(aw.perimeter) : (calcS > 0 ? 4 * Math.sqrt(calcS) : 0);
  const resistance = (calcS > 0 && calcL > 0)
    ? (calcAlpha * calcL * perim) / Math.pow(calcS, 3)
    : 0;
  const flowQ = cq !== undefined ? Math.abs(cq) : (aw?.q ? parseFloat(aw.q) : 0);
  const velocity = calcS > 0 ? flowQ / calcS : 0;
  const deltaP = resistance * flowQ * flowQ;
  const powerW = deltaP * flowQ;

  return (
    <div className="flex w-64 flex-shrink-0 flex-col border-l border-slate-200 bg-white">

      {/* Шапка — дропдаун «Свойства» */}
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-slate-100 px-2 py-1.5"
        style={{ background: "#f8fafc" }}>
        <Icon name="ChevronLeft" size={11} className="text-slate-400" />
        <select className="flex-1 bg-transparent text-xs font-semibold text-slate-600 outline-none cursor-pointer">
          <option>Свойства</option>
        </select>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-500 ml-1">
          <Icon name="X" size={13} />
        </button>
      </div>

      {/* Вкладки (только для выработки) */}
      {isAirway && (
        <div className="flex flex-shrink-0 border-b border-slate-100">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-1.5 text-xs font-medium border-b-2 transition-all"
              style={{
                borderColor: tab === t.id ? "#1e3a5f" : "transparent",
                color: tab === t.id ? "#1e3a5f" : "#94a3b8",
                background: "transparent",
              }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">

        {/* ── Выработка: вкладка Общие ── */}
        {isAirway && tab === "general" && (
          <div className="p-3">
            <div className={rowCls}>
              <span className={`${labelCls} w-20`}>Название:</span>
              <input className={inputCls} value={aw.label || ""}
                onChange={e => updateAirway(aw.id, { label: e.target.value })}
                placeholder="напр. ВНС 810/860м" />
            </div>
            <div className={rowCls}>
              <span className={`${labelCls} w-20`}>Номер:</span>
              <input className={inputCls} value={aw.z?.toString() || ""}
                onChange={e => updateAirway(aw.id, { z: e.target.value ? parseFloat(e.target.value) : undefined })} />
            </div>
            <div className={rowCls}>
              <span className={`${labelCls} w-20`}>Ширина:</span>
              <input className={`${inputCls}`} type="number" step="0.1"
                value={aw.borderWidth || "2"}
                onChange={e => updateAirway(aw.id, { borderWidth: e.target.value })} />
              <span className={unitCls}>мм</span>
            </div>
            <div className={rowCls}>
              <span className={`${labelCls} w-20`}>Граница:</span>
              <input className={`${inputCls}`} type="number" step="0.1"
                value={aw.borderThick || "0.2"}
                onChange={e => updateAirway(aw.id, { borderThick: e.target.value })} />
              <span className={unitCls}>мм</span>
            </div>

            {/* Слой */}
            <div className={rowCls}>
              <span className={`${labelCls} w-20`}>Слой:</span>
              <select className={inputCls} value={aw.style}
                onChange={e => updateAirway(aw.id, { style: e.target.value as AirwayStyle })}>
                <option value="main">Главный ствол</option>
                <option value="branch">Участковая</option>
                <option value="intake">Свежая струя</option>
                <option value="exhaust">Исходящая</option>
                <option value="tube">Труба/Лава</option>
              </select>
            </div>

            {/* Появление */}
            <div className="flex items-start gap-1 mb-1.5">
              <span className={`${labelCls} w-20 mt-1`}>Появление:</span>
              <div className="flex flex-1 gap-0.5 flex-wrap items-center">
                <input className={`${inputCls} w-12`} placeholder="Год" type="number"
                  value={aw.appearYear || ""} onChange={e => updateAirway(aw.id, { appearYear: e.target.value })} />
                <select className={`${inputCls} flex-1 min-w-0`}
                  value={aw.appearMonth || ""}
                  onChange={e => updateAirway(aw.id, { appearMonth: e.target.value })}>
                  <option value="">Мес.</option>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <input className={`${inputCls} w-7`} placeholder="д" type="number" min="1" max="31"
                  value={aw.appearDay || ""} onChange={e => updateAirway(aw.id, { appearDay: e.target.value })} />
                <button onClick={() => updateAirway(aw.id, { appearYear:"", appearMonth:"", appearDay:"" })}
                  className="rounded border border-slate-200 p-1 text-slate-400 hover:bg-slate-50">
                  <Icon name="Trash2" size={10} />
                </button>
              </div>
            </div>

            {/* Исчезновение */}
            <div className="flex items-start gap-1 mb-2">
              <span className={`${labelCls} w-20 mt-1`}>Исчезновение:</span>
              <div className="flex flex-1 gap-0.5 flex-wrap items-center">
                <input className={`${inputCls} w-12`} placeholder="Год" type="number"
                  value={aw.disappearYear || ""} onChange={e => updateAirway(aw.id, { disappearYear: e.target.value })} />
                <select className={`${inputCls} flex-1 min-w-0`}
                  value={aw.disappearMonth || ""}
                  onChange={e => updateAirway(aw.id, { disappearMonth: e.target.value })}>
                  <option value="">Мес.</option>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <input className={`${inputCls} w-7`} placeholder="д" type="number" min="1" max="31"
                  value={aw.disappearDay || ""} onChange={e => updateAirway(aw.id, { disappearDay: e.target.value })} />
                <button onClick={() => updateAirway(aw.id, { disappearYear:"", disappearMonth:"", disappearDay:"" })}
                  className="rounded border border-slate-200 p-1 text-slate-400 hover:bg-slate-50">
                  <Icon name="Trash2" size={10} />
                </button>
              </div>
            </div>

            {/* Флаги */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!aw.isVertical}
                  onChange={e => updateAirway(aw.id, { isVertical: e.target.checked })} />
                <span className="text-xs text-slate-600">Вертикальная выработка (ходок)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!aw.isDashed}
                  onChange={e => updateAirway(aw.id, { isDashed: e.target.checked })} />
                <span className="text-xs text-slate-600">Пунктирная граница</span>
              </label>
            </div>
          </div>
        )}

        {/* ── Выработка: вкладка Вентиляция (Аэродинамическое сопротивление) ── */}
        {isAirway && tab === "ventilation" && (
          <div className="p-3 text-xs">

            <p className="text-xs font-bold text-slate-600 mb-2">Аэродинамическое сопротивление</p>

            {/* Тип выработки */}
            <p className={sectionHdr}>Тип выработки</p>
            <select className={`${inputCls} mb-2`}
              value={aw.ventType || "ВНС"}
              onChange={e => updateAirway(aw.id, { ventType: e.target.value })}>
              {VENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>

            {/* Поперечное сечение */}
            <p className={sectionHdr}>Поперечное сечение</p>
            <select className={`${inputCls} mb-1.5`}
              value={aw.sectionShape || "Арочное"}
              onChange={e => updateAirway(aw.id, { sectionShape: e.target.value })}>
              {SECTION_SHAPES.map(s => <option key={s}>{s}</option>)}
            </select>

            <div className={rowCls}>
              <span className={`${labelCls} w-16`}>Площадь:</span>
              <input className={inputCls} type="number" step="0.5"
                value={aw.sectionArea || aw.s || ""}
                onChange={e => updateAirway(aw.id, { sectionArea: e.target.value })}
                placeholder="25" />
              <span className={unitCls}>м²</span>
            </div>
            <div className={`${rowCls} mb-2`}>
              <span className={`${labelCls} w-16`}>Тип:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!aw.sectionManual}
                  onChange={e => updateAirway(aw.id, { sectionManual: e.target.checked })} />
                <span className="text-xs text-slate-500">Задаётся вручную</span>
              </label>
            </div>
            <div className={rowCls}>
              <span className={`${labelCls} w-16`}>Периметр:</span>
              <input className={inputCls} type="number" step="0.1"
                value={aw.perimeter || (calcS > 0 ? (4 * Math.sqrt(calcS)).toFixed(1) : "")}
                onChange={e => updateAirway(aw.id, { perimeter: e.target.value })}
                placeholder={calcS > 0 ? (4 * Math.sqrt(calcS)).toFixed(1) : ""} />
              <span className={unitCls}>м</span>
            </div>

            {/* Длина выработки */}
            <p className={sectionHdr}>Длина выработки</p>
            <div className={`${rowCls} mb-1`}>
              <span className={`${labelCls} w-16`}>Тип:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!aw.lengthManual}
                  onChange={e => updateAirway(aw.id, { lengthManual: e.target.checked })} />
                <span className="text-xs text-slate-500">Задаётся вручную</span>
              </label>
            </div>
            <div className={rowCls}>
              <span className={`${labelCls} w-16`}>Длина:</span>
              <input className={inputCls} type="number"
                value={aw.l || ""}
                onChange={e => updateAirway(aw.id, { l: e.target.value })}
                placeholder="238" />
              <span className={unitCls}>м</span>
            </div>

            {/* Аэродинамическое сопротивление */}
            <p className={sectionHdr}>Аэродинамическое сопротивление</p>
            <div className={rowCls}>
              <span className={`${labelCls} w-20`}>Задаётся:</span>
              <select className={inputCls}
                value={aw.aerResistMode || "Проектными данными"}
                onChange={e => updateAirway(aw.id, { aerResistMode: e.target.value })}>
                {RESIST_MODES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className={rowCls}>
              <span className={`${labelCls} w-20`}>Поверхность:</span>
            </div>
            <select className={`${inputCls} mb-1.5 text-xs`}
              value={aw.surface || SURFACES[0]}
              onChange={e => updateAirway(aw.id, { surface: e.target.value })}>
              {SURFACES.map(s => <option key={s}>{s}</option>)}
            </select>
            <div className={rowCls}>
              <span className={`${labelCls} w-20`}>Коэф-т α:</span>
              <input className={inputCls} type="number" step="0.001"
                value={aw.alpha || "0.014"}
                onChange={e => updateAirway(aw.id, { alpha: e.target.value })} />
              <span className={unitCls}>кг/м³</span>
            </div>

            {/* Скорость воздуха */}
            <p className={sectionHdr}>Скорость воздуха</p>
            <div className={`${rowCls} mb-1`}>
              <span className={`${labelCls} w-20`}>Тип:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!aw.vMaxManual}
                  onChange={e => updateAirway(aw.id, { vMaxManual: e.target.checked })} />
                <span className="text-xs text-slate-500">Задаётся вручную</span>
              </label>
            </div>
            <div className={rowCls}>
              <span className={`${labelCls} w-20`}>V max:</span>
              <input className={inputCls} type="number" step="0.5"
                value={aw.vMax || "15"}
                onChange={e => updateAirway(aw.id, { vMax: e.target.value })} />
              <span className={unitCls}>м/с</span>
            </div>

            {/* Вычисленные параметры */}
            <div className={calcHdr}>Вычисленные параметры</div>

            <CalcValue
              label="Сопротивление:"
              value={resistance > 0 ? `${resistance.toFixed(6)} кМюрг` : "—"}
              highlight="#1e3a5f"
            />
            <CalcValue
              label="Расход:"
              value={flowQ > 0 ? `${flowQ.toFixed(1)} м³/с` : "—"}
              highlight="#1e3a5f"
            />
            <CalcValue
              label="V воздуха:"
              value={velocity > 0 ? `${velocity.toFixed(1)} м/с` : "—"}
              highlight={velocity > 8 ? "#ef4444" : velocity > 4 ? "#f59e0b" : "#22c55e"}
            />
            <CalcValue
              label="ΔP:"
              value={deltaP > 0 ? `${Math.round(deltaP)} Па` : "—"}
              highlight="#1e3a5f"
            />
            <CalcValue
              label="Энергозатраты:"
              value={powerW > 0 ? `${Math.round(powerW)} Вт` : "—"}
              highlight="#7c3aed"
            />
          </div>
        )}

        {/* ── Выработка: вкладка Аэродинамика (расчётные данные) ── */}
        {isAirway && tab === "aerodynamics" && (
          <div className="p-3">
            <p className={sectionHdr.replace("mt-2 pt-1 border-t","mt-0")}>Параметры выработки</p>

            <div className={rowCls}>
              <span className={`${labelCls} w-16`}>L, м:</span>
              <input className={inputCls} type="number" value={aw.l || ""}
                onChange={e => updateAirway(aw.id, { l: e.target.value })} placeholder="Длина" />
            </div>
            <div className={rowCls}>
              <span className={`${labelCls} w-16`}>S, м²:</span>
              <input className={inputCls} type="number" step="0.1" value={aw.s || aw.sectionArea || ""}
                onChange={e => updateAirway(aw.id, { s: e.target.value })} placeholder="Сечение" />
            </div>
            <div className={rowCls}>
              <span className={`${labelCls} w-16`}>Q, м³/с:</span>
              <input className={inputCls} type="number" step="0.1" value={aw.q || ""}
                onChange={e => updateAirway(aw.id, { q: e.target.value })} placeholder="Расход" />
            </div>

            {cq !== undefined ? (
              <>
                <div className={calcHdr}>Вычисленные параметры</div>
                <CalcValue label="Расход Q:" value={`${Math.abs(cq).toFixed(2)} м³/с`} highlight="#1e3a5f" />
                <CalcValue label="Скорость v:"
                  value={`${(cv??0).toFixed(2)} м/с`}
                  highlight={(cv??0) > 8 ? "#ef4444" : (cv??0) > 4 ? "#f59e0b" : "#22c55e"} />
                <CalcValue label="Потеря ΔP:" value={`${Math.round(Math.abs(cdp??0))} Па`} />
                <CalcValue label="Сопр. R:" value={`${(cr??0).toExponential(3)} кмург`} />
                <CalcValue label="Направление:" value={cdir === 1 ? "→ прямое" : "← обратное"}
                  highlight={cdir === 1 ? "#22c55e" : "#f87171"} />
              </>
            ) : (
              <div className="mt-4 rounded-lg p-3 text-center"
                style={{ background: "#f8fafc", border: "1px dashed #e2e8f0" }}>
                <Icon name="Calculator" size={20} className="text-slate-300 mx-auto mb-1" />
                <p className="text-xs text-slate-400">Нажмите «Расчёт» в тулбаре<br />для получения результатов</p>
              </div>
            )}
          </div>
        )}

        {/* ── Свойства позиции ── */}
        {propPanel.type === "position" && selectedPos && (
          <div className="p-3 space-y-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Номер</label>
              <input className={inputCls} type="number" value={selectedPos.num}
                onChange={e => updatePosition(selectedPos.id, { num: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Подпись</label>
              <input className={inputCls} value={selectedPos.label || ""}
                onChange={e => updatePosition(selectedPos.id, { label: e.target.value })} placeholder="Описание..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Глубина горизонта, м</label>
              <input className={inputCls} type="number" value={selectedPos.z ?? ""}
                placeholder="напр. 860"
                onChange={e => updatePosition(selectedPos.id, { z: e.target.value ? parseFloat(e.target.value) : undefined })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Цвет</label>
              <div className="flex gap-1.5 flex-wrap">
                {POSITION_COLORS.map(c => (
                  <button key={c} onClick={() => updatePosition(selectedPos.id, { color: c })}
                    className="h-6 w-6 rounded-full border-2 transition-all"
                    style={{ background: c, borderColor: selectedPos.color === c ? "#3b82f6" : "transparent" }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Свойства объекта ── */}
        {propPanel.type === "object" && selectedObj && (
          <div className="p-3 space-y-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Название</label>
              <input className={inputCls} value={selectedObj.label || ""}
                onChange={e => updateObject(selectedObj.id, { label: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Параметры</label>
              <input className={inputCls} value={selectedObj.params || ""}
                onChange={e => updateObject(selectedObj.id, { params: e.target.value })} placeholder="Q=..., L=..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Угол, °</label>
              <input className={inputCls} type="number" value={selectedObj.angle}
                onChange={e => updateObject(selectedObj.id, { angle: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Цвет</label>
              <div className="flex gap-1.5 flex-wrap">
                {["#f59e0b","#94a3b8","#64748b","#60a5fa","#f97316","#22c55e","#ef4444"].map(c => (
                  <button key={c} onClick={() => updateObject(selectedObj.id, { color: c })}
                    className="h-6 w-6 rounded-full border-2 transition-all"
                    style={{ background: c, borderColor: selectedObj.color === c ? "#3b82f6" : "transparent" }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Кнопка Удалить */}
      {selectedId && (
        <div className="flex-shrink-0 border-t border-slate-100 p-2">
          <button onClick={onDelete}
            className="flex w-full items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-all hover:opacity-80"
            style={{ background: "#fee2e2", color: "#dc2626" }}>
            <Icon name="Trash2" size={12} />
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}
