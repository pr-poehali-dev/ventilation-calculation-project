import React, { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Типы ─────────────────────────────────────────────────────────────────────
interface FanCharacteristic {
  id: string;
  bladeAngle: number;         // угол лопаток, °
  rpm: number;                // скорость, об/мин
  reverse: boolean;           // реверс
  color: string;              // цвет кривой
  curve: [number, number][];  // [[Q м³/с, P Па], ...]
  powerCurve: [number, number][]; // [[Q, N кВт], ...]
}

interface FanType {
  id: string;
  name: string;
  diameter: number;           // м
  minRPM: number;
  maxRPM: number;
  characteristics: FanCharacteristic[];
  expanded: boolean;
}

// ─── Палитра кривых ───────────────────────────────────────────────────────────
const CURVE_COLORS = [
  "#ef4444","#f97316","#eab308","#22c55e",
  "#06b6d4","#8b5cf6","#ec4899","#14b8a6",
];

// ─── Начальные данные (реальные характеристики) ───────────────────────────────
const INITIAL_FANS: FanType[] = [
  {
    id: "avh125", name: "AVH125", diameter: 1.2, minRPM: 0, maxRPM: 1780, expanded: true,
    characteristics: [
      { id: "c1", bladeAngle: 40, rpm: 1780, reverse: false, color: CURVE_COLORS[0],
        curve: [[20,2400],[25,2300],[30,2100],[35,1750],[40,1200],[45,500],[47,0]],
        powerCurve: [[20,-0.1],[25,0],[30,0.05],[35,0.08],[40,0.06],[45,0.02],[47,0]] },
      { id: "c2", bladeAngle: 44, rpm: 1780, reverse: false, color: CURVE_COLORS[1],
        curve: [[20,2350],[25,2250],[30,2050],[35,1700],[40,1150],[45,450],[48,0]],
        powerCurve: [[20,-0.05],[25,0.05],[30,0.1],[35,0.12],[40,0.09],[45,0.03],[48,0]] },
      { id: "c3", bladeAngle: 48, rpm: 1780, reverse: false, color: CURVE_COLORS[2],
        curve: [[20,2200],[25,2100],[30,1950],[35,1600],[40,1100],[46,400],[50,0]],
        powerCurve: [[20,0],[25,0.08],[30,0.15],[35,0.18],[40,0.14],[46,0.05],[50,0]] },
      { id: "c4", bladeAngle: 52, rpm: 1780, reverse: false, color: CURVE_COLORS[3],
        curve: [[20,2050],[25,1950],[30,1800],[35,1500],[40,1050],[47,350],[52,0]],
        powerCurve: [[20,0.05],[25,0.12],[30,0.2],[35,0.22],[40,0.17],[47,0.06],[52,0]] },
      { id: "c5", bladeAngle: 56, rpm: 1780, reverse: false, color: CURVE_COLORS[4],
        curve: [[20,1850],[25,1750],[30,1600],[35,1350],[40,950],[48,300],[54,0]],
        powerCurve: [[20,0.08],[25,0.16],[30,0.24],[35,0.26],[40,0.2],[48,0.07],[54,0]] },
      { id: "c6", bladeAngle: 60, rpm: 1780, reverse: false, color: CURVE_COLORS[5],
        curve: [[20,1600],[25,1500],[30,1400],[35,1200],[40,850],[49,250],[56,0]],
        powerCurve: [[20,0.1],[25,0.2],[30,0.28],[35,0.3],[40,0.23],[49,0.08],[56,0]] },
    ],
  },
  {
    id: "vme8", name: "ВМЭ-8", diameter: 0.8, minRPM: 0, maxRPM: 3000, expanded: false,
    characteristics: [
      { id: "v1", bladeAngle: 0, rpm: 3000, reverse: false, color: CURVE_COLORS[0],
        curve: [[2,3800],[4,3600],[6,3200],[8,2500],[10,1500],[12,400],[13,0]],
        powerCurve: [[2,10],[4,18],[6,24],[8,28],[10,22],[12,12],[13,0]] },
      { id: "v2", bladeAngle: 0, rpm: 2800, reverse: false, color: CURVE_COLORS[1],
        curve: [[2,3300],[4,3100],[6,2800],[8,2200],[10,1300],[12,300],[13,0]],
        powerCurve: [[2,8],[4,15],[6,20],[8,24],[10,18],[12,9],[13,0]] },
    ],
  },
  {
    id: "vod40", name: "ВОД-40", diameter: 4.0, minRPM: 0, maxRPM: 985, expanded: false,
    characteristics: [
      { id: "d1", bladeAngle: 15, rpm: 985, reverse: false, color: CURVE_COLORS[0],
        curve: [[80,1400],[120,1300],[160,1100],[200,800],[240,400],[260,0]],
        powerCurve: [[80,200],[120,280],[160,350],[200,380],[240,300],[260,0]] },
      { id: "d2", bladeAngle: 20, rpm: 985, reverse: false, color: CURVE_COLORS[1],
        curve: [[80,1200],[120,1100],[160,950],[200,700],[240,350],[270,0]],
        powerCurve: [[80,180],[120,250],[160,310],[200,340],[240,260],[270,0]] },
    ],
  },
  { id: "vme12a", name: "ВМЭ-12А", diameter: 1.2, minRPM: 0, maxRPM: 1480, expanded: false, characteristics: [] },
  { id: "vme6", name: "ВМЭ-6", diameter: 0.6, minRPM: 0, maxRPM: 3000, expanded: false, characteristics: [] },
  { id: "vme8m", name: "ВМЭ-6МхВШМП8", diameter: 0.7, minRPM: 0, maxRPM: 2980, expanded: false, characteristics: [] },
  { id: "vod30", name: "ВОД-30", diameter: 3.0, minRPM: 750, maxRPM: 750, expanded: false, characteristics: [] },
  { id: "vcp16", name: "ВЦП-16", diameter: 1.6, minRPM: 0, maxRPM: 1480, expanded: false, characteristics: [] },
];

// ─── Мини-график Q-P на Canvas ────────────────────────────────────────────────
function QPMiniChart({ characteristics }: { characteristics: FanCharacteristic[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const W = cv.width, H = cv.height;
    const PAD = { t: 10, r: 10, b: 24, l: 36 };
    const CW = W - PAD.l - PAD.r, CH = H - PAD.t - PAD.b;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

    if (!characteristics.length) return;

    const allQ = characteristics.flatMap(c => c.curve.map(p => p[0]));
    const allP = characteristics.flatMap(c => c.curve.map(p => p[1]));
    const maxQ = Math.max(...allQ) * 1.05;
    const maxP = Math.max(...allP) * 1.1;

    const tx = (q: number) => PAD.l + (q / maxQ) * CW;
    const ty = (p: number) => PAD.t + CH - (p / maxP) * CH;

    // Сетка
    ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.t + (i / 4) * CH;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + CW, y); ctx.stroke();
      const x = PAD.l + (i / 4) * CW;
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + CH); ctx.stroke();
    }

    // Оси
    ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + CH);
    ctx.lineTo(PAD.l + CW, PAD.t + CH); ctx.stroke();

    // Подписи
    ctx.fillStyle = "#64748b"; ctx.font = "8px monospace"; ctx.textAlign = "right";
    for (let i = 0; i <= 3; i++) {
      const val = Math.round((maxP * i) / 3);
      ctx.fillText(String(val), PAD.l - 2, ty(maxP * i / 3) + 3);
    }
    ctx.textAlign = "center";
    for (let i = 0; i <= 3; i++) {
      const val = Math.round((maxQ * i) / 3);
      ctx.fillText(String(val), tx(maxQ * i / 3), PAD.t + CH + 11);
    }

    // Кривые Q-P
    characteristics.forEach(ch => {
      if (!ch.curve.length) return;
      ctx.strokeStyle = ch.color; ctx.lineWidth = 2;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      ch.curve.forEach(([q, p], i) => i === 0 ? ctx.moveTo(tx(q), ty(p)) : ctx.lineTo(tx(q), ty(p)));
      ctx.stroke();
    });
  }, [characteristics]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ro = new ResizeObserver(() => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; draw(); });
    ro.observe(cv); cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
    return () => ro.disconnect();
  }, [draw]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// ─── Мини-график мощности ─────────────────────────────────────────────────────
function PowerMiniChart({ characteristics }: { characteristics: FanCharacteristic[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const W = cv.width, H = cv.height;
    const PAD = { t: 10, r: 10, b: 24, l: 40 };
    const CW = W - PAD.l - PAD.r, CH = H - PAD.t - PAD.b;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

    if (!characteristics.some(c => c.powerCurve.length)) return;

    const allQ = characteristics.flatMap(c => c.powerCurve.map(p => p[0]));
    const allN = characteristics.flatMap(c => c.powerCurve.map(p => p[1]));
    const maxQ  = Math.max(...allQ) * 1.05;
    const absMax = Math.max(...allN.map(Math.abs)) * 1.2 || 1;
    const minN  = Math.min(...allN);
    const maxN  = Math.max(...allN);
    const range = Math.max(maxN - minN, 0.1) * 1.2;
    const midN  = (maxN + minN) / 2;

    const tx = (q: number) => PAD.l + (q / maxQ) * CW;
    const ty = (n: number) => PAD.t + CH / 2 - (n / absMax) * (CH / 2);

    // Сетка
    ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const x = PAD.l + (i / 4) * CW;
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + CH); ctx.stroke();
    }

    // Ось X (ноль)
    ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1;
    const y0 = PAD.t + CH / 2 - (0 / absMax) * (CH / 2);
    ctx.beginPath(); ctx.moveTo(PAD.l, y0); ctx.lineTo(PAD.l + CW, y0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + CH); ctx.stroke();

    // Подписи
    ctx.fillStyle = "#64748b"; ctx.font = "8px monospace";
    ctx.textAlign = "right";
    [minN, 0, maxN].forEach(v => {
      ctx.fillText(v.toFixed(1), PAD.l - 2, ty(v) + 3);
    });
    ctx.textAlign = "center";
    for (let i = 0; i <= 3; i++) {
      const val = Math.round((maxQ * i) / 3);
      ctx.fillText(String(val), tx(maxQ * i / 3), PAD.t + CH + 11);
    }

    // Кривые мощности
    characteristics.forEach(ch => {
      if (!ch.powerCurve.length) return;
      ctx.strokeStyle = ch.color; ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ch.powerCurve.forEach(([q, n], i) => i === 0 ? ctx.moveTo(tx(q), ty(n)) : ctx.lineTo(tx(q), ty(n)));
      ctx.stroke();
    });
    void range; void midN;
  }, [characteristics]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ro = new ResizeObserver(() => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; draw(); });
    ro.observe(cv); cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
    return () => ro.disconnect();
  }, [draw]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// ─── Строка характеристики ────────────────────────────────────────────────────
function CharRow({
  ch, onChange, onDelete,
}: {
  ch: FanCharacteristic;
  onChange: (patch: Partial<FanCharacteristic>) => void;
  onDelete: () => void;
}) {
  const inp = "w-full bg-transparent text-right text-xs font-mono outline-none border-b border-slate-200 focus:border-blue-400 px-1 py-0.5";

  return (
    <div className="flex items-center gap-0 border-b border-slate-100 hover:bg-slate-50 group"
      style={{ borderLeft: `3px solid ${ch.color}` }}>
      {/* Expand chevron (placeholder) */}
      <div className="w-6 flex-shrink-0 flex items-center justify-center py-1.5">
        <Icon name="ChevronDown" size={11} className="text-slate-300" />
      </div>

      {/* Угол лопаток */}
      <div className="w-20 flex-shrink-0 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <input type="number" min={0} max={90} value={ch.bladeAngle}
            onChange={e => onChange({ bladeAngle: parseInt(e.target.value) || 0 })}
            className={inp} style={{ width: 32 }} />
          <span className="text-xs text-slate-500">°</span>
        </div>
      </div>

      {/* Реверс */}
      <div className="w-14 flex-shrink-0 flex items-center justify-center py-1.5">
        <input type="checkbox" checked={ch.reverse}
          onChange={e => onChange({ reverse: e.target.checked })}
          className="w-3.5 h-3.5 cursor-pointer" />
      </div>

      {/* Скорость */}
      <div className="w-28 flex-shrink-0 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <input type="number" min={0} value={ch.rpm}
            onChange={e => onChange({ rpm: parseInt(e.target.value) || 0 })}
            className={inp} style={{ width: 52 }} />
          <span className="text-xs text-slate-500">об/мин</span>
        </div>
      </div>

      {/* Цвет кривой */}
      <div className="flex-1 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <input type="color" value={ch.color}
            onChange={e => onChange({ color: e.target.value })}
            className="h-4 w-8 cursor-pointer rounded border border-slate-200" />
          <span className="text-xs text-slate-400 font-mono">{ch.curve.length} т.</span>
        </div>
      </div>

      {/* Удалить */}
      <button onClick={onDelete}
        className="w-8 flex-shrink-0 flex items-center justify-center py-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500">
        <Icon name="Trash2" size={12} />
      </button>
    </div>
  );
}

// ─── Строка вентилятора ───────────────────────────────────────────────────────
function FanRow({
  fan, onUpdate, onDelete, onToggle,
}: {
  fan: FanType;
  onUpdate: (patch: Partial<FanType>) => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const inp = "bg-transparent text-xs font-mono outline-none border-b border-slate-200 focus:border-blue-400 px-1 py-0.5 text-right";

  const addChar = () => {
    const idx = fan.characteristics.length;
    const newChar: FanCharacteristic = {
      id: `ch_${Date.now()}`,
      bladeAngle: 40 + idx * 4,
      rpm: fan.maxRPM || 1480,
      reverse: false,
      color: CURVE_COLORS[idx % CURVE_COLORS.length],
      curve: [],
      powerCurve: [],
    };
    onUpdate({ characteristics: [...fan.characteristics, newChar] });
  };

  const updateChar = (id: string, patch: Partial<FanCharacteristic>) => {
    onUpdate({
      characteristics: fan.characteristics.map(c => c.id === id ? { ...c, ...patch } : c),
    });
  };

  const deleteChar = (id: string) => {
    onUpdate({ characteristics: fan.characteristics.filter(c => c.id !== id) });
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-2">
      {/* Заголовок строки */}
      <div className="flex items-center gap-0 bg-white hover:bg-slate-50 transition-colors">
        <button onClick={onToggle}
          className="w-8 flex-shrink-0 flex items-center justify-center py-2.5 text-slate-400 hover:text-slate-600">
          <Icon name={fan.expanded ? "ChevronDown" : "ChevronRight"} size={13} />
        </button>

        {/* Название */}
        <div className="flex-1 px-1 py-1.5">
          <input value={fan.name}
            onChange={e => onUpdate({ name: e.target.value })}
            className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none focus:text-blue-600 px-1 py-0.5"
            placeholder="Название вентилятора" />
        </div>

        {/* Диаметр */}
        <div className="w-24 flex-shrink-0 px-2 py-1.5 text-right">
          <div className="flex items-center gap-1 justify-end">
            <input type="number" step="0.1" value={fan.diameter}
              onChange={e => onUpdate({ diameter: parseFloat(e.target.value) || 0 })}
              className={inp} style={{ width: 36 }} />
            <span className="text-xs text-slate-500">м</span>
          </div>
        </div>

        {/* Мин. скорость */}
        <div className="w-28 flex-shrink-0 px-2 py-1.5">
          <div className="flex items-center gap-1 justify-end">
            <input type="number" value={fan.minRPM}
              onChange={e => onUpdate({ minRPM: parseInt(e.target.value) || 0 })}
              className={inp} style={{ width: 44 }} />
            <span className="text-xs text-slate-500">об/мин</span>
          </div>
        </div>

        {/* Макс. скорость */}
        <div className="w-28 flex-shrink-0 px-2 py-1.5">
          <div className="flex items-center gap-1 justify-end">
            <input type="number" value={fan.maxRPM}
              onChange={e => onUpdate({ maxRPM: parseInt(e.target.value) || 0 })}
              className={inp} style={{ width: 44 }} />
            <span className="text-xs text-slate-500">об/мин</span>
          </div>
        </div>

        {/* Удалить */}
        <button onClick={onDelete}
          className="w-9 flex-shrink-0 flex items-center justify-center py-2.5 text-slate-300 hover:text-red-500 transition-colors">
          <Icon name="Trash2" size={13} />
        </button>
      </div>

      {/* Развёрнутый блок */}
      {fan.expanded && (
        <div className="border-t border-slate-100">
          <div className="flex gap-0">
            {/* Таблица характеристик (левая колонка) */}
            <div className="flex-1 min-w-0">
              {/* Шапка таблицы */}
              <div className="flex items-center gap-0 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                <div className="w-6 flex-shrink-0" />
                <div className="w-20 flex-shrink-0 px-2 py-1.5">Угол лопаток</div>
                <div className="w-14 flex-shrink-0 px-2 py-1.5 text-center">Реверс</div>
                <div className="w-28 flex-shrink-0 px-2 py-1.5">Скорость</div>
                <div className="flex-1 px-2 py-1.5">Кривая</div>
                <div className="w-8 flex-shrink-0" />
              </div>

              {fan.characteristics.map(ch => (
                <CharRow key={ch.id} ch={ch}
                  onChange={patch => updateChar(ch.id, patch)}
                  onDelete={() => deleteChar(ch.id)} />
              ))}

              {/* Новая характеристика */}
              <button onClick={addChar}
                className="w-full py-2 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors text-center">
                + Новая характеристика
              </button>
            </div>

            {/* Графики (правая колонка) */}
            {fan.characteristics.length > 0 && (
              <div className="flex-shrink-0 flex gap-0 border-l border-slate-200"
                style={{ width: 380 }}>
                {/* Q-P */}
                <div className="flex-1 flex flex-col border-r border-slate-200">
                  <div className="text-center text-xs text-slate-500 py-1 border-b border-slate-100 bg-slate-50">
                    Напор, Па
                  </div>
                  <div className="flex-1" style={{ minHeight: 120 }}>
                    <QPMiniChart characteristics={fan.characteristics} />
                  </div>
                  <div className="text-center text-xs text-slate-400 pb-1">Расход воздуха, м³/с</div>
                </div>
                {/* Мощность */}
                <div className="flex-1 flex flex-col">
                  <div className="text-center text-xs text-slate-500 py-1 border-b border-slate-100 bg-slate-50">
                    Мощность, кВт
                  </div>
                  <div className="flex-1" style={{ minHeight: 120 }}>
                    <PowerMiniChart characteristics={fan.characteristics} />
                  </div>
                  <div className="text-center text-xs text-slate-400 pb-1">Расход воздуха, м³/с</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function FanCatalog() {
  const [fans, setFans]       = useState<FanType[]>(INITIAL_FANS);
  const [search, setSearch]   = useState("");
  const [filterRPM, setFilterRPM] = useState("");

  const updateFan = (id: string, patch: Partial<FanType>) => {
    setFans(fs => fs.map(f => f.id === id ? { ...f, ...patch } : f));
  };
  const deleteFan = (id: string) => setFans(fs => fs.filter(f => f.id !== id));
  const toggleFan = (id: string) => setFans(fs => fs.map(f => f.id === id ? { ...f, expanded: !f.expanded } : f));

  const createFan = () => {
    const newFan: FanType = {
      id: `fan_${Date.now()}`,
      name: "Новый вентилятор",
      diameter: 1.0,
      minRPM: 0,
      maxRPM: 1480,
      expanded: true,
      characteristics: [],
    };
    setFans(fs => [newFan, ...fs]);
  };

  const importFan = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (Array.isArray(data)) {
            setFans(fs => [...fs, ...data.map((d: FanType) => ({ ...d, id: `imp_${Date.now()}_${Math.random()}` }))]);
          }
        } catch { alert("Ошибка чтения файла"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(fans, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "fans_catalog.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = fans.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) &&
    (!filterRPM || f.maxRPM === parseInt(filterRPM))
  );

  return (
    <div className="flex h-full flex-col bg-white">
      {/* ── Шапка ── */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-2.5"
        style={{ background: "#f8fafc" }}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "hsl(var(--amber) / 0.1)" }}>
            <Icon name="Loader" size={18} style={{ color: "hsl(var(--amber))" }} />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-800">
              Типы вентиляторов
            </h2>
            <p className="text-xs text-slate-400">{fans.length} вентиляторов в справочнике</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Поиск */}
          <div className="relative">
            <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по названию..."
              className="rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400 transition-colors"
              style={{ width: 180 }} />
          </div>

          {/* Фильтр по об/мин */}
          <div className="relative">
            <Icon name="Gauge" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="number" value={filterRPM} onChange={e => setFilterRPM(e.target.value)}
              placeholder="об/мин"
              className="rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs font-mono text-slate-700 outline-none focus:border-blue-400 transition-colors"
              style={{ width: 100 }} />
          </div>

          {/* Экспорт */}
          <button onClick={exportAll}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
            <Icon name="Download" size={13} />
            Экспорт
          </button>
        </div>
      </div>

      {/* ── Шапка таблицы ── */}
      <div className="flex-shrink-0 flex items-center border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
        <div className="w-8 flex-shrink-0" />
        <div className="flex-1 px-2 py-2">Название вентилятора</div>
        <div className="w-24 flex-shrink-0 px-2 py-2 text-right">Диаметр</div>
        <div className="w-28 flex-shrink-0 px-2 py-2 text-right">Мин. скорость</div>
        <div className="w-28 flex-shrink-0 px-2 py-2 text-right">Макс. скорость</div>
        <div className="w-9 flex-shrink-0" />
      </div>

      {/* ── Список ── */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-300">
            <Icon name="Search" size={36} />
            <p className="text-sm">Вентиляторов не найдено</p>
          </div>
        )}
        {filtered.map(fan => (
          <FanRow key={fan.id} fan={fan}
            onUpdate={patch => updateFan(fan.id, patch)}
            onDelete={() => deleteFan(fan.id)}
            onToggle={() => toggleFan(fan.id)} />
        ))}
      </div>

      {/* ── Нижняя панель ── */}
      <div className="flex flex-shrink-0 items-center justify-between border-t border-slate-200 px-4 py-2"
        style={{ background: "#f8fafc" }}>
        <div className="flex items-center gap-2">
          <button onClick={importFan}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            <Icon name="Upload" size={13} />
            Импорт
          </button>
          <button onClick={createFan}
            className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-colors shadow-sm hover:opacity-90"
            style={{ background: "#1e3a5f" }}>
            <Icon name="Plus" size={13} />
            Создать
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1">
            <span className="text-xs text-slate-500 font-mono">0</span>
            <span className="text-xs text-slate-400">об/мин</span>
          </div>
          <button
            className="rounded-lg px-6 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90 shadow-sm"
            style={{ background: "#1e3a5f" }}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
