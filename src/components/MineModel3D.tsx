import React, { useRef, useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Типы ─────────────────────────────────────────────────────────────────────
export interface Point3D {
  id: string;
  x: number;
  y: number;
  z: number;
  label?: string;
  color?: string;
}

export interface Edge3D {
  id: string;
  from: string;
  to: string;
  color?: string;
}

interface Camera {
  rotX: number; // pitch
  rotY: number; // yaw
  zoom: number;
  panX: number;
  panY: number;
}

// ─── 3D → 2D проекция ─────────────────────────────────────────────────────────
function project(
  x: number, y: number, z: number,
  cam: Camera,
  cx: number, cy: number
): { sx: number; sy: number; depth: number } {
  // Вращение вокруг Y (yaw)
  const cosY = Math.cos(cam.rotY), sinY = Math.sin(cam.rotY);
  const x1 = x * cosY - z * sinY;
  const z1 = x * sinY + z * cosY;

  // Вращение вокруг X (pitch)
  const cosX = Math.cos(cam.rotX), sinX = Math.sin(cam.rotX);
  const y1 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX;

  // Перспективная проекция
  const fov = 600 * cam.zoom;
  const depth = z2 + 800;
  const scale = fov / Math.max(depth, 1);

  return {
    sx: cx + x1 * scale + cam.panX,
    sy: cy - y1 * scale + cam.panY,
    depth: z2,
  };
}

// ─── Ortho проекция для маленьких видов ───────────────────────────────────────
function projectOrtho(
  ax: number, ay: number,
  scale: number, cx: number, cy: number
): { sx: number; sy: number } {
  return { sx: cx + ax * scale, sy: cy - ay * scale };
}

// ─── Рисование сцены ──────────────────────────────────────────────────────────
function drawScene(
  ctx: CanvasRenderingContext2D,
  points: Point3D[],
  edges: Edge3D[],
  cam: Camera,
  width: number,
  height: number,
  hoveredId: string | null
) {
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;

  // ── фон ───────────────────────────────────────────────────────────────────
  ctx.fillStyle = "hsl(220 18% 9%)";
  ctx.fillRect(0, 0, width, height);

  // Сетка
  ctx.strokeStyle = "hsl(220 15% 14%)";
  ctx.lineWidth = 1;
  const gridStep = 50 * cam.zoom;
  const gridCount = 12;
  for (let i = -gridCount; i <= gridCount; i++) {
    const px = project(i * 50, 0, -gridCount * 50, cam, cx, cy);
    const px2 = project(i * 50, 0, gridCount * 50, cam, cx, cy);
    ctx.beginPath();
    ctx.moveTo(px.sx, px.sy);
    ctx.lineTo(px2.sx, px2.sy);
    ctx.stroke();

    const py = project(-gridCount * 50, 0, i * 50, cam, cx, cy);
    const py2 = project(gridCount * 50, 0, i * 50, cam, cx, cy);
    ctx.beginPath();
    ctx.moveTo(py.sx, py.sy);
    ctx.lineTo(py2.sx, py2.sy);
    ctx.stroke();
  }

  // Оси координат
  const axisLen = 80;
  const origin = project(0, 0, 0, cam, cx, cy);
  const axisX = project(axisLen, 0, 0, cam, cx, cy);
  const axisY = project(0, axisLen, 0, cam, cx, cy);
  const axisZ = project(0, 0, axisLen, cam, cx, cy);

  const axes = [
    { to: axisX, color: "hsl(350 70% 55%)", label: "X" },
    { to: axisY, color: "hsl(158 60% 42%)", label: "Y" },
    { to: axisZ, color: "hsl(var(--cyan, 195 80% 45%))", label: "Z" },
  ];

  axes.forEach(({ to, color, label }) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin.sx, origin.sy);
    ctx.lineTo(to.sx, to.sy);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "bold 11px 'IBM Plex Mono', monospace";
    ctx.fillText(label, to.sx + 5, to.sy - 5);
  });

  if (points.length === 0) {
    ctx.fillStyle = "hsl(215 15% 35%)";
    ctx.font = "14px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Добавьте точки для построения модели", cx, cy + 40);
    ctx.textAlign = "left";
    return;
  }

  // ── Рёбра ─────────────────────────────────────────────────────────────────
  const ptMap = new Map(points.map((p) => [p.id, p]));

  edges.forEach((e) => {
    const from = ptMap.get(e.from);
    const to = ptMap.get(e.to);
    if (!from || !to) return;

    const p1 = project(from.x, from.y, from.z, cam, cx, cy);
    const p2 = project(to.x, to.y, to.z, cam, cx, cy);

    const edgeColor = e.color || "hsl(38 95% 55%)";
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = hoveredId === e.id ? 3 : 1.5;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // ── Точки ─────────────────────────────────────────────────────────────────
  const projected = points.map((pt) => ({
    pt,
    proj: project(pt.x, pt.y, pt.z, cam, cx, cy),
  })).sort((a, b) => a.proj.depth - b.proj.depth);

  projected.forEach(({ pt, proj }) => {
    const isHovered = hoveredId === pt.id;
    const r = isHovered ? 8 : 5;
    const ptColor = pt.color || "hsl(38 95% 55%)";

    // Glow
    if (isHovered) {
      const grad = ctx.createRadialGradient(proj.sx, proj.sy, 0, proj.sx, proj.sy, 18);
      grad.addColorStop(0, ptColor.replace(")", " / 0.4)").replace("hsl(", "hsl("));
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Точка
    ctx.fillStyle = ptColor;
    ctx.strokeStyle = "hsl(220 18% 9%)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(proj.sx, proj.sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Метка
    ctx.fillStyle = isHovered ? "#fff" : "hsl(210 20% 75%)";
    ctx.font = `${isHovered ? "bold " : ""}11px 'IBM Plex Mono', monospace`;
    ctx.textAlign = "left";
    const label = pt.label || pt.id;
    ctx.fillText(label, proj.sx + r + 4, proj.sy - r);

    // Координаты при hover
    if (isHovered) {
      ctx.fillStyle = "hsl(215 15% 55%)";
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.fillText(`(${pt.x}, ${pt.y}, ${pt.z})`, proj.sx + r + 4, proj.sy + 4);
    }
  });
}

// ─── Маленький ортогональный вид ──────────────────────────────────────────────
function drawOrthoView(
  ctx: CanvasRenderingContext2D,
  points: Point3D[],
  edges: Edge3D[],
  axes: [keyof Point3D, keyof Point3D],
  label: string,
  width: number,
  height: number
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "hsl(220 20% 7%)";
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = "hsl(220 15% 18%)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // Label
  ctx.fillStyle = "hsl(215 15% 40%)";
  ctx.font = "9px 'IBM Plex Mono', monospace";
  ctx.fillText(label, 6, 13);

  if (points.length === 0) return;

  const cx = width / 2;
  const cy = height / 2;

  // Авто-масштаб
  const vals0 = points.map((p) => p[axes[0]] as number);
  const vals1 = points.map((p) => p[axes[1]] as number);
  const range = Math.max(
    Math.max(...vals0) - Math.min(...vals0),
    Math.max(...vals1) - Math.min(...vals1),
    1
  );
  const scale = (Math.min(width, height) * 0.7) / range;
  const off0 = (Math.max(...vals0) + Math.min(...vals0)) / 2;
  const off1 = (Math.max(...vals1) + Math.min(...vals1)) / 2;

  // Сетка
  ctx.strokeStyle = "hsl(220 15% 13%)";
  ctx.lineWidth = 1;
  for (let i = -6; i <= 6; i++) {
    const v = i * (range / 6);
    const { sx } = projectOrtho(v, 0, scale, cx - off0 * scale, cy);
    const { sy } = projectOrtho(0, v, scale, cx, cy + off1 * scale);
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(width, sy); ctx.stroke();
  }

  const ptMap = new Map(points.map((p) => [p.id, p]));

  // Рёбра
  edges.forEach((e) => {
    const from = ptMap.get(e.from);
    const to = ptMap.get(e.to);
    if (!from || !to) return;
    const p1 = projectOrtho(
      (from[axes[0]] as number) - off0,
      (from[axes[1]] as number) - off1,
      scale, cx, cy
    );
    const p2 = projectOrtho(
      (to[axes[0]] as number) - off0,
      (to[axes[1]] as number) - off1,
      scale, cx, cy
    );
    ctx.strokeStyle = e.color || "hsl(38 95% 55% / 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.stroke();
  });

  // Точки
  points.forEach((pt) => {
    const { sx, sy } = projectOrtho(
      (pt[axes[0]] as number) - off0,
      (pt[axes[1]] as number) - off1,
      scale, cx, cy
    );
    ctx.fillStyle = pt.color || "hsl(38 95% 55%)";
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ─── Константы ────────────────────────────────────────────────────────────────
const EDGE_COLORS = [
  "hsl(38 95% 55%)",
  "hsl(195 80% 45%)",
  "hsl(158 60% 42%)",
  "hsl(350 70% 55%)",
  "hsl(260 70% 65%)",
];

const DEFAULT_POINTS: Point3D[] = [
  { id: "A", x: 0, y: 0, z: 0, label: "A" },
  { id: "B", x: 200, y: 0, z: 0, label: "B" },
  { id: "C", x: 200, y: 0, z: 150, label: "C" },
  { id: "D", x: 0, y: 0, z: 150, label: "D" },
  { id: "E", x: 0, y: -80, z: 0, label: "E" },
  { id: "F", x: 200, y: -80, z: 0, label: "F" },
];

const DEFAULT_EDGES: Edge3D[] = [
  { id: "e1", from: "A", to: "B", color: "hsl(38 95% 55%)" },
  { id: "e2", from: "B", to: "C", color: "hsl(38 95% 55%)" },
  { id: "e3", from: "C", to: "D", color: "hsl(38 95% 55%)" },
  { id: "e4", from: "D", to: "A", color: "hsl(38 95% 55%)" },
  { id: "e5", from: "A", to: "E", color: "hsl(195 80% 45%)" },
  { id: "e6", from: "B", to: "F", color: "hsl(195 80% 45%)" },
  { id: "e7", from: "E", to: "F", color: "hsl(195 80% 45%)" },
];

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function MineModel3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orthoXYRef = useRef<HTMLCanvasElement>(null);
  const orthoXZRef = useRef<HTMLCanvasElement>(null);
  const orthoYZRef = useRef<HTMLCanvasElement>(null);

  const [points, setPoints] = useState<Point3D[]>(DEFAULT_POINTS);
  const [edges, setEdges] = useState<Edge3D[]>(DEFAULT_EDGES);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [cam, setCam] = useState<Camera>({ rotX: -0.35, rotY: 0.5, zoom: 1, panX: 0, panY: 0 });

  // Форма добавления точки
  const [newPt, setNewPt] = useState({ x: "", y: "", z: "", label: "" });
  const [newEdge, setNewEdge] = useState({ from: "", to: "", color: EDGE_COLORS[0] });
  const [tab, setTab] = useState<"points" | "edges">("points");
  const [error, setError] = useState("");

  // Drag
  const dragRef = useRef<{ dragging: boolean; lastX: number; lastY: number; mode: "rotate" | "pan" }>({
    dragging: false, lastX: 0, lastY: 0, mode: "rotate",
  });

  // ── Draw ──────────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, points, edges, cam, canvas.width, canvas.height, hoveredId);

    // Ortho views
    const views: [React.RefObject<HTMLCanvasElement | null>, [keyof Point3D, keyof Point3D], string][] = [
      [orthoXYRef, ["x", "y"], "Plan XY"],
      [orthoXZRef, ["x", "z"], "Facade XZ"],
      [orthoYZRef, ["y", "z"], "Profile YZ"],
    ];
    views.forEach(([ref, axes, lbl]) => {
      const c = ref.current;
      if (!c) return;
      const oc = c.getContext("2d");
      if (!oc) return;
      drawOrthoView(oc, points, edges, axes, lbl, c.width, c.height);
    });
  }, [points, edges, cam, hoveredId]);

  useEffect(() => { redraw(); }, [redraw]);

  // Resize
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
    redraw();
    return () => ro.disconnect();
  }, [redraw]);

  // ── Mouse events ──────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      dragging: true,
      lastX: e.clientX,
      lastY: e.clientY,
      mode: e.button === 2 || e.ctrlKey ? "pan" : "rotate",
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const dr = dragRef.current;
    if (dr.dragging) {
      const dx = e.clientX - dr.lastX;
      const dy = e.clientY - dr.lastY;
      if (dr.mode === "rotate") {
        setCam((c) => ({ ...c, rotY: c.rotY + dx * 0.008, rotX: c.rotX + dy * 0.008 }));
      } else {
        setCam((c) => ({ ...c, panX: c.panX + dx, panY: c.panY + dy }));
      }
      dr.lastX = e.clientX;
      dr.lastY = e.clientY;
    }
  };

  const handleMouseUp = () => { dragRef.current.dragging = false; };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setCam((c) => ({ ...c, zoom: Math.max(0.1, Math.min(5, c.zoom * delta)) }));
  };

  // Touch events
  const touchRef = useRef<{ lastX: number; lastY: number; dist: number }>({ lastX: 0, lastY: 0, dist: 0 });

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      touchRef.current.lastX = e.touches[0].clientX;
      touchRef.current.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current.dist = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchRef.current.lastX;
      const dy = e.touches[0].clientY - touchRef.current.lastY;
      setCam((c) => ({ ...c, rotY: c.rotY + dx * 0.008, rotX: c.rotX + dy * 0.008 }));
      touchRef.current.lastX = e.touches[0].clientX;
      touchRef.current.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = dist / touchRef.current.dist;
      setCam((c) => ({ ...c, zoom: Math.max(0.1, Math.min(5, c.zoom * delta)) }));
      touchRef.current.dist = dist;
    }
  };

  // ── Добавление точки ──────────────────────────────────────────────────────
  const addPoint = () => {
    const x = parseFloat(newPt.x);
    const y = parseFloat(newPt.y);
    const z = parseFloat(newPt.z);

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      setError("Введите корректные числа X, Y, Z");
      return;
    }

    const id = newPt.label.trim() || `P${points.length + 1}`;
    if (points.find((p) => p.id === id)) {
      setError(`Точка с именем "${id}" уже существует`);
      return;
    }

    setPoints((pts) => [...pts, { id, x, y, z, label: id, color: "hsl(38 95% 55%)" }]);
    setNewPt({ x: "", y: "", z: "", label: "" });
    setError("");
  };

  // ── Добавление ребра ──────────────────────────────────────────────────────
  const addEdge = () => {
    if (!newEdge.from || !newEdge.to) {
      setError("Выберите обе точки ребра");
      return;
    }
    if (newEdge.from === newEdge.to) {
      setError("Точки должны быть разными");
      return;
    }
    const edgeId = `${newEdge.from}-${newEdge.to}`;
    if (edges.find((e) => e.id === edgeId || (e.from === newEdge.from && e.to === newEdge.to))) {
      setError("Такое ребро уже существует");
      return;
    }
    setEdges((es) => [...es, { id: edgeId, ...newEdge }]);
    setNewEdge((e) => ({ ...e, from: "", to: "" }));
    setError("");
  };

  const deletePoint = (id: string) => {
    setPoints((pts) => pts.filter((p) => p.id !== id));
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id));
  };

  const deleteEdge = (id: string) => {
    setEdges((es) => es.filter((e) => e.id !== id));
  };

  const resetCamera = () => setCam({ rotX: -0.35, rotY: 0.5, zoom: 1, panX: 0, panY: 0 });

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const newPts: Point3D[] = [];
      lines.forEach((line, i) => {
        if (i === 0 && line.toLowerCase().includes("x")) return; // skip header
        const parts = line.split(/[,;\t]/).map((s) => s.trim());
        if (parts.length < 3) return;
        const [xs, ys, zs, lbl] = parts;
        const x = parseFloat(xs), y = parseFloat(ys), z = parseFloat(zs);
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          const id = lbl || `P${points.length + newPts.length + 1}`;
          newPts.push({ id, x, y, z, label: id, color: "hsl(38 95% 55%)" });
        }
      });
      setPoints((pts) => [...pts, ...newPts]);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const inputCls = "w-full rounded-md border border-border bg-secondary px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50";
  const selectCls = "w-full rounded-md border border-border bg-secondary px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-primary transition-colors";

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "hsl(195 80% 45% / 0.12)" }}>
            <Icon name="Box" size={20} style={{ color: "hsl(195 80% 45%)" }} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">3D-модель по координатам</h2>
            <p className="text-xs text-muted-foreground">Проектирование вентиляционных выработок в пространстве</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary">
            <Icon name="Upload" size={13} />
            <span>CSV</span>
            <input type="file" accept=".csv,.txt" className="hidden" onChange={importCSV} />
          </label>
          <button onClick={resetCamera}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary">
            <Icon name="RotateCcw" size={13} />
            Сброс камеры
          </button>
        </div>
      </div>

      {/* Layout */}
      <div className="flex flex-1 gap-4 min-h-0" style={{ height: "calc(100vh - 220px)" }}>
        {/* Панель управления */}
        <div className="flex w-64 flex-shrink-0 flex-col gap-3 overflow-y-auto">
          {/* Tabs */}
          <div className="flex rounded-lg border border-border bg-card p-1 gap-1">
            {(["points", "edges"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 rounded-md py-1.5 text-xs font-medium transition-all"
                style={tab === t ? { background: "hsl(var(--amber))", color: "hsl(220 20% 8%)" } : { color: "hsl(215 15% 50%)" }}>
                {t === "points" ? `Точки (${points.length})` : `Рёбра (${edges.length})`}
              </button>
            ))}
          </div>

          {/* Форма */}
          {tab === "points" ? (
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Новая точка</p>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="mb-1 block font-mono-data text-xs text-muted-foreground">X</label>
                  <input type="number" placeholder="0" value={newPt.x}
                    onChange={(e) => setNewPt((v) => ({ ...v, x: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addPoint()}
                    className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block font-mono-data text-xs text-muted-foreground">Y</label>
                  <input type="number" placeholder="0" value={newPt.y}
                    onChange={(e) => setNewPt((v) => ({ ...v, y: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addPoint()}
                    className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block font-mono-data text-xs text-muted-foreground">Z</label>
                  <input type="number" placeholder="0" value={newPt.z}
                    onChange={(e) => setNewPt((v) => ({ ...v, z: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addPoint()}
                    className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-mono-data text-xs text-muted-foreground">Имя (опционально)</label>
                <input type="text" placeholder="A, B, ..." value={newPt.label}
                  onChange={(e) => setNewPt((v) => ({ ...v, label: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && addPoint()}
                  className={inputCls} />
              </div>
              <button onClick={addPoint}
                className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all hover:opacity-90"
                style={{ background: "hsl(var(--amber))", color: "hsl(220 20% 8%)" }}>
                <Icon name="Plus" size={12} />
                Добавить точку
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Новое ребро</p>
              <div>
                <label className="mb-1 block font-mono-data text-xs text-muted-foreground">От точки</label>
                <select value={newEdge.from} onChange={(e) => setNewEdge((v) => ({ ...v, from: e.target.value }))} className={selectCls}>
                  <option value="">— выберите —</option>
                  {points.map((p) => <option key={p.id} value={p.id}>{p.label || p.id} ({p.x}, {p.y}, {p.z})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-mono-data text-xs text-muted-foreground">До точки</label>
                <select value={newEdge.to} onChange={(e) => setNewEdge((v) => ({ ...v, to: e.target.value }))} className={selectCls}>
                  <option value="">— выберите —</option>
                  {points.filter((p) => p.id !== newEdge.from).map((p) => (
                    <option key={p.id} value={p.id}>{p.label || p.id} ({p.x}, {p.y}, {p.z})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-mono-data text-xs text-muted-foreground">Цвет</label>
                <div className="flex gap-1.5">
                  {EDGE_COLORS.map((c) => (
                    <button key={c} onClick={() => setNewEdge((v) => ({ ...v, color: c }))}
                      className="h-6 w-6 rounded-full border-2 transition-all"
                      style={{ background: c, borderColor: newEdge.color === c ? "#fff" : "transparent" }} />
                  ))}
                </div>
              </div>
              <button onClick={addEdge}
                className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all hover:opacity-90"
                style={{ background: "hsl(195 80% 45%)", color: "hsl(220 20% 8%)" }}>
                <Icon name="GitCommitHorizontal" size={12} />
                Добавить ребро
              </button>
            </div>
          )}

          {/* Ошибка */}
          {error && (
            <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs" style={{ background: "hsl(350 70% 55% / 0.1)", color: "hsl(350 70% 55%)", border: "1px solid hsl(350 70% 55% / 0.3)" }}>
              <Icon name="AlertCircle" size={12} />
              {error}
            </div>
          )}

          {/* Список точек */}
          {tab === "points" && (
            <div className="rounded-lg border border-border bg-card flex-1 overflow-hidden flex flex-col">
              <div className="border-b border-border px-3 py-2">
                <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Точки модели
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {points.map((p) => (
                  <div key={p.id}
                    className="flex items-center gap-2 border-b border-border/40 px-3 py-2 transition-colors hover:bg-secondary/50 cursor-pointer"
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}>
                    <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: p.color || "hsl(38 95% 55%)" }} />
                    <span className="font-mono-data text-xs font-medium" style={{ color: "hsl(var(--amber))", minWidth: 20 }}>{p.label || p.id}</span>
                    <span className="flex-1 font-mono-data text-xs text-muted-foreground truncate">
                      {p.x}, {p.y}, {p.z}
                    </span>
                    <button onClick={() => deletePoint(p.id)} className="flex-shrink-0 opacity-40 transition-opacity hover:opacity-100">
                      <Icon name="X" size={11} style={{ color: "hsl(350 70% 55%)" }} />
                    </button>
                  </div>
                ))}
                {points.length === 0 && (
                  <div className="px-3 py-4 text-center font-mono-data text-xs text-muted-foreground/50">нет точек</div>
                )}
              </div>
            </div>
          )}

          {/* Список рёбер */}
          {tab === "edges" && (
            <div className="rounded-lg border border-border bg-card flex-1 overflow-hidden flex flex-col">
              <div className="border-b border-border px-3 py-2">
                <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Рёбра</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {edges.map((e) => (
                  <div key={e.id}
                    className="flex items-center gap-2 border-b border-border/40 px-3 py-2 transition-colors hover:bg-secondary/50"
                    onMouseEnter={() => setHoveredId(e.id)}
                    onMouseLeave={() => setHoveredId(null)}>
                    <div className="h-2 w-5 flex-shrink-0 rounded-sm" style={{ background: e.color || "hsl(38 95% 55%)" }} />
                    <span className="flex-1 font-mono-data text-xs text-foreground">{e.from} → {e.to}</span>
                    <button onClick={() => deleteEdge(e.id)} className="flex-shrink-0 opacity-40 transition-opacity hover:opacity-100">
                      <Icon name="X" size={11} style={{ color: "hsl(350 70% 55%)" }} />
                    </button>
                  </div>
                ))}
                {edges.length === 0 && (
                  <div className="px-3 py-4 text-center font-mono-data text-xs text-muted-foreground/50">нет рёбер</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3D Canvas + Ortho */}
        <div className="flex flex-1 flex-col gap-3 min-w-0">
          {/* 3D вид */}
          <div className="relative flex-1 overflow-hidden rounded-lg border border-border" style={{ minHeight: 0 }}>
            <canvas
              ref={canvasRef}
              className="h-full w-full cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onContextMenu={(e) => e.preventDefault()}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
            />
            {/* Hints */}
            <div className="absolute bottom-3 left-3 flex gap-2 flex-wrap">
              {[
                { icon: "MousePointer", text: "ЛКМ — вращение" },
                { icon: "Move", text: "Ctrl+ЛКМ — панорама" },
                { icon: "ZoomIn", text: "Колёсико — масштаб" },
              ].map((h) => (
                <div key={h.text} className="flex items-center gap-1 rounded-md px-2 py-1" style={{ background: "hsl(220 18% 9% / 0.8)" }}>
                  <Icon name={h.icon} size={10} className="text-muted-foreground" fallback="Info" />
                  <span className="font-mono-data text-xs text-muted-foreground">{h.text}</span>
                </div>
              ))}
            </div>
            {/* Stats */}
            <div className="absolute right-3 top-3 flex flex-col gap-1">
              {[
                { label: "Точки", val: points.length },
                { label: "Рёбра", val: edges.length },
                { label: "Zoom", val: cam.zoom.toFixed(2) + "×" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 rounded-md px-2 py-1"
                  style={{ background: "hsl(220 18% 9% / 0.8)", border: "1px solid hsl(220 15% 16%)" }}>
                  <span className="font-mono-data text-xs text-muted-foreground">{s.label}:</span>
                  <span className="font-mono-data text-xs font-medium" style={{ color: "hsl(var(--amber))" }}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ортогональные проекции */}
          <div className="grid grid-cols-3 gap-3 flex-shrink-0" style={{ height: 120 }}>
            {[
              { ref: orthoXYRef, label: "ПЛАН (XY)" },
              { ref: orthoXZRef, label: "ФАСАД (XZ)" },
              { ref: orthoYZRef, label: "ПРОФИЛЬ (YZ)" },
            ].map(({ ref, label }) => (
              <div key={label} className="relative overflow-hidden rounded-lg border border-border">
                <canvas ref={ref as React.RefObject<HTMLCanvasElement>} width={300} height={120} className="h-full w-full" />
                <div className="absolute bottom-1.5 right-2">
                  <span className="font-mono-data text-xs font-semibold" style={{ color: "hsl(215 15% 35%)" }}>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
