import React, { useRef, useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Типы ─────────────────────────────────────────────────────────────────────
export interface Airway3D {
  id: string;
  points: { x: number; y: number; z: number }[];
  style: "main" | "branch" | "intake" | "exhaust" | "tube";
  label?: string;
  q?: string;
  l?: string;
}

export interface Position3D {
  id: string;
  x: number; y: number; z: number;
  num: number;
  color: string;
  label?: string;
}

interface Props {
  airways: Airway3D[];
  positions: Position3D[];
  onBack: () => void;
  onSetPlane: (plane: PlaneInfo) => void;
}

export interface PlaneInfo {
  normal: [number, number, number]; // единичный вектор нормали
  label: string;
}

// ─── Константы цветов ─────────────────────────────────────────────────────────
const STYLE_COLOR: Record<string, [number, number, number]> = {
  main:    [0.13, 0.77, 0.37],
  branch:  [0.38, 0.65, 0.98],
  intake:  [0.20, 0.83, 0.60],
  exhaust: [0.97, 0.53, 0.53],
  tube:    [0.67, 0.55, 0.98],
};

const STYLE_WIDTH: Record<string, number> = {
  main: 5, branch: 2.5, intake: 4, exhaust: 4, tube: 2,
};

// ─── Матричная математика (column-major, как в WebGL) ─────────────────────────
type Mat4 = Float32Array;

function mat4(): Mat4 { return new Float32Array(16); }

function identity(): Mat4 {
  const m = mat4();
  m[0]=1; m[5]=1; m[10]=1; m[15]=1;
  return m;
}

function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out = mat4();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[r + k*4] * b[k + c*4];
      out[r + c*4] = s;
    }
  }
  return out;
}

function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const m = mat4();
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

function rotateX(a: number): Mat4 {
  const m = identity();
  m[5]  =  Math.cos(a); m[9]  = Math.sin(a);
  m[6]  = -Math.sin(a); m[10] = Math.cos(a);
  return m;
}

function rotateY(a: number): Mat4 {
  const m = identity();
  m[0]  = Math.cos(a); m[8]  = -Math.sin(a);
  m[2]  = Math.sin(a); m[10] =  Math.cos(a);
  return m;
}

function translate(tx: number, ty: number, tz: number): Mat4 {
  const m = identity();
  m[12] = tx; m[13] = ty; m[14] = tz;
  return m;
}

function applyMat4(m: Mat4, x: number, y: number, z: number): [number, number, number, number] {
  const rx = m[0]*x + m[4]*y + m[8]*z  + m[12];
  const ry = m[1]*x + m[5]*y + m[9]*z  + m[13];
  const rz = m[2]*x + m[6]*y + m[10]*z + m[14];
  const rw = m[3]*x + m[7]*y + m[11]*z + m[15];
  return [rx, ry, rz, rw];
}

// ─── Предустановки вида ────────────────────────────────────────────────────────
interface ViewPreset {
  id: string;
  label: string;
  angleX: number; // радианы
  angleY: number;
  plane: PlaneInfo;
  icon: string;
}

const PRESETS: ViewPreset[] = [
  { id: "perspective", label: "Перспектива",   angleX: -0.45, angleY: 0.55,  plane: { normal: [0,1,0], label: "XZ" }, icon: "Box" },
  { id: "top",         label: "Сверху (план)", angleX: -1.57, angleY: 0,     plane: { normal: [0,1,0], label: "XZ" }, icon: "ArrowDown" },
  { id: "front",       label: "Спереди",       angleX: 0,     angleY: 0,     plane: { normal: [0,0,1], label: "XY" }, icon: "Minus" },
  { id: "side",        label: "Сбоку",         angleX: 0,     angleY: 1.57,  plane: { normal: [1,0,0], label: "YZ" }, icon: "AlignCenter" },
  { id: "isometric",   label: "Изометрия",     angleX: -0.615,angleY: 0.785, plane: { normal: [0,1,0], label: "XZ" }, icon: "Layers" },
];

// ─── Компонент ────────────────────────────────────────────────────────────────
export default function VentScheme3DView({ airways, positions, onBack, onSetPlane }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [angleX, setAngleX] = useState(-0.45);
  const [angleY, setAngleY] = useState(0.55);
  const [zoom, setZoom] = useState(1.0);
  const [preset, setPreset] = useState<string>("perspective");

  // Выбранная плоскость сечения
  const [cutPlane, setCutPlane] = useState<"none" | "XY" | "XZ" | "YZ">("none");
  const [cutPosition, setCutPosition] = useState(0.5); // 0..1

  // Выделенный элемент (hover)
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 });
  const animRef = useRef<number>(0);

  // Центр сцены — вычисляем из данных
  const bounds = useCallback(() => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    airways.forEach(aw => aw.points.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }));
    positions.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    });
    if (!isFinite(minX)) { minX=0; maxX=800; minY=0; maxY=800; minZ=0; maxZ=400; }
    return { minX, maxX, minY, maxY, minZ, maxZ,
      cx: (minX+maxX)/2, cy: (minY+maxY)/2, cz: (minZ+maxZ)/2,
      size: Math.max(maxX-minX, maxY-minY, maxZ-minZ) || 800 };
  }, [airways, positions]);

  // ── Проекция точки ────────────────────────────────────────────────────────
  const project = useCallback((
    wx: number, wy: number, wz: number,
    proj: Mat4, view: Mat4, W: number, H: number
  ): [number, number, number] => {
    const [vx, vy, vz, vw] = applyMat4(view, wx, wy, wz);
    const [px, py, , pw] = applyMat4(proj, vx, vy, vz);
    if (Math.abs(pw) < 0.001) return [-9999, -9999, vw];
    const ndcX = px / pw;
    const ndcY = py / pw;
    return [(ndcX + 1) * W / 2, (1 - ndcY) * H / 2, vw];
  }, []);

  // ── Рисование ─────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Градиентный фон
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e293b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const b = bounds();

    // Матрицы
    const sc = zoom * 2.0 / (b.size * 1.0);
    const viewMat = multiplyMat4(
      multiplyMat4(
        rotateX(angleX),
        rotateY(angleY)
      ),
      translate(-b.cx * sc, -b.cy * sc, -b.cz * sc - 4)
    );

    // Масштабируем координаты
    const scaleWorld = (x: number, y: number, z: number) => [x * sc, y * sc, z * sc] as [number,number,number];

    const projMat = perspective(Math.PI / 4, W / H, 0.01, 200);

    const proj3 = (x: number, y: number, z: number) => {
      const [sx, sy, sz] = scaleWorld(x, y, z);
      return project(sx, sy, sz, projMat, viewMat, W, H);
    };

    // ── Сетка пола ────────────────────────────────────────────────────────
    const gridCount = 10;
    const gStep = b.size / gridCount;
    ctx.strokeStyle = "rgba(148,163,184,0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridCount; i++) {
      const gx = b.minX + i * gStep;
      const gz = b.minZ;
      const [ax, ay] = proj3(gx, b.minY, gz);
      const [bx, by] = proj3(gx, b.minY, b.maxZ);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const [cx2, cy2] = proj3(b.minX, b.minY, b.minZ + i * gStep);
      const [dx, dy]   = proj3(b.maxX, b.minY, b.minZ + i * gStep);
      ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(dx, dy); ctx.stroke();
    }

    // ── Оси ───────────────────────────────────────────────────────────────
    const axLen = b.size * 0.12;
    const O = proj3(b.cx, b.minY - 5, b.cz);
    const axes = [
      { to: proj3(b.cx + axLen, b.minY - 5, b.cz), color: "#f87171", label: "X (восток)" },
      { to: proj3(b.cx, b.minY - 5 + axLen, b.cz), color: "#4ade80", label: "Y (глубина)" },
      { to: proj3(b.cx, b.minY - 5, b.cz + axLen), color: "#60a5fa", label: "Z (север)" },
    ];
    axes.forEach(({ to, color, label }) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(O[0], O[1]); ctx.lineTo(to[0], to[1]); ctx.stroke();
      // наконечник
      const dx = to[0] - O[0], dy = to[1] - O[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx/len, ny = dy/len;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(to[0], to[1]);
      ctx.lineTo(to[0] - nx*8 + ny*4, to[1] - ny*8 - nx*4);
      ctx.lineTo(to[0] - nx*8 - ny*4, to[1] - ny*8 + nx*4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = color;
      ctx.font = "bold 11px monospace";
      ctx.fillText(label, to[0] + 6, to[1] + 4);
    });

    // ── Плоскость сечения ─────────────────────────────────────────────────
    if (cutPlane !== "none") {
      const t = cutPosition;
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = "#60a5fa";

      let corners: [number, number, number][] = [];
      if (cutPlane === "XY") {
        const z = b.minZ + t * (b.maxZ - b.minZ);
        corners = [[b.minX,b.minY,z],[b.maxX,b.minY,z],[b.maxX,b.maxY,z],[b.minX,b.maxY,z]];
      } else if (cutPlane === "XZ") {
        const y = b.minY + t * (b.maxY - b.minY);
        corners = [[b.minX,y,b.minZ],[b.maxX,y,b.minZ],[b.maxX,y,b.maxZ],[b.minX,y,b.maxZ]];
      } else if (cutPlane === "YZ") {
        const x = b.minX + t * (b.maxX - b.minX);
        corners = [[x,b.minY,b.minZ],[x,b.maxY,b.minZ],[x,b.maxY,b.maxZ],[x,b.minY,b.maxZ]];
      }

      if (corners.length === 4) {
        const pts = corners.map(([cx,cy,cz]) => proj3(cx, cy, cz));
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.forEach(([px,py]) => ctx.lineTo(px, py));
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = "#93c5fd"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.forEach(([px,py]) => ctx.lineTo(px, py));
        ctx.closePath(); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ── Выработки ─────────────────────────────────────────────────────────
    // Сначала сортируем по глубине (средняя Z в view)
    const sortedAirways = [...airways].sort((a, b2) => {
      const za = a.points.reduce((s, p) => s + p.z, 0) / (a.points.length || 1);
      const zb2 = b2.points.reduce((s, p) => s + p.z, 0) / (b2.points.length || 1);
      return za - zb2;
    });

    sortedAirways.forEach((aw) => {
      if (aw.points.length < 2) return;
      const isHovered = hoveredId === aw.id;
      const col = STYLE_COLOR[aw.style] || [0.5, 0.5, 0.5];
      const width = STYLE_WIDTH[aw.style] || 2;

      const pts = aw.points.map(p => proj3(p.x, p.y, p.z));

      // Труба — пунктир
      if (aw.style === "tube") ctx.setLineDash([8, 5]);
      else ctx.setLineDash([]);

      // Glow при hover
      if (isHovered) {
        ctx.strokeStyle = `rgba(255,255,255,0.25)`;
        ctx.lineWidth = width + 8;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        pts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
        ctx.stroke();
      }

      ctx.strokeStyle = `rgb(${Math.round(col[0]*255)},${Math.round(col[1]*255)},${Math.round(col[2]*255)})`;
      ctx.lineWidth = isHovered ? width + 2 : width;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
      ctx.stroke();
      ctx.setLineDash([]);

      // Тёмная линия внутри главных
      if (width >= 4 && !isHovered) {
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        pts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
        ctx.stroke();
      }

      // Подпись в середине
      if (aw.label && pts.length >= 2) {
        const mid = Math.floor(pts.length / 2);
        const [mx, my] = [
          (pts[mid-1][0] + pts[mid][0]) / 2,
          (pts[mid-1][1] + pts[mid][1]) / 2,
        ];
        ctx.font = "bold 10px 'IBM Plex Mono', monospace";
        ctx.fillStyle = isHovered ? "#fff" : `rgba(${Math.round(col[0]*255)},${Math.round(col[1]*255)},${Math.round(col[2]*255)},0.9)`;
        ctx.textAlign = "center";
        ctx.fillText(aw.label, mx, my - 6);
        if (aw.q) {
          ctx.font = "9px monospace";
          ctx.fillStyle = "rgba(148,163,184,0.8)";
          ctx.fillText(`Q=${aw.q}`, mx, my + 6);
        }
      }

      // Узловые точки
      pts.forEach(([px, py]) => {
        ctx.fillStyle = `rgba(${Math.round(col[0]*255)},${Math.round(col[1]*255)},${Math.round(col[2]*255)},0.7)`;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // ── Позиции ───────────────────────────────────────────────────────────
    positions.forEach((pos) => {
      const [px, py] = proj3(pos.x, pos.y, pos.z);
      const isHovered = hoveredId === pos.id;
      const r = isHovered ? 16 : 13;

      // Свечение
      if (isHovered) {
        const grd = ctx.createRadialGradient(px, py, 0, px, py, 28);
        grd.addColorStop(0, pos.color + "55");
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(px, py, 28, 0, Math.PI * 2); ctx.fill();
      }

      ctx.fillStyle = pos.color;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();

      // Обводка
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = `bold ${pos.num >= 100 ? "9" : "11"}px 'IBM Plex Mono', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(pos.num), px, py);
      ctx.textBaseline = "alphabetic";

      if (pos.label && isHovered) {
        ctx.font = "10px monospace";
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "left";
        ctx.fillText(pos.label, px + r + 4, py + 4);
      }
    });

    // ── Глубинная шкала (правый край) ─────────────────────────────────────
    {
      const levels = 5;
      const bnd = bounds();
      ctx.font = "9px monospace";
      ctx.fillStyle = "rgba(148,163,184,0.6)";
      ctx.textAlign = "right";
      for (let i = 0; i <= levels; i++) {
        const z = bnd.minZ + (i / levels) * (bnd.maxZ - bnd.minZ);
        const label = `${Math.round(z)}м`;
        ctx.fillText(label, W - 8, H - 16 - i * ((H - 40) / levels));
      }
      ctx.fillStyle = "rgba(148,163,184,0.3)";
      ctx.fillText("Глубина", W - 8, H - 8);
    }

  }, [angleX, angleY, zoom, airways, positions, bounds, cutPlane, cutPosition, hoveredId, project]);

  useEffect(() => { draw(); }, [draw]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw();
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, [draw]);

  // ── Mouse ──────────────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current.dragging) {
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      setAngleY(a => a + dx * 0.008);
      setAngleX(a => Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, a + dy * 0.008)));
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
    }
  };

  const handleMouseUp = () => { dragRef.current.dragging = false; };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom(z => Math.max(0.15, Math.min(8, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  };

  // ── Предустановки вида ─────────────────────────────────────────────────────
  const applyPreset = (p: ViewPreset) => {
    setPreset(p.id);
    setAngleX(p.angleX);
    setAngleY(p.angleY);
    if (p.id === "top") {
      setCutPlane("XZ");
      setCutPosition(0.5);
    }
  };

  // ── Зафиксировать текущий вид как 2D-плоскость ────────────────────────────
  const fixPlane = () => {
    const p = PRESETS.find(p => p.id === preset) || PRESETS[0];
    onSetPlane(p.plane);
    onBack();
  };

  return (
    <div className="flex h-full flex-col" style={{ background: "#0f172a" }}>
      {/* ── Toolbar ── */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b px-3 py-1.5"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: "#1e293b" }}>

        {/* Назад */}
        <button onClick={onBack}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.08)", color: "#94a3b8" }}>
          <Icon name="ChevronLeft" size={13} />
          Вернуться в 2D
        </button>

        <div className="h-4 w-px mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />

        {/* Предустановки */}
        <span className="text-xs text-slate-500">Вид:</span>
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => applyPreset(p)}
            title={p.label}
            className="flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition-all"
            style={{
              background: preset === p.id ? "#3b82f6" : "rgba(255,255,255,0.06)",
              color: preset === p.id ? "#fff" : "#94a3b8",
            }}>
            <Icon name={p.icon} size={12} fallback="Eye" />
            <span>{p.label}</span>
          </button>
        ))}

        <div className="h-4 w-px mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />

        {/* Плоскость сечения */}
        <span className="text-xs text-slate-500">Плоскость:</span>
        {(["none","XY","XZ","YZ"] as const).map(pl => (
          <button key={pl} onClick={() => setCutPlane(pl)}
            className="h-6 w-8 rounded text-xs font-mono font-medium transition-all"
            style={{
              background: cutPlane === pl ? "#0ea5e9" : "rgba(255,255,255,0.06)",
              color: cutPlane === pl ? "#fff" : "#64748b",
            }}>
            {pl === "none" ? "—" : pl}
          </button>
        ))}

        {/* Ползунок плоскости */}
        {cutPlane !== "none" && (
          <div className="flex items-center gap-2 ml-1">
            <span className="text-xs text-slate-500">Позиция:</span>
            <input type="range" min={0} max={100} value={Math.round(cutPosition * 100)}
              onChange={e => setCutPosition(Number(e.target.value) / 100)}
              className="w-28" />
            <span className="font-mono text-xs text-slate-400">{Math.round(cutPosition * 100)}%</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Зум */}
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.min(8, z * 1.2))}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-400">
              <Icon name="ZoomIn" size={13} />
            </button>
            <span className="font-mono text-xs text-slate-500" style={{ minWidth: 38, textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom(z => Math.max(0.15, z * 0.85))}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-400">
              <Icon name="ZoomOut" size={13} />
            </button>
          </div>

          <div className="h-4 w-px" style={{ background: "rgba(255,255,255,0.1)" }} />

          {/* Зафиксировать как 2D */}
          <button onClick={fixPlane}
            className="flex items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: "#22c55e", color: "#fff" }}>
            <Icon name="Scissors" size={12} />
            Сохранить вид → 2D
          </button>
        </div>
      </div>

      {/* ── Canvas + боковая панель ── */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className="flex-1 h-full"
          style={{ cursor: dragRef.current.dragging ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* Правая мини-панель — подсказки */}
        <div className="flex w-44 flex-shrink-0 flex-col border-l p-3 gap-3 text-xs"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "#1e293b" }}>

          <div>
            <p className="font-semibold mb-1.5" style={{ color: "#94a3b8" }}>Управление</p>
            <div className="space-y-1" style={{ color: "#475569" }}>
              <p>🖱 ЛКМ + тащить — вращение</p>
              <p>🖱 Колесо — зум</p>
              <p>🖱 ПКМ + тащить — панорама</p>
            </div>
          </div>

          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

          <div>
            <p className="font-semibold mb-1.5" style={{ color: "#94a3b8" }}>Оси</p>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5"><div className="h-2 w-5 rounded" style={{ background: "#f87171" }} /><span style={{ color: "#f87171" }}>X — Восток</span></div>
              <div className="flex items-center gap-1.5"><div className="h-2 w-5 rounded" style={{ background: "#4ade80" }} /><span style={{ color: "#4ade80" }}>Y — Глубина</span></div>
              <div className="flex items-center gap-1.5"><div className="h-2 w-5 rounded" style={{ background: "#60a5fa" }} /><span style={{ color: "#60a5fa" }}>Z — Север</span></div>
            </div>
          </div>

          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

          <div>
            <p className="font-semibold mb-1.5" style={{ color: "#94a3b8" }}>Легенда</p>
            <div className="space-y-1" style={{ color: "#475569" }}>
              {[
                { c: "#22c55e", l: "Гл. ствол" },
                { c: "#60a5fa", l: "Участок" },
                { c: "#34d399", l: "Свежая" },
                { c: "#f87171", l: "Исходящая" },
                { c: "#a78bfa", l: "Труба" },
              ].map(({ c, l }) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="h-1.5 w-4 rounded" style={{ background: c }} />
                  <span style={{ color: c }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

          <div>
            <p className="text-xs mb-1" style={{ color: "#94a3b8" }}>Выработок: <span style={{ color: "#e2e8f0" }}>{airways.length}</span></p>
            <p className="text-xs mb-1" style={{ color: "#94a3b8" }}>Позиций: <span style={{ color: "#e2e8f0" }}>{positions.length}</span></p>
          </div>

          {cutPlane !== "none" && (
            <>
              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <div className="rounded p-2" style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)" }}>
                <p className="font-semibold text-sky-400 mb-1">Сечение {cutPlane}</p>
                <p className="text-xs" style={{ color: "#64748b" }}>
                  Положение: {Math.round(cutPosition * 100)}%
                </p>
                <p className="text-xs mt-1" style={{ color: "#64748b" }}>
                  Нажмите «Сохранить вид → 2D» чтобы вернуться в план
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
