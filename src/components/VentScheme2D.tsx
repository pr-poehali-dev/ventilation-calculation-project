import React, { useRef, useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import VentScheme3DView, { Airway3D, Position3D, PlaneInfo } from "@/components/VentScheme3DView";
import DxfImportDialog from "@/components/DxfImportDialog";
import { ConvertedScheme } from "@/lib/dxfParser";
import NodePropertiesPanel, {
  NodeProperties, NodeMeasurement, NodePipe, NodeIndicator, defaultNode,
} from "@/components/NodePropertiesPanel";
import AeroCalcPanel from "@/components/AeroCalcPanel";
import { runAeroCalc, schemeToCalcGraph, CalcResult, CalcNode, CalcAirway } from "@/lib/aeroCalc";
import { linkFansToAirways, buildSegments, calcWorkingPoint, FanLink } from "@/lib/fanLinker";
import AirwayPropPanel from "@/components/AirwayPropPanel";
import SchemeRibbon from "@/components/SchemeRibbon";

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
  // Вентиляция
  ventType?: string;          // тип выработки: ВНС, ВОД, Штрек...
  sectionShape?: string;      // поперечное сечение: Арочное, Прямоугольное...
  sectionArea?: string;       // площадь, м²
  sectionManual?: boolean;    // задаётся вручную
  perimeter?: string;         // периметр, м
  lengthManual?: boolean;     // длина задаётся вручную
  aerResistMode?: string;     // как задаётся сопр.: Проектными данными, Вручную
  surface?: string;           // поверхность (тип крепи)
  alpha?: string;             // коэф-т α, кг/м³
  vMaxManual?: boolean;       // V max задаётся вручную
  vMax?: string;              // V max, м/с
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
  // Вентилятор
  fanModel?: string;
  fanDiameter?: string;      // мм
  fanRPM?: string;           // об/мин
  fanBladeAngle?: string;    // угол лопаток, °
  fanDriveType?: string;     // тип привода
  fanMotorPower?: string;    // мощность двигателя, кВт
  fanMotorVoltage?: string;  // напряжение, В
  fanInstallYear?: string;
  fanInstallMonth?: string;
  fanRemarks?: string;
  // Рабочая точка (из расчёта)
  fanWorkQ?: number;         // расход в рабочей точке, м³/с
  fanWorkP?: number;         // давление в рабочей точке, Па
  // Кривая Q-P: массив точек [Q, P]
  fanCurve?: [number, number][];
  fanEffCurve?: [number, number][]; // кривая КПД [Q, η%]
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

  // DXF импорт
  const [showDxfImport, setShowDxfImport] = useState(false);

  // ── Узлы (вершины) — хранилище свойств ───────────────────────────────────
  const [nodeProps, setNodeProps] = useState<Record<string, NodeProperties>>({});
  const [nodeMeasures] = useState<Record<string, NodeMeasurement[]>>({});
  const [nodePipes] = useState<Record<string, NodePipe[]>>({});
  const [nodeIndicators] = useState<Record<string, NodeIndicator[]>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Получаем или создаём свойства узла по ключу
  const getOrCreateNode = (key: string, _unused: number, x: number, y: number, z?: number): NodeProperties => {
    if (nodeProps[key]) return nodeProps[key];
    const nd = defaultNode(key, x, y, z);
    setNodeProps(prev => ({ ...prev, [key]: nd }));
    return nd;
  };

  const updateNodeProps = (key: string, patch: Partial<NodeProperties>) => {
    setNodeProps(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  // ── Аэродинамический расчёт ───────────────────────────────────────────────
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);
  const [calcNodes, setCalcNodes] = useState<CalcNode[]>([]);
  const [calcAirways, setCalcAirways] = useState<CalcAirway[]>([]);
  const [calcFanLinks, setCalcFanLinks] = useState<FanLink[]>([]);
  const [showCalcPanel, setShowCalcPanel] = useState(false);
  const [isCalcRunning, setIsCalcRunning] = useState(false);

  const runCalc = () => {
    setIsCalcRunning(true);
    setTimeout(() => {
      // ── 1. Узловые override-свойства ──────────────────────────────────────
      const nodeOverrides: Record<string, {
        coordZ: number; airTemp: number; wallTemp: number;
        appliedPressure: number; connectedToAtm: boolean;
      }> = {};
      Object.entries(nodeProps).forEach(([key, np]) => {
        nodeOverrides[key] = {
          coordZ: np.coordZ, airTemp: np.airTemp, wallTemp: np.wallTemp,
          appliedPressure: np.appliedPressure, connectedToAtm: np.connectedToAtm,
        };
      });

      // ── 2. Привязываем вентиляторы к ближайшим выработкам ─────────────────
      const fans = scheme.objects
        .filter(o => o.type === "fan")
        .map(o => ({
          id:          o.id,
          x:           o.x,
          y:           o.y,
          fanCurve:    o.fanCurve,
          fanPressure: o.fanPressure,
          label:       o.label,
        }));

      const rawSegs = scheme.airways.map(aw => ({
        id:     aw.id,
        points: aw.points.map(p => ({ x: p.x, y: p.y })),
      }));
      const segments  = buildSegments(rawSegs);
      const fanLinks  = linkFansToAirways(fans, segments);

      // ── 3. Конвертируем схему в граф, передаём Q-P кривые вентиляторов ────
      const { nodes, airways: calAirways } = schemeToCalcGraph(scheme.airways, nodeOverrides);

      // Патчим CalcAirway данными вентиляторов
      fanLinks.forEach(link => {
        const aw = calAirways.find(a => a.id === link.segId);
        if (!aw) return;
        if (link.curveA !== undefined && link.curveB !== undefined) {
          aw.fanCurveA  = link.curveA;
          aw.fanCurveB  = link.curveB;
          aw.fanPressure = undefined;
        } else if (link.pressure !== undefined) {
          aw.fanPressure = link.pressure;
          aw.fanCurveA   = undefined;
          aw.fanCurveB   = undefined;
        }
      });

      // ── 4. Расчёт ─────────────────────────────────────────────────────────
      const result = runAeroCalc(nodes, calAirways);

      // ── 5. Обновляем рабочие точки вентиляторов ───────────────────────────
      setScheme(s => ({
        ...s,
        objects: s.objects.map(o => {
          if (o.type !== "fan") return o;
          const link = fanLinks.find(l => l.fanId === o.id);
          if (!link) return o;

          const q   = result.airwayQ[link.segId] ?? 0;
          const dp  = result.airwayDeltaP[link.segId] ?? 0;
          const fan = result.airwayFanDeltaP?.[link.segId] ?? 0;

          // Рабочая точка: если есть кривая — вычисляем аналитически
          let workQ = Math.abs(q);
          let workP = fan > 0 ? fan : Math.abs(dp);

          if (link.curveA !== undefined && link.curveB !== undefined) {
            const R = calAirways.find(a => a.id === link.segId)
              ? result.airwayR[link.segId] ?? 0 : 0;
            const wp = calcWorkingPoint(link.curveA, link.curveB, R);
            workQ = wp.Q;
            workP = wp.P;
          }

          return { ...o, fanWorkQ: workQ, fanWorkP: workP };
        }),
      }));

      // ── 6. Обновляем вычисленные поля узлов ───────────────────────────────
      setNodeProps(prev => {
        const next = { ...prev };
        Object.entries(result.nodePressure).forEach(([nid, p]) => {
          Object.keys(next).forEach(key => {
            if (next[key].id === nid || key === nid) {
              next[key] = {
                ...next[key],
                calcPressure:       Math.round(p),
                calcAirTemp:        Math.round((result.nodeAirTemp[nid] ?? next[key].airTemp) * 10) / 10,
                calcWallTemp:       Math.round((result.nodeWallTemp[nid] ?? next[key].wallTemp) * 10) / 10,
                calcGasConc:        Math.round((result.nodeGasConc[nid] ?? 0) * 100) / 100,
                calcExplosionPressure: Math.round(result.nodeExplosionP[nid] ?? 0),
              };
            }
          });
        });
        return next;
      });

      setCalcFanLinks(fanLinks);
      setCalcNodes(nodes);
      setCalcAirways(calAirways);
      setCalcResult(result);
      setIsCalcRunning(false);
      setShowCalcPanel(true);
    }, 50);
  };

  const handleDxfImport = (data: ConvertedScheme, mode: "replace" | "append") => {
    const newAirways = data.airways.map(a => ({
      id: a.id,
      points: a.points,
      style: a.style,
      label: a.label,
      z: a.z,
    }));
    const newPositions = data.positions.map(p => ({
      id: p.id,
      x: p.x, y: p.y, z: p.z,
      num: p.num,
      color: p.color,
      label: p.label,
    }));
    if (mode === "replace") {
      setScheme({ airways: newAirways, positions: newPositions, objects: [] });
    } else {
      setScheme(s => ({
        ...s,
        airways: [...s.airways, ...newAirways],
        positions: [...s.positions, ...newPositions],
      }));
    }
  };

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
      aw.points.forEach((p, pi) => {
        const nodeKey = `${aw.id}_${pi}`;
        const isNodeSelected = selectedNodeId === nodeKey;
        const hasProps = !!nodeProps[nodeKey];

        if (isNodeSelected) {
          // Пульсирующий ореол выделенного узла
          ctx.fillStyle = "rgba(59,130,246,0.2)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = isNodeSelected ? "#3b82f6" : hasProps ? "#fbbf24" : isSelected ? "#3b82f6" : "#fff";
        ctx.strokeStyle = isNodeSelected ? "#1d4ed8" : st.color;
        ctx.lineWidth = isNodeSelected ? 2.5 : 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isNodeSelected ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Иконка — если есть свойства, ставим маленький маркер
        if (hasProps && !isNodeSelected) {
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(p.x + 6, p.y - 6, 3, 0, Math.PI * 2);
          ctx.fill();
        }
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
        // Показываем расчётные Q и v если есть результат
        const calcQ = calcResult ? (() => {
          const segKey = `${aw.id}_seg0`;
          return calcResult.airwayQ[segKey];
        })() : undefined;
        const calcV = calcResult ? (() => {
          const segKey = `${aw.id}_seg0`;
          return calcResult.airwayV[segKey];
        })() : undefined;
        if (calcQ !== undefined) {
          lines.push(`Q=${Math.abs(calcQ).toFixed(1)} м³/с  v=${(calcV??0).toFixed(1)} м/с`);
        } else if (aw.q) {
          lines.push(`Q=${aw.q} м³/с`);
        }

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

    // ── Стрелки направления воздуха (по результатам расчёта) ─────────────
    if (calcResult) {
      scheme.airways.forEach((aw) => {
        if (aw.points.length < 2) return;
        const segKey = `${aw.id}_seg0`;
        const q = calcResult.airwayQ[segKey];
        const v = calcResult.airwayV[segKey] ?? 0;
        const dir = calcResult.airwayDir[segKey] ?? 1;
        if (q === undefined) return;

        const st = AIRWAY_STYLES[aw.style];

        // Цвет стрелки по скорости
        const arrowColor =
          v > 8 ? "#ef4444" :
          v > 4 ? "#f59e0b" :
          v > 0.5 ? "#22c55e" : "#94a3b8";

        // Размер наконечника зависит от скорости
        const arrowSize = Math.max(7, Math.min(16, v * 2));

        // Рисуем стрелки вдоль каждого сегмента выработки
        for (let si = 0; si < aw.points.length - 1; si++) {
          const pA = dir === 1 ? aw.points[si] : aw.points[si + 1];
          const pB = dir === 1 ? aw.points[si + 1] : aw.points[si];

          const segLen = Math.hypot(pB.x - pA.x, pB.y - pA.y);
          if (segLen < 30) continue;

          const angle = Math.atan2(pB.y - pA.y, pB.x - pA.x);

          // Количество стрелок на сегменте (не чаще чем каждые 80px)
          const arrowCount = Math.max(1, Math.floor(segLen / 80));

          for (let ai = 0; ai < arrowCount; ai++) {
            const t = (ai + 1) / (arrowCount + 1); // позиция вдоль сегмента
            const ax = pA.x + (pB.x - pA.x) * t;
            const ay = pA.y + (pB.y - pA.y) * t;

            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(angle);

            // Фоновый кружок для читаемости
            ctx.fillStyle = "rgba(255,255,255,0.75)";
            ctx.beginPath();
            ctx.arc(0, 0, arrowSize * 0.85, 0, Math.PI * 2);
            ctx.fill();

            // Наконечник стрелки
            ctx.fillStyle = arrowColor;
            ctx.strokeStyle = arrowColor;
            ctx.lineWidth = 1.5;

            // Тело стрелки
            ctx.beginPath();
            ctx.moveTo(-arrowSize * 0.55, 0);
            ctx.lineTo(arrowSize * 0.2, 0);
            ctx.stroke();

            // Треугольник-наконечник
            ctx.beginPath();
            ctx.moveTo(arrowSize * 0.65, 0);
            ctx.lineTo(arrowSize * 0.1, -arrowSize * 0.38);
            ctx.lineTo(arrowSize * 0.1,  arrowSize * 0.38);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
          }

          // Подпись скорости на первом сегменте (в середине)
          if (si === 0 && v > 0.1) {
            const mx = (pA.x + pB.x) / 2;
            const my = (pA.y + pB.y) / 2;
            const ang = Math.atan2(pB.y - pA.y, pB.x - pA.x);

            ctx.save();
            ctx.translate(mx, my);
            ctx.rotate(ang);

            const label = `${v.toFixed(1)} м/с`;
            ctx.font = "bold 9px 'IBM Plex Mono', monospace";
            const tw = ctx.measureText(label).width;
            const yOff = st.width / 2 + 10;

            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.fillRect(-tw / 2 - 2, yOff - 9, tw + 4, 12);

            ctx.fillStyle = arrowColor;
            ctx.textAlign = "center";
            ctx.fillText(label, 0, yOff);

            ctx.restore();
          }
        }
      });
    }

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

      // ── Вентилятор: рабочая точка и линия привязки ──────────────────────
      if (obj.type === "fan") {
        const link = calcFanLinks.find(l => l.fanId === obj.id);

        // Линия привязки к выработке
        if (link) {
          const seg = scheme.airways.reduce<{ x: number; y: number } | null>((acc, aw) => {
            for (let si = 0; si < aw.points.length - 1; si++) {
              if (`${aw.id}_seg${si}` === link.segId) {
                const p1 = aw.points[si], p2 = aw.points[si + 1];
                return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
              }
            }
            return acc;
          }, null);

          if (seg) {
            ctx.strokeStyle = "rgba(251,191,36,0.45)";
            ctx.lineWidth   = 1;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(obj.x, obj.y);
            ctx.lineTo(seg.x, seg.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Маленький ромб в точке привязки
            ctx.fillStyle = "#fbbf24";
            ctx.beginPath();
            ctx.moveTo(seg.x,     seg.y - 5);
            ctx.lineTo(seg.x + 5, seg.y);
            ctx.lineTo(seg.x,     seg.y + 5);
            ctx.lineTo(seg.x - 5, seg.y);
            ctx.closePath();
            ctx.fill();
          }
        }

        // Рабочая точка (badge над вентилятором)
        if (obj.fanWorkQ !== undefined && obj.fanWorkQ > 0) {
          const wQ = obj.fanWorkQ;
          const wP = obj.fanWorkP ?? 0;

          const badge = `${wQ.toFixed(1)} м³/с · ${Math.round(wP)} Па`;
          ctx.font = "bold 9px 'IBM Plex Mono', monospace";
          const tw = ctx.measureText(badge).width;

          const bx = obj.x - tw / 2 - 5;
          const by = obj.y - 32;

          // Фон бейджа
          ctx.fillStyle = "#1e3a5f";
          ctx.fillRect(bx, by, tw + 10, 14);

          // Текст
          ctx.fillStyle = "#fbbf24";
          ctx.textAlign = "center";
          ctx.fillText(badge, obj.x, by + 10);

          // Красная точка — рабочая точка
          ctx.fillStyle = "#ef4444";
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur  = 6;
          ctx.beginPath();
          ctx.arc(obj.x + tw / 2 + 1, by + 7, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (link && calcResult) {
          // Нет рабочей точки — показываем что вентилятор привязан но Q=0
          ctx.font = "9px 'IBM Plex Sans', sans-serif";
          ctx.fillStyle = "#f59e0b";
          ctx.textAlign = "center";
          ctx.fillText("привязан", obj.x, obj.y - 28);
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
  }, [scheme, viewport, selectedId, selectedNodeId, nodeProps, tool, drawingAirway, mousePos, airwayStyle, calcResult, calcFanLinks]);

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
      // Сначала проверяем узловые точки выработок (двойной клик ← не используем, просто клик)
      let nodeHit: { key: string; x: number; y: number; z?: number } | null = null;
      for (const aw of scheme.airways) {
        for (let pi = 0; pi < aw.points.length; pi++) {
          const pt = aw.points[pi];
          if (Math.hypot(pt.x - w.x, pt.y - w.y) < 8) {
            nodeHit = { key: `${aw.id}_${pi}`, x: pt.x, y: pt.y, z: pt.z };
            break;
          }
        }
        if (nodeHit) break;
      }

      if (nodeHit) {
        // Клик по узловой точке — открываем панель узла
        getOrCreateNode(nodeHit.key, 0, nodeHit.x, nodeHit.y, nodeHit.z);
        setSelectedNodeId(nodeHit.key);
        setSelectedId(null);
        setPropPanel(null);
        return;
      }

      const hit = hitTest(w.x, w.y);
      setSelectedId(hit);
      setSelectedNodeId(null);
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

  return (
    <div className="flex h-full flex-col" style={{ background: "#f1f5f9" }}>
      {/* ── Ribbon ── */}
      <SchemeRibbon
        tool={tool}
        airwayStyle={airwayStyle}
        viewport={viewport}
        selectedId={selectedId}
        calcResult={calcResult}
        isCalcRunning={isCalcRunning}
        zoom={viewport.scale}
        onTool={setTool}
        onAirwayStyle={setAirwayStyle}
        onZoomIn={() => setViewport(v => ({ ...v, scale: Math.min(5, v.scale * 1.2) }))}
        onZoomOut={() => setViewport(v => ({ ...v, scale: Math.max(0.1, v.scale * 0.85) }))}
        onZoomReset={() => setViewport({ x: 0, y: 0, scale: 1 })}
        onDelete={() => {
          if (!selectedId) return;
          setScheme(s => ({
            airways: s.airways.filter(a => a.id !== selectedId),
            positions: s.positions.filter(p => p.id !== selectedId),
            objects: s.objects.filter(o => o.id !== selectedId),
          }));
          setSelectedId(null);
          setPropPanel(null);
        }}
        onCalc={runCalc}
        onShowCalc={() => setShowCalcPanel(v => !v)}
        onImportDxf={() => setShowDxfImport(true)}
        on3D={() => setShow3D(true)}
        onCopy={() => {}}
        onPaste={() => {}}
        onCut={() => {}}
      />

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
        {propPanel && (() => {
          // локальная вкладка панели (общие / вентиляция / аэродинамика)
          // используем ref чтобы не перерисовывать весь компонент
          return (
          <AirwayPropPanel
            propPanel={propPanel}
            selectedAirway={selectedAirway}
            selectedPos={selectedPos}
            selectedObj={selectedObj}
            selectedId={selectedId}
            calcResult={calcResult}
            inputCls={inputCls}
            POSITION_COLORS={POSITION_COLORS}
            AIRWAY_STYLES={AIRWAY_STYLES}
            updateAirway={updateAirway}
            updatePosition={updatePosition}
            updateObject={updateObject}
            onClose={() => { setPropPanel(null); setSelectedId(null); }}
            onDelete={() => {
              setScheme(s => ({
                airways: s.airways.filter(a => a.id !== selectedId),
                positions: s.positions.filter(p => p.id !== selectedId),
                objects: s.objects.filter(o => o.id !== selectedId),
              }));
              setSelectedId(null);
              setPropPanel(null);
            }}
          />
          );
        })()}
        {/* ── Панель свойств узла ── */}
        {selectedNodeId && nodeProps[selectedNodeId] && (
          <NodePropertiesPanel
            node={nodeProps[selectedNodeId]}
            measures={nodeMeasures[selectedNodeId] ?? []}
            pipes={nodePipes[selectedNodeId] ?? []}
            indicators={nodeIndicators[selectedNodeId] ?? []}
            onUpdate={patch => updateNodeProps(selectedNodeId, patch)}
            onClose={() => setSelectedNodeId(null)}
          />
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

      {/* ── Панель результатов расчёта ── */}
      {showCalcPanel && (
        <AeroCalcPanel
          result={calcResult}
          nodes={calcNodes}
          airways={calcAirways}
          fanLinks={calcFanLinks}
          fans={scheme.objects.filter(o => o.type === "fan").map(o => ({
            id: o.id, label: o.label,
            fanWorkQ: o.fanWorkQ, fanWorkP: o.fanWorkP,
            fanCurve: o.fanCurve, fanMotorPower: o.fanMotorPower,
          }))}
          onClose={() => setShowCalcPanel(false)}
          onRecalc={runCalc}
          isRunning={isCalcRunning}
        />
      )}

      {/* ── DXF импорт диалог ── */}
      {showDxfImport && (
        <DxfImportDialog
          onImport={handleDxfImport}
          onClose={() => setShowDxfImport(false)}
        />
      )}
    </div>
  );
}