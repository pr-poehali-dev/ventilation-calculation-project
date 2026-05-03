import React, { useState } from "react";
import Icon from "@/components/ui/icon";

// ─── Типы ─────────────────────────────────────────────────────────────────────
export type ToolMode =
  | "select" | "airway" | "position" | "fan" | "door" | "wall"
  | "sensor" | "arrow" | "label" | "pan";

export type AirwayStyle = "main" | "branch" | "intake" | "exhaust" | "tube";

export type RibbonTab =
  | "main" | "view" | "scheme" | "ventilation" | "thermal"
  | "accidents" | "pipes" | "costs" | "references" | "general";

interface RibbonAction {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

interface RibbonGroup {
  id: string;
  label: string;
  items: React.ReactNode;
}

interface Props {
  tool: ToolMode;
  airwayStyle: AirwayStyle;
  viewport: { scale: number };
  selectedId: string | null;
  calcResult: { converged?: boolean } | null;
  isCalcRunning: boolean;
  zoom: number;
  onTool: (t: ToolMode) => void;
  onAirwayStyle: (s: AirwayStyle) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onDelete: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCalc: () => void;
  onShowCalc: () => void;
  onImportDxf: () => void;
  on3D: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onCut?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onEdit?: () => void;
}

// ─── Символы объектов на выработках (SVG-миниатюры) ──────────────────────────
function ObjIcon({ type, active, onClick }: { type: string; active?: boolean; onClick: () => void }) {
  const symbols: Record<string, React.ReactNode> = {
    fan: (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {[0,1,2,3].map(i => (
          <path key={i} d="M10,10 Q13,6 16,10" fill="none" stroke="currentColor" strokeWidth="1.2"
            transform={`rotate(${i*90},10,10)`} />
        ))}
        <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      </svg>
    ),
    door: (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <line x1="3" y1="6" x2="3" y2="14" stroke="currentColor" strokeWidth="1.5" />
        <line x1="17" y1="6" x2="17" y2="14" stroke="currentColor" strokeWidth="1.5" />
        <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3,10 a7,7 0 0,1 7,-7" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
    wall: (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="2.5" />
        {[-4,-1,2,5,8].map(i => (
          <line key={i} x1={5+i} y1="10" x2={3+i} y2="14" stroke="currentColor" strokeWidth="1" />
        ))}
      </svg>
    ),
    sensor: (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.2" />
        <line x1="10" y1="6" x2="10" y2="14" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
    arrow: (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <line x1="3" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13,10 l-4,-4 l0,8 Z" fill="currentColor" />
      </svg>
    ),
    position: (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
        <text x="10" y="14" textAnchor="middle" fontSize="8" fontWeight="bold" fill="currentColor">187</text>
      </svg>
    ),
  };

  return (
    <button onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded transition-all"
      style={{
        background: active ? "#1e3a5f" : "transparent",
        color: active ? "#fff" : "#374151",
        border: active ? "1px solid #1e3a5f" : "1px solid transparent",
      }}
      title={type}>
      {symbols[type] ?? <Icon name="Circle" size={14} />}
    </button>
  );
}

// ─── Кнопка выработки (цветная полоска) ──────────────────────────────────────
function AirwayBtn({ style, color, width, label, active, onClick }: {
  style: string; color: string; width: number; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} title={label}
      className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded transition-all"
      style={{
        background: active ? color + "18" : "transparent",
        border: active ? `1px solid ${color}` : "1px solid transparent",
      }}>
      <div className="rounded" style={{ width: 28, height: width, background: color, borderRadius: 1 }} />
      <span className="text-xs font-medium" style={{ color: active ? color : "#6b7280", fontSize: 8 }}>
        {label}
      </span>
    </button>
  );
}

// ─── Кнопка риббона ──────────────────────────────────────────────────────────
function RBtn({ icon, label, onClick, active = false, disabled = false, danger = false, size = "md" }: {
  icon: string; label: string; onClick: () => void;
  active?: boolean; disabled?: boolean; danger?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const isLg = size === "lg";
  const isSm = size === "sm";

  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center rounded transition-all disabled:opacity-40 ${
        isLg ? "px-2 py-1.5 gap-1 min-w-12" : isSm ? "px-1.5 py-1 gap-0.5" : "px-2 py-1 gap-0.5"
      }`}
      style={{
        background: active ? "#1e3a5f" : "transparent",
        color: disabled ? "#9ca3af" : danger ? "#ef4444" : active ? "#fff" : "#374151",
        border: "1px solid transparent",
      }}
      onMouseEnter={e => { if (!active && !disabled) (e.currentTarget as HTMLElement).style.background = "#f3f4f6"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = active ? "#1e3a5f" : "transparent"; }}
      title={label}>
      <Icon name={icon} size={isLg ? 20 : isSm ? 13 : 16} fallback="Circle"
        style={{ color: disabled ? "#9ca3af" : danger ? "#ef4444" : active ? "#fff" : "#374151" }} />
      {isLg && <span className="text-center font-medium leading-tight" style={{ fontSize: 9 }}>{label}</span>}
      {!isLg && isSm && <span style={{ fontSize: 8 }}>{label}</span>}
      {!isLg && !isSm && <span style={{ fontSize: 9 }}>{label}</span>}
    </button>
  );
}

// ─── Разделитель группы ───────────────────────────────────────────────────────
function GroupSep({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-stretch">
      <div className="flex-1 flex items-center">
        <div className="w-px h-8 mx-1" style={{ background: "#e5e7eb" }} />
      </div>
      <div style={{ fontSize: 7, color: "#9ca3af", textAlign: "center", paddingBottom: 2 }}>{label}</div>
    </div>
  );
}

// ─── Группа риббона ──────────────────────────────────────────────────────────
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ minWidth: 0 }}>
      <div className="flex items-start gap-0.5 px-1 flex-1">{children}</div>
      <div className="border-t mt-0.5 pt-0.5 text-center"
        style={{ fontSize: 8, color: "#9ca3af", borderColor: "#e5e7eb" }}>
        {label}
      </div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function SchemeRibbon({
  tool, airwayStyle, viewport, selectedId, calcResult, isCalcRunning,
  onTool, onAirwayStyle, onZoomIn, onZoomOut, onZoomReset,
  onDelete, onCalc, onShowCalc, onImportDxf, on3D,
  onCopy, onPaste, onCut, onMoveUp, onMoveDown, onEdit,
}: Props) {
  const [activeTab, setActiveTab] = useState<RibbonTab>("main");

  const TABS: { id: RibbonTab; label: string }[] = [
    { id: "main",       label: "Главная" },
    { id: "view",       label: "Просмотр" },
    { id: "scheme",     label: "Схема" },
    { id: "ventilation",label: "Вентиляция" },
    { id: "thermal",    label: "Теплофизика" },
    { id: "accidents",  label: "Аварии" },
    { id: "pipes",      label: "Трубы" },
    { id: "costs",      label: "Затраты" },
    { id: "references", label: "Справочники" },
    { id: "general",    label: "Общее" },
  ];

  const airwayStyles: { style: AirwayStyle; color: string; width: number; label: string }[] = [
    { style: "main",    color: "#22c55e", width: 8, label: "Гл." },
    { style: "intake",  color: "#34d399", width: 5, label: "Св." },
    { style: "exhaust", color: "#f87171", width: 5, label: "Исх." },
    { style: "branch",  color: "#60a5fa", width: 3, label: "Уч." },
    { style: "tube",    color: "#a78bfa", width: 2, label: "Тр." },
  ];

  return (
    <div className="flex flex-col flex-shrink-0" style={{ background: "#f3f4f6" }}>

      {/* ── Вкладки ── */}
      <div className="flex items-end gap-0 px-2 pt-1" style={{ background: "#f3f4f6" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-3 py-1 text-xs font-medium rounded-t transition-all"
            style={{
              background: activeTab === tab.id ? "#fff" : "transparent",
              color: activeTab === tab.id ? "#1e3a5f" : "#6b7280",
              borderTop: activeTab === tab.id ? "2px solid #1e3a5f" : "2px solid transparent",
              borderLeft: activeTab === tab.id ? "1px solid #e5e7eb" : "1px solid transparent",
              borderRight: activeTab === tab.id ? "1px solid #e5e7eb" : "1px solid transparent",
              marginBottom: activeTab === tab.id ? -1 : 0,
              zIndex: activeTab === tab.id ? 1 : 0,
              position: "relative",
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Содержимое вкладки ── */}
      <div className="flex items-stretch border-b border-t gap-1 px-2 py-1"
        style={{ background: "#fff", borderColor: "#e5e7eb", minHeight: 68 }}>

        {/* ═══ ГЛАВНАЯ ═══ */}
        {activeTab === "main" && (<>

          {/* Объекты */}
          <Group label="Объекты">
            <RBtn icon="Plus" label="Добавить выработку" onClick={() => onTool("airway")}
              active={tool === "airway"} size="lg" />
            <RBtn icon="Scissors" label="Разделить выработку" onClick={() => {}} size="lg" />
          </Group>

          <GroupSep label="" />

          {/* Числовое поле (номер позиции) */}
          <Group label="">
            <div className="flex flex-col items-center gap-1 px-1">
              <div className="flex items-center border border-slate-300 rounded overflow-hidden"
                style={{ background: "#fff" }}>
                <button className="px-1 text-slate-500 hover:bg-slate-100 text-xs border-r border-slate-200 py-0.5">▲</button>
                <input type="number" defaultValue={59}
                  className="w-10 text-center text-xs font-mono outline-none py-0.5" />
                <button className="px-1 text-slate-500 hover:bg-slate-100 text-xs border-l border-slate-200 py-0.5">▼</button>
              </div>
            </div>
          </Group>

          {/* Текст / форма */}
          <Group label="">
            <RBtn icon="Type" label="Текст" onClick={() => onTool("label")} active={tool === "label"} />
            <RBtn icon="Pentagon" label="Форма" onClick={() => {}} />
            <RBtn icon="Table" label="Таблица" onClick={() => {}} />
          </Group>

          <GroupSep label="" />

          {/* Стили выработок */}
          <Group label="Объекты на выработках">
            <div className="flex flex-col gap-0.5">
              <div className="flex gap-0.5">
                {airwayStyles.map(s => (
                  <AirwayBtn key={s.style} style={s.style} color={s.color} width={s.width}
                    label={s.label} active={airwayStyle === s.style}
                    onClick={() => onAirwayStyle(s.style)} />
                ))}
              </div>
              <div className="flex gap-0.5 mt-0.5">
                {(["fan","door","wall","sensor","arrow","position"] as const).map(t => (
                  <ObjIcon key={t} type={t} active={tool === t}
                    onClick={() => onTool(t === "position" ? "position" : t as ToolMode)} />
                ))}
              </div>
            </div>
          </Group>

          <GroupSep label="" />

          {/* Действия выбора */}
          <Group label="Выбор">
            <RBtn icon="MousePointer" label="Выделить объект" onClick={() => onTool("select")}
              active={tool === "select"} size="lg" />
            <RBtn icon="Filter" label="Наложить фильтр" onClick={() => {}} size="lg" />
          </Group>

          <GroupSep label="" />

          {/* Действия с объектами */}
          <Group label="Действия с объектами">
            <RBtn icon="RotateCcw" label="Отменить действие" onClick={() => {}} />
            <RBtn icon="Trash2" label="Удалить" onClick={onDelete} disabled={!selectedId} danger />
            <RBtn icon="MoveUp" label="Переместить вверх" onClick={onMoveUp ?? (() => {})} disabled={!selectedId} />
            <RBtn icon="MoveDown" label="Переместить вниз" onClick={onMoveDown ?? (() => {})} disabled={!selectedId} />
            <RBtn icon="Pencil" label="Редактировать" onClick={onEdit ?? (() => {})} disabled={!selectedId} />
            <RBtn icon="ZoomIn" label="Увеличить" onClick={onZoomIn} />
            <RBtn icon="ZoomOut" label="Уменьшить" onClick={onZoomOut} />
          </Group>

          <GroupSep label="" />

          {/* Буфер */}
          <Group label="Буфер обмена">
            <RBtn icon="Clipboard" label="Вставить" onClick={onPaste ?? (() => {})} size="lg" />
            <div className="flex flex-col gap-0.5">
              <RBtn icon="Scissors" label="Вырезать" onClick={onCut ?? (() => {})} disabled={!selectedId} />
              <RBtn icon="Copy" label="Копировать" onClick={onCopy ?? (() => {})} disabled={!selectedId} />
            </div>
          </Group>

        </>)}

        {/* ═══ ПРОСМОТР ═══ */}
        {activeTab === "view" && (<>
          <Group label="Масштаб">
            <RBtn icon="ZoomIn"  label="Увеличить"  onClick={onZoomIn}   size="lg" />
            <RBtn icon="ZoomOut" label="Уменьшить"  onClick={onZoomOut}  size="lg" />
            <RBtn icon="Maximize2" label="По размеру" onClick={onZoomReset} size="lg" />
          </Group>
          <GroupSep label="" />
          <Group label="Текущий масштаб">
            <div className="flex items-center gap-1 px-2">
              <span className="font-mono text-sm font-semibold text-slate-700">
                {Math.round(viewport.scale * 100)}%
              </span>
            </div>
          </Group>
          <GroupSep label="" />
          <Group label="Вид">
            <RBtn icon="Box"  label="3D-просмотр" onClick={on3D} size="lg" />
            <RBtn icon="Hand" label="Панорама"    onClick={() => onTool("pan")} active={tool === "pan"} size="lg" />
          </Group>
        </>)}

        {/* ═══ СХЕМА ═══ */}
        {activeTab === "scheme" && (<>
          <Group label="Файл">
            <RBtn icon="FileUp"   label="Импорт DXF" onClick={onImportDxf} size="lg" />
            <RBtn icon="FileDown" label="Экспорт"    onClick={() => {}}    size="lg" />
          </Group>
          <GroupSep label="" />
          <Group label="Выработки">
            <RBtn icon="Minus"  label="Новая"  onClick={() => onTool("airway")} active={tool === "airway"} size="lg" />
            <RBtn icon="MapPin" label="Позиция" onClick={() => onTool("position")} active={tool === "position"} size="lg" />
          </Group>
          <GroupSep label="" />
          <Group label="Объекты">
            <RBtn icon="Loader"   label="Вентилятор" onClick={() => onTool("fan")}    active={tool === "fan"}    size="lg" />
            <RBtn icon="DoorOpen" label="Дверь"      onClick={() => onTool("door")}   active={tool === "door"}   size="lg" />
            <RBtn icon="Columns"  label="Перемычка"  onClick={() => onTool("wall")}   active={tool === "wall"}   size="lg" />
            <RBtn icon="Activity" label="Датчик"     onClick={() => onTool("sensor")} active={tool === "sensor"} size="lg" />
            <RBtn icon="ArrowRight" label="Стрелка"  onClick={() => onTool("arrow")}  active={tool === "arrow"}  size="lg" />
          </Group>
        </>)}

        {/* ═══ ВЕНТИЛЯЦИЯ ═══ */}
        {activeTab === "ventilation" && (<>
          <Group label="Расчёт">
            <button onClick={onCalc} disabled={isCalcRunning}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded min-w-14 transition-all disabled:opacity-50"
              style={{ background: calcResult?.converged ? "#22c55e" : "#7c3aed", color: "#fff" }}>
              {isCalcRunning
                ? <Icon name="Loader" size={20} className="animate-spin" />
                : <Icon name="Calculator" size={20} />}
              <span className="text-center font-medium" style={{ fontSize: 9 }}>
                {isCalcRunning ? "Расчёт..." : "Расчёт"}
              </span>
            </button>
            {calcResult && (
              <button onClick={onShowCalc}
                className="flex flex-col items-center gap-1 px-2 py-1.5 rounded min-w-12 transition-all hover:bg-slate-50"
                style={{ color: "#7c3aed" }}>
                <Icon name="BarChart3" size={20} />
                <span style={{ fontSize: 9 }}>Результаты</span>
              </button>
            )}
          </Group>
          <GroupSep label="" />
          <Group label="Инструменты">
            <RBtn icon="Wind"      label="Аэродинамика" onClick={() => {}} size="lg" />
            <RBtn icon="Gauge"     label="Давление"     onClick={() => {}} size="lg" />
            <RBtn icon="ArrowRight" label="Стрелки"     onClick={() => onTool("arrow")} active={tool === "arrow"} size="lg" />
          </Group>
        </>)}

        {/* ═══ ТЕПЛОФИЗИКА ═══ */}
        {activeTab === "thermal" && (<>
          <Group label="Теплорасчёт">
            <RBtn icon="Thermometer" label="Теплоприток" onClick={() => {}} size="lg" />
            <RBtn icon="Flame"       label="Кондиционирование" onClick={() => {}} size="lg" />
          </Group>
        </>)}

        {/* ═══ АВАРИИ ═══ */}
        {activeTab === "accidents" && (<>
          <Group label="Аварийные режимы">
            <RBtn icon="AlertTriangle" label="Пожар"    onClick={() => {}} size="lg" />
            <RBtn icon="AlertCircle"   label="Авария"   onClick={() => {}} size="lg" />
            <RBtn icon="Shield"        label="Эвакуация" onClick={() => {}} size="lg" />
          </Group>
        </>)}

        {/* ═══ ТРУБЫ ═══ */}
        {activeTab === "pipes" && (<>
          <Group label="Трубопроводы">
            <RBtn icon="Pipette"  label="Добавить трубу" onClick={() => {}} size="lg" />
            <RBtn icon="Settings" label="Параметры"      onClick={() => {}} size="lg" />
          </Group>
        </>)}

        {/* ═══ СПРАВОЧНИКИ ═══ */}
        {activeTab === "references" && (<>
          <Group label="Базы данных">
            <RBtn icon="Loader"   label="Вентиляторы"  onClick={() => {}} size="lg" />
            <RBtn icon="BookOpen" label="Нормативы"    onClick={() => {}} size="lg" />
            <RBtn icon="Database" label="Материалы"    onClick={() => {}} size="lg" />
          </Group>
        </>)}

        {/* ═══ ОБЩЕЕ ═══ */}
        {activeTab === "general" && (<>
          <Group label="Действия с объектами">
            <RBtn icon="MousePointer" label="Выделить объект" onClick={() => onTool("select")} active={tool === "select"} size="lg" />
            <RBtn icon="Filter"       label="Наложить фильтр" onClick={() => {}} size="lg" />
            <RBtn icon="RotateCcw"    label="Отменить"        onClick={() => {}} size="lg" />
            <RBtn icon="Trash2"       label="Удалить"         onClick={onDelete} disabled={!selectedId} size="lg" danger />
            <RBtn icon="MoveUp"       label="Переместить вверх"  onClick={onMoveUp ?? (() => {})} disabled={!selectedId} size="lg" />
            <RBtn icon="MoveDown"     label="Переместить вниз"   onClick={onMoveDown ?? (() => {})} disabled={!selectedId} size="lg" />
            <RBtn icon="Pencil"       label="Редактировать"   onClick={onEdit ?? (() => {})} disabled={!selectedId} size="lg" />
            <RBtn icon="ZoomIn"       label="Увеличить"       onClick={onZoomIn}  size="lg" />
            <RBtn icon="ZoomOut"      label="Уменьшить"       onClick={onZoomOut} size="lg" />
          </Group>
          <GroupSep label="" />
          <Group label="Буфер обмена">
            <RBtn icon="Clipboard" label="Вставить"   onClick={onPaste ?? (() => {})} size="lg" />
            <RBtn icon="Scissors"  label="Вырезать"   onClick={onCut ?? (() => {})}  disabled={!selectedId} size="lg" />
            <RBtn icon="Copy"      label="Копировать" onClick={onCopy ?? (() => {})} disabled={!selectedId} size="lg" />
          </Group>
        </>)}

      </div>
    </div>
  );
}
