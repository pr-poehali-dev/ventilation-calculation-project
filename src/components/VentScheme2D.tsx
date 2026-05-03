import React, { useRef, useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import VentScheme3DView, { Airway3D, Position3D, PlaneInfo } from "@/components/VentScheme3DView";

// ─── Типы ──────────────────────────────────────────────────────────────────────
type ToolMode =
  | "select"
  | "airway"       // рисование выработки
  | "node"         // узел (соединение)
  | "position"     // позиция (кружок с номером)
  | "fan"          // вентилятор
  | "door"         // дверь
  | "wall"         // перемычка
  | "sensor"       // датчик
  | "arrow"        // стрелка направления воздуха
  | "label"        // текстовая метка
  | "pan";

type AirwayStyle = "main" | "branch" | "intake" | "exhaust" | "tube";

interface SchemeNode {
  id: string;
  x: number;
  y: number;
}

interface Airway {
  id: string;
  points: { x: number; y: number; z?: number }[];
  style: AirwayStyle;
  label?: string;
  q?: string;    // расход воздуха
  l?: string;    // длина
  s?: string;    // сечение
  color?: string;
  z?: number;    // глубина горизонта (м)
}

interface Position {
  id: string;
  x: number;
  y: number;
  z?: number;   // глубина горизонта (м)
  num: number;
  color: string;
  label?: string;
}

interface SchemeObject {
  id: string;
  type: "fan" | "door" | "wall" | "sensor" | "arrow" | "label";
  x: number;
  y: number;
  angle: number;
  label?: string;
  params?: string;
  color?: string;
}

interface SchemeData {
  airways: Airway[];
  positions: Position[];
  objects: SchemeObject[];
}

// ─── Константы ────────────────────────────────────────────────────────────────
const AIRWAY_STYLES: Record<AirwayStyle, { width: number; color: string; dash: number[] }> = {
  main:    { width: 8,  color: "#22c55e", dash: [] },
  branch:  { width: 4,  color: "#60a5fa", dash: [] },
  intake:  { width: 6,  color: "#34d399", dash: [] },
  exhaust: { width: 6,  color: "#f87171", dash: [] },
  tube:    { width: 3,  color: "#a78bfa", dash: [6, 4] },
};

const POSITION_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
  "#14b8a6", "#f43f5e",
];

const TOOL_LABELS: Record<ToolMode, string> = {
  select:   "Выбор",
  airway:   "Выработка",
  node:     "Узел",
  position: "Позиция",
  fan:      "Вентилятор",
  door:     "Дверь",
  wall:     "Перемычка",
  sensor:   "Датчик",
  arrow:    "Направление",
  label:    "Подпись",
  pan:      "Панорама",
};

const TOOL_ICONS: Record<ToolMode, string> = {
  select:   "MousePointer",
  airway:   "Minus",
  node:     "Circle",
  position: "MapPin",
  fan:      "Loader",
  door:     "DoorOpen",
  wall:     "Columns",
  sensor:   "Activity",
  arrow:    "ArrowRight",
  label:    "Type",
  pan:      "Hand",
};

// ─── Стартовая схема ──────────────────────────────────────────────────────────
const INITIAL: SchemeData = {
  airways: [
    {
      id: "aw1",
      points: [{ x: 500, y: 100, z: 0 }, { x: 500, y: 350, z: 200 }, { x: 500, y: 700, z: 400 }],
      style: "main",
      label: "Гл. ствол",
      q: "248", l: "450", s: "12.5", z: 0,
    },
    {
      id: "aw2",
      points: [{ x: 500, y: 300, z: 180 }, { x: 700, y: 450, z: 180 }],
      style: "branch",
      label: "Откаточный гор.860",
      q: "58", l: "180", z: 180,
    },
    {
      id: "aw3",
      points: [{ x: 500, y: 500, z: 320 }, { x: 300, y: 620, z: 320 }],
      style: "intake",
      label: "Вент. ствол",
      q: "72", l: "210", z: 320,
    },
    {
      id: "aw4",
      points: [{ x: 700, y: 450, z: 180 }, { x: 800, y: 550, z: 250 }],
      style: "exhaust",
      label: "Квершлаг",
      q: "44", z: 200,
    },
    {
      id: "aw5",
      points: [{ x: 300, y: 620, z: 320 }, { x: 200, y: 720, z: 380 }],
      style: "tube",
      label: "Лава 3",
      q: "22", l: "110", z: 350,
    },
  ],
  positions: [
    { id: "p1", x: 550, y: 178, z: 0,   num: 187, color: "#22c55e", label: "ВМЗ-12 Q=14.5 м³/с" },
    { id: "p2", x: 720, y: 390, z: 180, num: 188, color: "#ef4444", label: "Гор. 860м" },
    { id: "p3", x: 280, y: 640, z: 320, num: 189, color: "#3b82f6", label: "Гор. 960м" },
  ],
  objects: [
    { id: "o1", type: "fan",    x: 500, y: 340, angle: 0,  label: "ВОД-40",  params: "Q=248 м³/с", color: "#f59e0b" },
    { id: "o2", type: "door",   x: 500, y: 460, angle: 90, label: "Двери",   params: "",            color: "#94a3b8" },
    { id: "o3", type: "sensor", x: 500, y: 270, angle: 0,  label: "ВМЗ-12",  params: "Q=14.5 м³/с", color: "#60a5fa" },
  ],
};

// ─── Рисование объектов ───────────────────────────────────────────────────────
function drawFan(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, selected: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);

  if (selected) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.stroke();

  // лопасти
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(6, -8, 12, -4, 14, 0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, selected: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);

  if (selected) { ctx.shadowColor = "#fff"; ctx.shadowBlur = 8; }

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, -8); ctx.lineTo(-14, 8);
  ctx.moveTo(14, -8); ctx.lineTo(14, 8);
  ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
  ctx.stroke();

  // дуга — открытие
  ctx.beginPath();
  ctx.arc(-14, 0, 10, 0, Math.PI / 2);
  ctx.stroke();

  ctx.restore();
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, selected: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);

  if (selected) { ctx.shadowColor = "#fff"; ctx.shadowBlur = 8; }

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, 0); ctx.lineTo(18, 0);
  ctx.stroke();

  // штриховка
  ctx.lineWidth = 1.5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 6, 0); ctx.lineTo(i * 6 - 5, 8);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSensor(ctx: CanvasRenderingContext2D, x: number, y: number, _angle: number, color: string, selected: boolean) {
  ctx.save();
  ctx.translate(x, y);

  if (selected) { ctx.shadowColor = "#fff"; ctx.shadowBlur = 8; }

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.stroke();

  // крест внутри
  ctx.beginPath();
  ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
  ctx.moveTo(0, -7); ctx.lineTo(0, 7);
  ctx.stroke();

  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, selected: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);

  if (selected) { ctx.shadowColor = "#fff"; ctx.shadowBlur = 8; }

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16, 0); ctx.lineTo(8, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(6, -6); ctx.lineTo(6, 6); ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function VentScheme2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [scheme, setScheme] = useState<SchemeData>(INITIAL);
  const [tool, setTool] = useState<ToolMode>("select");
  const [airwayStyle, setAirwayStyle] = useState<AirwayStyle>("main");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawingAirway, setDrawingAirway] = useState<{ x: number; y: number }[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [nextPositionNum, setNextPositionNum] = useState(1);
  const [nextPositionColor, setNextPositionColor] = useState(0);

  // Viewport
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const panRef = useRef<{ dragging: boolean; startX: number; startY: number; vpX: number; vpY: number }>({
    dragging: false, startX: 0, startY: 0, vpX: 0, vpY: 0,
  });
  const dragRef = useRef<{ active: boolean; objId: string; offX: number; offY: number }>({
    active: false, objId: "", offX: 0, offY: 0,
  });

  // Редактор свойств
  const [propPanel, setPropPanel] = useState<{ type: string; id: string } | null>(null);

  // Панель позиций
  const [showPositions, setShowPositions] = useState(true);

  // Input для метки
  const [labelInput, setLabelInput] = useState("");

  // 3D режим
  const [show3D, setShow3D] = useState(false);
  const [lastPlane, setLastPlane] = useState<PlaneInfo | null>(null);

  // ── Координаты холста → мировые ───────────────────────────────────────────
  const toWorld = (cx: number, cy: number) => ({
    x: (cx - viewport.x) / viewport.scale,
    y: (cy - viewport.y) / viewport.scale,
  });

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
  };

  // ── Hit-тест ──────────────────────────────────────────────────────────────
  const hitTest = (wx: number, wy: number): string | null => {
    // Позиции
    for (const p of scheme.positions) {
      if (Math.hypot(p.x - wx, p.y - wy) < 22) return p.id;
    }
    // Объекты
    for (const o of scheme.objects) {
      if (Math.hypot(o.x - wx, o.y - wy) < 20) return o.id;
    }
    // Выработки — проверяем точки
    for (const aw of scheme.airways) {
      for (const pt of aw.points) {
        if (Math.hypot(pt.x - wx, pt.y - wy) < 10) return aw.id;
      }
      // Проверяем сегменты
      for (let i = 0; i < aw.points.length - 1; i++) {
        const a = aw.points[i], b = aw.points[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 1) continue;
        const t = Math.max(0, Math.min(1, ((wx - a.x) * (b.x - a.x) + (wy - a.y) * (b.y - a.y)) / (len * len)));
        const dist = Math.hypot(wx - (a.x + t * (b.x - a.x)), wy - (a.y + t * (b.y - a.y)));
        if (dist < 8) return aw.id;
      }
    }
    return null;
  };

  // ── Рисование ────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Фон
    ctx.fillStyle = "#f8f9fb";
    ctx.fillRect(0, 0, W, H);

    // Сетка
    const gridSize = 40 * viewport.scale;
    const offX = viewport.x % gridSize;
    const offY = viewport.y % gridSize;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let x = offX; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = offY; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);

    // ── Выработки ────────────────────────────────────────────────────────
    scheme.airways.forEach((aw) => {
      const st = AIRWAY_STYLES[aw.style];
      const isSelected = selectedId === aw.id;

      if (aw.points.length < 2) return;

      // Тень / выделение
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = (st.width + 6) / viewport.scale * viewport.scale;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        aw.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();
        ctx.restore();
      }

      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (st.dash.length) ctx.setLineDash(st.dash);
      else ctx.setLineDash([]);

      ctx.beginPath();
      aw.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.setLineDash([]);

      // Белая/тёмная внутренняя линия
      if (st.width >= 6) {
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        aw.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }

      // Узловые точки
      aw.points.forEach((p) => {
        ctx.fillStyle = isSelected ? "#3b82f6" : "#fff";
        ctx.strokeStyle = st.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // Подпись выработки — в середине
      if (aw.label || aw.q) {
        const mid = Math.floor(aw.points.length / 2);
        const p1 = aw.points[mid - 1] || aw.points[0];
        const p2 = aw.points[mid] || aw.points[aw.points.length - 1];
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(ang);

        const lineH = 12;
        const lines: string[] = [];
        if (aw.label) lines.push(aw.label);
        const sub: string[] = [];
        if (aw.l) sub.push(`L=${aw.l}м`);
        if (aw.s) sub.push(`S=${aw.s}м²`);
        if (sub.length) lines.push(sub.join(", "));
        if (aw.q) lines.push(`Q=${aw.q} м³/с`);

        lines.forEach((line, li) => {
          const isFirst = li === 0;
          ctx.font = isFirst ? `bold 11px 'IBM Plex Sans', sans-serif` : `10px 'IBM Plex Sans', sans-serif`;
          const tw = ctx.measureText(line).width;

          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.fillRect(-tw / 2 - 3, -(st.width / 2) - (lines.length - li) * lineH - 4, tw + 6, 14);

          ctx.fillStyle = "#1e293b";
          ctx.textAlign = "center";
          ctx.fillText(line, 0, -(st.width / 2) - (lines.length - 1 - li) * lineH - 4);
        });

        ctx.restore();
      }
    });

    // ── Рисуемая выработка ────────────────────────────────────────────────
    if (tool === "airway" && drawingAirway.length > 0) {
      const st = AIRWAY_STYLES[airwayStyle];
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.width;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.7;
      ctx.setLineDash(st.dash.length ? st.dash : []);
      ctx.beginPath();
      drawingAirway.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // текущая точка
      ctx.fillStyle = st.color;
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Объекты ───────────────────────────────────────────────────────────
    scheme.objects.forEach((obj) => {
      const isSelected = selectedId === obj.id;
      const color = obj.color || "#94a3b8";

      switch (obj.type) {
        case "fan":    drawFan(ctx, obj.x, obj.y, obj.angle, color, isSelected); break;
        case "door":   drawDoor(ctx, obj.x, obj.y, obj.angle, color, isSelected); break;
        case "wall":   drawWall(ctx, obj.x, obj.y, obj.angle, color, isSelected); break;
        case "sensor": drawSensor(ctx, obj.x, obj.y, obj.angle, color, isSelected); break;
        case "arrow":  drawArrow(ctx, obj.x, obj.y, obj.angle, color, isSelected); break;
        case "label":
          ctx.font = "bold 12px 'IBM Plex Sans', sans-serif";
          ctx.fillStyle = "#1e293b";
          ctx.textAlign = "left";
          ctx.fillText(obj.label || "", obj.x, obj.y);
          break;
      }

      // Подпись объекта
      if (obj.label && obj.type !== "label") {
        ctx.font = "10px 'IBM Plex Sans', sans-serif";
        ctx.fillStyle = "#334155";
        ctx.textAlign = "center";
        ctx.fillText(obj.label, obj.x, obj.y + 26);
        if (obj.params) {
          ctx.fillStyle = "#64748b";
          ctx.fillText(obj.params, obj.x, obj.y + 37);
        }
      }

      // Выделение
      if (isSelected) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(obj.x - 22, obj.y - 22, 44, 44);
        ctx.setLineDash([]);
      }
    });

    // ── Позиции ───────────────────────────────────────────────────────────
    scheme.positions.forEach((pos) => {
      const isSelected = selectedId === pos.id;
      const r = 20;

      if (isSelected) {
        ctx.shadowColor = "#3b82f6";
        ctx.shadowBlur = 12;
      }

      ctx.fillStyle = pos.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) { ctx.shadowBlur = 0; }

      ctx.fillStyle = "#fff";
      ctx.font = `bold ${pos.num >= 100 ? "11" : "13"}px 'IBM Plex Sans', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(pos.num), pos.x, pos.y);
      ctx.textBaseline = "alphabetic";

      if (pos.label) {
        ctx.font = "10px 'IBM Plex Sans', sans-serif";
        ctx.fillStyle = "#334155";
        ctx.textAlign = "left";

        const tw = ctx.measureText(pos.label).width;
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.fillRect(pos.x + r + 4, pos.y - 8, tw + 6, 14);
        ctx.fillStyle = "#334155";
        ctx.fillText(pos.label, pos.x + r + 7, pos.y + 2);
      }
    });

    // Курсорная подсказка при размещении
    if (tool !== "select" && tool !== "pan" && tool !== "airway") {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [scheme, viewport, selectedId, tool, drawingAirway, mousePos, airwayStyle]);

  useEffect(() => { redraw(); }, [redraw]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      redraw();
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, [redraw]);

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { cx, cy } = getCanvasPos(e);
    const w = toWorld(cx, cy);

    if (tool === "pan" || e.button === 1) {
      panRef.current = { dragging: true, startX: cx, startY: cy, vpX: viewport.x, vpY: viewport.y };
      return;
    }

    if (tool === "select") {
      const hit = hitTest(w.x, w.y);
      setSelectedId(hit);
      setPropPanel(hit ? (() => {
        const pos = scheme.positions.find(p => p.id === hit);
        const obj = scheme.objects.find(o => o.id === hit);
        const aw = scheme.airways.find(a => a.id === hit);
        if (pos) return { type: "position", id: hit };
        if (obj) return { type: "object", id: hit };
        if (aw) return { type: "airway", id: hit };
        return null;
      })() : null);

      // Начало перетаскивания
      if (hit) {
        const pos = scheme.positions.find(p => p.id === hit);
        const obj = scheme.objects.find(o => o.id === hit);
        if (pos) dragRef.current = { active: true, objId: hit, offX: pos.x - w.x, offY: pos.y - w.y };
        if (obj) dragRef.current = { active: true, objId: hit, offX: obj.x - w.x, offY: obj.y - w.y };
      }
      return;
    }

    if (tool === "airway") {
      if (e.button === 2) {
        // ПКМ — завершить
        if (drawingAirway.length >= 2) {
          const id = `aw${Date.now()}`;
          setScheme(s => ({ ...s, airways: [...s.airways, { id, points: drawingAirway, style: airwayStyle }] }));
        }
        setDrawingAirway([]);
        return;
      }
      setDrawingAirway(pts => [...pts, { x: w.x, y: w.y }]);
      return;
    }

    if (tool === "position") {
      const id = `pos${Date.now()}`;
      setScheme(s => ({
        ...s,
        positions: [...s.positions, {
          id, x: w.x, y: w.y,
          num: nextPositionNum,
          color: POSITION_COLORS[nextPositionColor % POSITION_COLORS.length],
          label: "",
        }],
      }));
      setNextPositionNum(n => n + 1);
      setNextPositionColor(n => n + 1);
      return;
    }

    const typeMap: Record<string, SchemeObject["type"]> = {
      fan: "fan", door: "door", wall: "wall", sensor: "sensor", arrow: "arrow", label: "label",
    };
    const objType = typeMap[tool];
    if (objType) {
      const id = `obj${Date.now()}`;
      setScheme(s => ({
        ...s,
        objects: [...s.objects, {
          id, type: objType, x: w.x, y: w.y, angle: 0,
          label: objType === "label" ? labelInput || "Текст" : "",
          color: objType === "fan" ? "#f59e0b" : objType === "door" ? "#94a3b8" : objType === "wall" ? "#64748b" : objType === "sensor" ? "#60a5fa" : "#f97316",
        }],
      }));
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { cx, cy } = getCanvasPos(e);
    const w = toWorld(cx, cy);
    setMousePos(w);

    if (panRef.current.dragging) {
      const dx = cx - panRef.current.startX;
      const dy = cy - panRef.current.startY;
      setViewport(v => ({ ...v, x: panRef.current.vpX + dx, y: panRef.current.vpY + dy }));
    }

    if (dragRef.current.active && tool === "select") {
      const id = dragRef.current.objId;
      const nx = w.x + dragRef.current.offX;
      const ny = w.y + dragRef.current.offY;

      setScheme(s => ({
        ...s,
        positions: s.positions.map(p => p.id === id ? { ...p, x: nx, y: ny } : p),
        objects: s.objects.map(o => o.id === id ? { ...o, x: nx, y: ny } : o),
      }));
    }
  }, [viewport, tool]);

  const handleMouseUp = () => {
    panRef.current.dragging = false;
    dragRef.current.active = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { cx, cy } = getCanvasPos(e);
    const delta = e.deltaY > 0 ? 0.88 : 1.12;
    setViewport(v => {
      const ns = Math.max(0.1, Math.min(5, v.scale * delta));
      return {
        scale: ns,
        x: cx - (cx - v.x) * (ns / v.scale),
        y: cy - (cy - v.y) * (ns / v.scale),
      };
    });
  };

  const handleDblClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "airway" && drawingAirway.length >= 2) {
      const id = `aw${Date.now()}`;
      setScheme(s => ({ ...s, airways: [...s.airways, { id, points: drawingAirway, style: airwayStyle }] }));
      setDrawingAirway([]);
    }
  };

  // ── Удаление ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        setScheme(s => ({
          airways: s.airways.filter(a => a.id !== selectedId),
          positions: s.positions.filter(p => p.id !== selectedId),
          objects: s.objects.filter(o => o.id !== selectedId),
        }));
        setSelectedId(null);
        setPropPanel(null);
      }
      if (e.key === "Escape") {
        setDrawingAirway([]);
        setSelectedId(null);
        setPropPanel(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId]);

  // ── Свойства выбранного объекта ───────────────────────────────────────────
  const selectedAirway = propPanel?.type === "airway" ? scheme.airways.find(a => a.id === propPanel.id) : null;
  const selectedPos = propPanel?.type === "position" ? scheme.positions.find(p => p.id === propPanel.id) : null;
  const selectedObj = propPanel?.type === "object" ? scheme.objects.find(o => o.id === propPanel.id) : null;

  const updateAirway = (id: string, patch: Partial<Airway>) => {
    setScheme(s => ({ ...s, airways: s.airways.map(a => a.id === id ? { ...a, ...patch } : a) }));
  };
  const updatePosition = (id: string, patch: Partial<Position>) => {
    setScheme(s => ({ ...s, positions: s.positions.map(p => p.id === id ? { ...p, ...patch } : p) }));
  };
  const updateObject = (id: string, patch: Partial<SchemeObject>) => {
    setScheme(s => ({ ...s, objects: s.objects.map(o => o.id === id ? { ...o, ...patch } : o) }));
  };

  // ── Конвертация 2D схемы → 3D данные ────────────────────────────────────────
  const to3D = (): { airways: Airway3D[]; positions: Position3D[] } => {
    const airways3D: Airway3D[] = scheme.airways.map(aw => ({
      id: aw.id,
      style: aw.style,
      label: aw.label,
      q: aw.q,
      l: aw.l,
      points: aw.points.map((p, i) => ({
        x: p.x,
        y: aw.z !== undefined ? aw.z : (p.z ?? i * 50),  // Y = глубина
        z: p.y,  // Z = "север" (Y в 2D плане)
      })),
    }));
    const positions3D: Position3D[] = scheme.positions.map(pos => ({
      id: pos.id,
      x: pos.x,
      y: pos.z ?? 0,
      z: pos.y,
      num: pos.num,
      color: pos.color,
      label: pos.label,
    }));
    return { airways: airways3D, positions: positions3D };
  };

  // ── Если режим 3D — рендерим 3D вид ─────────────────────────────────────────
  if (show3D) {
    const data3d = to3D();
    return (
      <VentScheme3DView
        airways={data3d.airways}
        positions={data3d.positions}
        onBack={() => setShow3D(false)}
        onSetPlane={(plane) => {
          setLastPlane(plane);
          setShow3D(false);
        }}
      />
    );
  }

  const inputCls = "w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-400 transition-colors";

  const toolGroups: { label: string; tools: ToolMode[] }[] = [
    { label: "Выбор", tools: ["select", "pan"] },
    { label: "Выработки", tools: ["airway"] },
    { label: "Объекты", tools: ["fan", "door", "wall", "sensor", "arrow"] },
    { label: "Прочее", tools: ["position", "label"] },
  ];

  return (
    <div className="flex h-full flex-col" style={{ background: "#f1f5f9" }}>
      {/* ── Toolbar ── */}
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3 py-1.5 shadow-sm flex-wrap">
        {/* Заголовок */}
        <div className="flex items-center gap-2 mr-3">
          <div className="h-6 w-6 rounded flex items-center justify-center" style={{ background: "#1e3a5f" }}>
            <span className="text-white font-bold" style={{ fontSize: 10 }}>В</span>
          </div>
          <span className="font-display text-xs font-bold text-slate-700 uppercase tracking-wider">Схема</span>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* Инструменты */}
        {toolGroups.map(({ label, tools: tls }) => (
          <div key={label} className="flex items-center gap-0.5">
            {tls.map((t) => (
              <button key={t} onClick={() => setTool(t)} title={TOOL_LABELS[t]}
                className="flex h-7 w-7 items-center justify-center rounded transition-all"
                style={{ background: tool === t ? "#1e3a5f" : "transparent", color: tool === t ? "#fff" : "#475569" }}>
                <Icon name={TOOL_ICONS[t]} size={14} fallback="Circle" />
              </button>
            ))}
            <div className="h-5 w-px bg-slate-200 mx-1" />
          </div>
        ))}

        {/* Стиль выработки */}
        {tool === "airway" && (
          <div className="flex items-center gap-1 mr-2">
            <span className="text-xs text-slate-500">Тип:</span>
            {(Object.entries(AIRWAY_STYLES) as [AirwayStyle, typeof AIRWAY_STYLES[AirwayStyle]][]).map(([key, st]) => (
              <button key={key} onClick={() => setAirwayStyle(key)}
                title={key}
                className="h-6 px-2 rounded text-xs font-medium border transition-all"
                style={{
                  borderColor: airwayStyle === key ? st.color : "#e2e8f0",
                  background: airwayStyle === key ? st.color : "white",
                  color: airwayStyle === key ? "#fff" : "#64748b",
                }}>
                {key === "main" ? "Гл." : key === "branch" ? "Уч." : key === "intake" ? "Свеж." : key === "exhaust" ? "Исх." : "Труба"}
              </button>
            ))}
            <span className="text-xs text-slate-400 ml-1">ДвКлик/ПКМ — завершить</span>
          </div>
        )}

        {tool === "label" && (
          <input value={labelInput} onChange={e => setLabelInput(e.target.value)}
            placeholder="Текст метки..."
            className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-400"
            style={{ width: 130 }} />
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Зум */}
          <div className="flex items-center gap-1">
            <button onClick={() => setViewport(v => ({ ...v, scale: Math.min(5, v.scale * 1.2) }))}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500">
              <Icon name="ZoomIn" size={13} />
            </button>
            <span className="font-mono text-xs text-slate-500" style={{ minWidth: 38, textAlign: "center" }}>
              {Math.round(viewport.scale * 100)}%
            </span>
            <button onClick={() => setViewport(v => ({ ...v, scale: Math.max(0.1, v.scale * 0.85) }))}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500">
              <Icon name="ZoomOut" size={13} />
            </button>
          </div>
          <button onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
            className="h-6 px-2 rounded text-xs hover:bg-slate-100 text-slate-500">
            Сброс
          </button>

          <div className="h-5 w-px bg-slate-200" />

          {/* Кнопка 3D */}
          <button onClick={() => setShow3D(true)}
            className="flex items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: "#1e3a5f", color: "#fff" }}
            title={lastPlane ? `Последний вид: ${lastPlane.label}` : "Открыть 3D-просмотр"}>
            <Icon name="Box" size={13} />
            {lastPlane ? `3D · ${lastPlane.label}` : "Просмотр 3D"}
          </button>
        </div>
      </div>

      {/* ── Основная область ── */}
      <div className="flex flex-1 min-h-0">
        {/* Левая панель позиций */}
        <div className="flex w-52 flex-shrink-0 flex-col border-r border-slate-200 bg-white"
          style={{ display: showPositions ? "flex" : "none" }}>
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="font-display text-xs font-semibold uppercase tracking-wider text-slate-600">Позиции</span>
            <button onClick={() => setShowPositions(false)} className="text-slate-300 hover:text-slate-500">
              <Icon name="X" size={13} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {scheme.positions.map((pos) => (
              <div key={pos.id}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 transition-colors hover:bg-slate-50"
                style={{ background: selectedId === pos.id ? "#eff6ff" : undefined }}
                onClick={() => { setSelectedId(pos.id); setPropPanel({ type: "position", id: pos.id }); }}>
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: pos.color, fontSize: 11, fontWeight: 700 }}>
                  {pos.num}
                </div>
                <span className="flex-1 truncate text-xs text-slate-600">{pos.label || `Позиция ${pos.num}`}</span>
              </div>
            ))}
            {scheme.positions.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-slate-300">Нет позиций</p>
            )}
          </div>

          <div className="border-t border-slate-100 px-3 py-2">
            <button onClick={() => setTool("position")}
              className="flex w-full items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-all hover:opacity-90"
              style={{ background: "#1e3a5f", color: "#fff" }}>
              <Icon name="Plus" size={12} />
              Добавить позицию
            </button>
          </div>
        </div>

        {!showPositions && (
          <button onClick={() => setShowPositions(true)}
            className="flex-shrink-0 border-r border-slate-200 bg-white px-1.5 hover:bg-slate-50"
            title="Показать позиции">
            <Icon name="ChevronRight" size={12} className="text-slate-400" />
          </button>
        )}

        {/* Canvas */}
        <div className="relative flex-1">
          <canvas
            ref={canvasRef}
            className="h-full w-full"
            style={{ cursor: tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onDoubleClick={handleDblClick}
            onContextMenu={(e) => { e.preventDefault(); if (tool === "airway") { handleMouseDown({ ...e, button: 2 } as React.MouseEvent<HTMLCanvasElement>); } }}
          />

          {/* Координаты */}
          <div className="absolute bottom-2 right-2 flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1">
            <span className="font-mono text-xs text-slate-400">
              X: {Math.round(mousePos.x)} Y: {Math.round(mousePos.y)}
            </span>
          </div>

          {/* Подсказка активного инструмента */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1">
            <Icon name={TOOL_ICONS[tool]} size={12} className="text-slate-500" fallback="Circle" />
            <span className="text-xs text-slate-500">{TOOL_LABELS[tool]}</span>
            {tool === "select" && selectedId && (
              <span className="text-xs text-slate-400">· Del — удалить</span>
            )}
          </div>
        </div>

        {/* Правая панель свойств */}
        {propPanel && (
          <div className="flex w-60 flex-shrink-0 flex-col border-l border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <span className="font-display text-xs font-semibold uppercase tracking-wider text-slate-600">
                {propPanel.type === "airway" ? "Выработка" : propPanel.type === "position" ? "Позиция" : "Объект"}
              </span>
              <button onClick={() => { setPropPanel(null); setSelectedId(null); }} className="text-slate-300 hover:text-slate-500">
                <Icon name="X" size={13} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Свойства выработки */}
              {selectedAirway && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Название</label>
                    <input className={inputCls} value={selectedAirway.label || ""} onChange={e => updateAirway(selectedAirway.id, { label: e.target.value })} placeholder="Название выработки" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Тип</label>
                    <select className={inputCls} value={selectedAirway.style}
                      onChange={e => updateAirway(selectedAirway.id, { style: e.target.value as AirwayStyle })}>
                      <option value="main">Главный ствол</option>
                      <option value="branch">Участковая</option>
                      <option value="intake">Свежая струя</option>
                      <option value="exhaust">Исходящая</option>
                      <option value="tube">Труба/Лава</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "q", label: "Q, м³/с" },
                      { key: "l", label: "L, м" },
                      { key: "s", label: "S, м²" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="mb-1 block text-xs text-slate-400">{f.label}</label>
                        <input className={inputCls} type="number"
                          value={(selectedAirway as Record<string, string | undefined>)[f.key] || ""}
                          onChange={e => updateAirway(selectedAirway.id, { [f.key]: e.target.value })} />
                      </div>
                    ))}
                  </div>
                  {/* Глубина горизонта */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Глубина горизонта, м</label>
                    <input className={inputCls} type="number"
                      value={selectedAirway.z ?? ""}
                      placeholder="напр. 860"
                      onChange={e => updateAirway(selectedAirway.id, { z: e.target.value ? parseFloat(e.target.value) : undefined })} />
                    <p className="mt-0.5 text-xs text-slate-400">Используется в 3D-просмотре как Y-координата</p>
                  </div>
                  {/* Цвет */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Цвет</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {["#22c55e","#60a5fa","#34d399","#f87171","#a78bfa","#f59e0b","#1e293b"].map(c => (
                        <button key={c} onClick={() => {}}
                          className="h-5 w-5 rounded-full border-2"
                          style={{ background: c, borderColor: AIRWAY_STYLES[selectedAirway.style].color === c ? "#3b82f6" : "transparent" }} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Свойства позиции */}
              {selectedPos && (
                <>
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
                    <input className={inputCls} type="number"
                      value={selectedPos.z ?? ""}
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
                </>
              )}

              {/* Свойства объекта */}
              {selectedObj && (
                <>
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
                </>
              )}
            </div>

            {/* Удалить */}
            {selectedId && (
              <div className="border-t border-slate-100 p-3">
                <button
                  onClick={() => {
                    setScheme(s => ({
                      airways: s.airways.filter(a => a.id !== selectedId),
                      positions: s.positions.filter(p => p.id !== selectedId),
                      objects: s.objects.filter(o => o.id !== selectedId),
                    }));
                    setSelectedId(null);
                    setPropPanel(null);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-all hover:opacity-80"
                  style={{ background: "#fee2e2", color: "#dc2626" }}>
                  <Icon name="Trash2" size={12} />
                  Удалить
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Легенда ── */}
      <div className="flex flex-shrink-0 items-center gap-4 border-t border-slate-200 bg-white px-4 py-1.5">
        <span className="text-xs font-medium text-slate-500">Условные обозначения:</span>
        {(Object.entries(AIRWAY_STYLES) as [AirwayStyle, typeof AIRWAY_STYLES[AirwayStyle]][]).map(([key, st]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="rounded" style={{ width: 24, height: st.width, background: st.color, borderRadius: 2 }} />
            <span className="text-xs text-slate-500">
              {key === "main" ? "Главный ствол" : key === "branch" ? "Участок" : key === "intake" ? "Свежая струя" : key === "exhaust" ? "Исходящая" : "Труба/Лава"}
            </span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
          <span>Точек: {scheme.airways.reduce((n, a) => n + a.points.length, 0)}</span>
          <span>Выработок: {scheme.airways.length}</span>
          <span>Позиций: {scheme.positions.length}</span>
          <span>Объектов: {scheme.objects.length}</span>
        </div>
      </div>
    </div>
  );
}