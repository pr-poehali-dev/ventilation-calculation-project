// ─── DXF Parser ───────────────────────────────────────────────────────────────
// Поддерживаемые entity: LINE, LWPOLYLINE, POLYLINE/VERTEX, POINT, SPLINE
// Формат DXF: текстовый, пары (код_группы\nзначение)

export interface DxfPoint {
  x: number;
  y: number;
  z: number;
}

export interface DxfEntity {
  type: "LINE" | "LWPOLYLINE" | "POLYLINE" | "POINT" | "SPLINE" | "ARC" | "CIRCLE";
  layer: string;
  color?: number;
  points: DxfPoint[];   // для LINE — 2 точки, для POLYLINE/LWPOLYLINE — N точек
  closed?: boolean;
  label?: string;
}

export interface DxfParseResult {
  entities: DxfEntity[];
  layers: string[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  unit: string;
  errors: string[];
}

// ─── Токенизатор ──────────────────────────────────────────────────────────────
function tokenize(text: string): { code: number; value: string }[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const tokens: { code: number; value: string }[] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    const value = lines[i + 1]?.trim() ?? "";
    if (!isNaN(code)) tokens.push({ code, value });
  }
  return tokens;
}

// ─── Основной парсер ──────────────────────────────────────────────────────────
export function parseDxf(text: string): DxfParseResult {
  const tokens = tokenize(text);
  const entities: DxfEntity[] = [];
  const layerSet = new Set<string>();
  const errors: string[] = [];
  let unit = "мм";

  // Единицы измерения из HEADER
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].code === 9 && tokens[i].value === "$INSUNITS") {
      const val = parseInt(tokens[i + 2]?.value ?? "0", 10);
      const unitMap: Record<number, string> = {
        1: "дюймы", 2: "фут", 4: "мм", 5: "см", 6: "м",
        13: "мкм", 14: "дм", 15: "дам", 16: "гм", 17: "гм",
      };
      unit = unitMap[val] ?? "мм";
    }
  }

  // Ищем секцию ENTITIES
  let inEntities = false;
  let i = 0;

  while (i < tokens.length) {
    const { code, value } = tokens[i];

    if (code === 2 && value === "ENTITIES") { inEntities = true; i++; continue; }
    if (code === 2 && value === "ENDSEC" && inEntities) { inEntities = false; i++; continue; }

    if (!inEntities) { i++; continue; }

    // ── LINE ──────────────────────────────────────────────────────────────────
    if (code === 0 && value === "LINE") {
      i++;
      let layer = "0", color: number | undefined;
      let x1 = 0, y1 = 0, z1 = 0, x2 = 0, y2 = 0, z2 = 0;

      while (i < tokens.length && tokens[i].code !== 0) {
        const t = tokens[i];
        if (t.code === 8)  layer  = t.value;
        if (t.code === 62) color  = parseInt(t.value, 10);
        if (t.code === 10) x1    = parseFloat(t.value);
        if (t.code === 20) y1    = parseFloat(t.value);
        if (t.code === 30) z1    = parseFloat(t.value);
        if (t.code === 11) x2    = parseFloat(t.value);
        if (t.code === 21) y2    = parseFloat(t.value);
        if (t.code === 31) z2    = parseFloat(t.value);
        i++;
      }
      layerSet.add(layer);
      entities.push({ type: "LINE", layer, color, points: [{ x: x1, y: y1, z: z1 }, { x: x2, y: y2, z: z2 }] });
      continue;
    }

    // ── LWPOLYLINE (2D polyline с опциональным Z) ─────────────────────────────
    if (code === 0 && value === "LWPOLYLINE") {
      i++;
      let layer = "0", color: number | undefined, closed = false;
      let elevation = 0;
      const xs: number[] = [], ys: number[] = [];

      while (i < tokens.length && tokens[i].code !== 0) {
        const t = tokens[i];
        if (t.code === 8)  layer    = t.value;
        if (t.code === 62) color    = parseInt(t.value, 10);
        if (t.code === 70) closed   = (parseInt(t.value, 10) & 1) === 1;
        if (t.code === 38) elevation = parseFloat(t.value);
        if (t.code === 10) xs.push(parseFloat(t.value));
        if (t.code === 20) ys.push(parseFloat(t.value));
        i++;
      }
      const points: DxfPoint[] = xs.map((x, idx) => ({ x, y: ys[idx] ?? 0, z: elevation }));
      if (points.length >= 2) {
        layerSet.add(layer);
        entities.push({ type: "LWPOLYLINE", layer, color, points, closed });
      }
      continue;
    }

    // ── POLYLINE / VERTEX (3D) ────────────────────────────────────────────────
    if (code === 0 && value === "POLYLINE") {
      i++;
      let layer = "0", color: number | undefined, closed = false;
      while (i < tokens.length && tokens[i].code !== 0) {
        const t = tokens[i];
        if (t.code === 8)  layer  = t.value;
        if (t.code === 62) color  = parseInt(t.value, 10);
        if (t.code === 70) closed = (parseInt(t.value, 10) & 1) === 1;
        i++;
      }
      const points: DxfPoint[] = [];
      while (i < tokens.length && !(tokens[i].code === 0 && tokens[i].value === "SEQEND")) {
        if (tokens[i].code === 0 && tokens[i].value === "VERTEX") {
          i++;
          let vx = 0, vy = 0, vz = 0;
          while (i < tokens.length && tokens[i].code !== 0) {
            const t = tokens[i];
            if (t.code === 10) vx = parseFloat(t.value);
            if (t.code === 20) vy = parseFloat(t.value);
            if (t.code === 30) vz = parseFloat(t.value);
            i++;
          }
          points.push({ x: vx, y: vy, z: vz });
        } else { i++; }
      }
      if (points.length >= 2) {
        layerSet.add(layer);
        entities.push({ type: "POLYLINE", layer, color, points, closed });
      }
      continue;
    }

    // ── SPLINE ────────────────────────────────────────────────────────────────
    if (code === 0 && value === "SPLINE") {
      i++;
      let layer = "0", color: number | undefined;
      const xs: number[] = [], ys: number[] = [], zs: number[] = [];

      while (i < tokens.length && tokens[i].code !== 0) {
        const t = tokens[i];
        if (t.code === 8)  layer = t.value;
        if (t.code === 62) color = parseInt(t.value, 10);
        if (t.code === 10) xs.push(parseFloat(t.value));
        if (t.code === 20) ys.push(parseFloat(t.value));
        if (t.code === 30) zs.push(parseFloat(t.value));
        i++;
      }
      const points: DxfPoint[] = xs.map((x, idx) => ({ x, y: ys[idx] ?? 0, z: zs[idx] ?? 0 }));
      if (points.length >= 2) {
        layerSet.add(layer);
        entities.push({ type: "SPLINE", layer, color, points });
      }
      continue;
    }

    // ── POINT ─────────────────────────────────────────────────────────────────
    if (code === 0 && value === "POINT") {
      i++;
      let layer = "0", color: number | undefined;
      let px = 0, py = 0, pz = 0;

      while (i < tokens.length && tokens[i].code !== 0) {
        const t = tokens[i];
        if (t.code === 8)  layer = t.value;
        if (t.code === 62) color = parseInt(t.value, 10);
        if (t.code === 10) px = parseFloat(t.value);
        if (t.code === 20) py = parseFloat(t.value);
        if (t.code === 30) pz = parseFloat(t.value);
        i++;
      }
      layerSet.add(layer);
      entities.push({ type: "POINT", layer, color, points: [{ x: px, y: py, z: pz }] });
      continue;
    }

    // ── ARC ───────────────────────────────────────────────────────────────────
    if (code === 0 && value === "ARC") {
      i++;
      let layer = "0", color: number | undefined;
      let cx = 0, cy = 0, cz = 0, r = 10, startA = 0, endA = 90;

      while (i < tokens.length && tokens[i].code !== 0) {
        const t = tokens[i];
        if (t.code === 8)  layer  = t.value;
        if (t.code === 62) color  = parseInt(t.value, 10);
        if (t.code === 10) cx     = parseFloat(t.value);
        if (t.code === 20) cy     = parseFloat(t.value);
        if (t.code === 30) cz     = parseFloat(t.value);
        if (t.code === 40) r      = parseFloat(t.value);
        if (t.code === 50) startA = parseFloat(t.value);
        if (t.code === 51) endA   = parseFloat(t.value);
        i++;
      }
      // Аппроксимируем дугу 12 точками
      const segs = 12;
      const a0 = (startA * Math.PI) / 180;
      const a1 = (endA   * Math.PI) / 180;
      const da = a1 > a0 ? a1 - a0 : a1 - a0 + 2 * Math.PI;
      const pts: DxfPoint[] = [];
      for (let s = 0; s <= segs; s++) {
        const a = a0 + (s / segs) * da;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), z: cz });
      }
      layerSet.add(layer);
      entities.push({ type: "ARC", layer, color, points: pts });
      continue;
    }

    i++;
  }

  // ── Bounds ────────────────────────────────────────────────────────────────
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  entities.forEach(e => e.points.forEach(p => {
    if (!isNaN(p.x)) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); }
    if (!isNaN(p.y)) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    if (!isNaN(p.z)) { minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  }));

  if (!isFinite(minX)) { minX = 0; maxX = 0; minY = 0; maxY = 0; minZ = 0; maxZ = 0; }

  if (entities.length === 0) errors.push("Не найдено ни одного объекта в секции ENTITIES");

  return {
    entities,
    layers: Array.from(layerSet).sort(),
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    unit,
    errors,
  };
}

// ─── Конвертация DXF → SchemeData ────────────────────────────────────────────
export interface AxisMapping {
  schemeX: "x" | "y" | "z";   // какая ось DXF идёт в X схемы (горизонталь)
  schemeY: "x" | "y" | "z";   // какая ось DXF идёт в Y схемы (вертикаль на экране)
  schemeZ: "x" | "y" | "z";   // какая ось DXF идёт в Z схемы (глубина)
  scaleX: number;              // масштаб
  scaleY: number;
  scaleZ: number;
  offsetX: number;
  offsetY: number;
  layerFilter: string[];       // пустой = все слои
  lineAsAirway: boolean;
  pointAsPosition: boolean;
  airwayStyle: "main" | "branch" | "intake" | "exhaust" | "tube";
}

export const DEFAULT_MAPPING: AxisMapping = {
  schemeX: "x",
  schemeY: "y",
  schemeZ: "z",
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  offsetX: 0,
  offsetY: 0,
  layerFilter: [],
  lineAsAirway: true,
  pointAsPosition: true,
  airwayStyle: "branch",
};

export interface ConvertedScheme {
  airways: {
    id: string;
    points: { x: number; y: number; z?: number }[];
    style: "main" | "branch" | "intake" | "exhaust" | "tube";
    label?: string;
    z?: number;
    layer: string;
  }[];
  positions: {
    id: string;
    x: number; y: number; z?: number;
    num: number;
    color: string;
    label?: string;
    layer: string;
  }[];
}

export function convertDxfToScheme(
  result: DxfParseResult,
  mapping: AxisMapping,
): ConvertedScheme {
  const airways: ConvertedScheme["airways"] = [];
  const positions: ConvertedScheme["positions"] = [];

  // Нормализация: вписываем в ~800×600 экранных координат
  const { bounds } = result;
  const rangeX = bounds.maxX - bounds.minX || 1;
  const rangeY = bounds.maxY - bounds.minY || 1;
  const rangeZ = bounds.maxZ - bounds.minZ || 1;
  const targetSize = 700;
  const scale = targetSize / Math.max(rangeX, rangeY);

  const mapPoint = (p: DxfPoint): { x: number; y: number; z: number } => {
    const raw = { x: p.x, y: p.y, z: p.z };
    const dx = raw[mapping.schemeX];
    const dy = raw[mapping.schemeY];
    const dz = raw[mapping.schemeZ];
    return {
      x: (dx - bounds[mapping.schemeX === "x" ? "minX" : mapping.schemeX === "y" ? "minY" : "minZ"]) * scale * mapping.scaleX + 80 + mapping.offsetX,
      y: (dy - bounds[mapping.schemeY === "x" ? "minX" : mapping.schemeY === "y" ? "minY" : "minZ"]) * scale * mapping.scaleY + 80 + mapping.offsetY,
      z: Math.round((dz - bounds[mapping.schemeZ === "x" ? "minX" : mapping.schemeZ === "y" ? "minY" : "minZ"]) * mapping.scaleZ),
    };
  };

  let posNum = 200;

  result.entities.forEach((ent, idx) => {
    if (mapping.layerFilter.length > 0 && !mapping.layerFilter.includes(ent.layer)) return;

    if (ent.type === "POINT" && mapping.pointAsPosition) {
      const pt = mapPoint(ent.points[0]);
      const colors = ["#ef4444","#22c55e","#3b82f6","#f59e0b","#8b5cf6","#ec4899","#14b8a6"];
      positions.push({
        id: `dxf_pos_${idx}`,
        x: pt.x, y: pt.y, z: pt.z,
        num: posNum++,
        color: colors[idx % colors.length],
        label: ent.layer !== "0" ? ent.layer : undefined,
        layer: ent.layer,
      });
      return;
    }

    if (
      mapping.lineAsAirway &&
      (ent.type === "LINE" || ent.type === "LWPOLYLINE" ||
       ent.type === "POLYLINE" || ent.type === "SPLINE" || ent.type === "ARC")
    ) {
      const pts = ent.points.map(mapPoint);
      if (pts.length < 2) return;

      // Средняя Z → глубина горизонта
      const avgZ = Math.round(pts.reduce((s, p) => s + p.z, 0) / pts.length);

      airways.push({
        id: `dxf_aw_${idx}`,
        points: pts.map(p => ({ x: p.x, y: p.y, z: p.z })),
        style: mapping.airwayStyle,
        label: ent.layer !== "0" ? ent.layer : undefined,
        z: avgZ,
        layer: ent.layer,
      });
    }
  });

  return { airways, positions };
}
