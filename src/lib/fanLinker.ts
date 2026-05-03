// ─── Привязка вентиляторов к выработкам ───────────────────────────────────────
// Алгоритм:
//   Для каждого объекта типа "fan" на схеме находим ближайший сегмент
//   выработки (расстояние от точки до отрезка). Если расстояние < SNAP_DIST,
//   привязываем вентилятор к этой выработке и передаём его Q-P кривую
//   в CalcAirway.fanCurveA / fanCurveB (аппроксимация параболой через LSQ).

export interface FanOnScheme {
  id:          string;
  x:           number;
  y:           number;
  fanCurve?:   [number, number][];   // [[Q, P], ...]
  fanPressure?: number;              // постоянное давление (если кривой нет)
  label?:      string;
}

export interface AirwaySegment {
  id:       string;     // id ветви в CalcAirway (формат awId_segN)
  awId:     string;     // id исходной Airway
  x1:       number; y1: number;
  x2:       number; y2: number;
}

export interface FanLink {
  fanId:    string;
  segId:    string;   // id ветви CalcAirway
  awId:     string;   // id исходной Airway
  dist:     number;   // расстояние, px
  curveA?:  number;   // P = A - B*Q^2
  curveB?:  number;
  pressure?: number;  // постоянное давление
}

const SNAP_DIST = 60; // px — максимальное расстояние привязки

// ─── Расстояние от точки до отрезка ──────────────────────────────────────────
function pointToSegDist(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// ─── Аппроксимация Q-P кривой параболой P = A - B*Q² (МНК) ──────────────────
// Минимизируем Σ(P_i - A + B*Q_i²)²
// Линейная регрессия: Y = A - B*X,  Y = P_i, X = Q_i²
function fitParabola(curve: [number, number][]): { A: number; B: number } | null {
  if (curve.length < 2) return null;
  const n   = curve.length;
  let   sX  = 0, sY = 0, sX2 = 0, sXY = 0;
  for (const [Q, P] of curve) {
    const X = Q * Q;
    sX  += X;
    sY  += P;
    sX2 += X * X;
    sXY += X * P;
  }
  const det = n * sX2 - sX * sX;
  if (Math.abs(det) < 1e-12) {
    // Константное давление
    return { A: sY / n, B: 0 };
  }
  const A = (sY * sX2 - sX * sXY) / det;
  const B = (n  * sXY - sX * sY)  / det;   // знак: P = A - B*Q² → B должно быть ≥ 0
  return { A, B: Math.max(0, -B) };          // в регрессии B входит со знаком минус
}

// ─── Главная функция ──────────────────────────────────────────────────────────
export function linkFansToAirways(
  fans:     FanOnScheme[],
  segments: AirwaySegment[],
): FanLink[] {
  const links: FanLink[] = [];

  for (const fan of fans) {
    let bestDist = Infinity;
    let bestSeg:  AirwaySegment | null = null;

    for (const seg of segments) {
      const d = pointToSegDist(fan.x, fan.y, seg.x1, seg.y1, seg.x2, seg.y2);
      if (d < bestDist) { bestDist = d; bestSeg = seg; }
    }

    if (!bestSeg || bestDist > SNAP_DIST) continue;

    const link: FanLink = {
      fanId:  fan.id,
      segId:  bestSeg.id,
      awId:   bestSeg.awId,
      dist:   bestDist,
    };

    if (fan.fanCurve && fan.fanCurve.length >= 2) {
      const fit = fitParabola(fan.fanCurve);
      if (fit) { link.curveA = fit.A; link.curveB = fit.B; }
    } else if (fan.fanPressure !== undefined && fan.fanPressure > 0) {
      link.pressure = fan.fanPressure;
    }

    links.push(link);
  }

  return links;
}

// ─── Извлечь сегменты из CalcAirway (уже конвертированных) ───────────────────
// Нужно чтобы знать координаты сегментов для привязки.
// Передаём также исходные точки выработок.
export interface RawAirwayPoints {
  id:     string;   // id исходной Airway (не seg)
  points: { x: number; y: number }[];
}

export function buildSegments(rawAirways: RawAirwayPoints[]): AirwaySegment[] {
  const segs: AirwaySegment[] = [];
  for (const aw of rawAirways) {
    for (let i = 0; i < aw.points.length - 1; i++) {
      segs.push({
        id:   `${aw.id}_seg${i}`,
        awId: aw.id,
        x1:   aw.points[i].x,
        y1:   aw.points[i].y,
        x2:   aw.points[i + 1].x,
        y2:   aw.points[i + 1].y,
      });
    }
  }
  return segs;
}

// ─── Интерполяция рабочей точки вентилятора ───────────────────────────────────
// Рабочая точка: P_fan(Q) = P_net(Q)  → ищем Q методом бисекции
// P_fan = A - B*Q²,  P_net = R*Q² (сопротивление сети)
// Решение: Q* = sqrt(A / (R + B))
export function calcWorkingPoint(
  A: number, B: number, R: number,
): { Q: number; P: number } {
  const denom = R + B;
  if (denom <= 0 || A <= 0) return { Q: 0, P: 0 };
  const Q = Math.sqrt(A / denom);
  const P = A - B * Q * Q;
  return { Q: Math.max(0, Q), P: Math.max(0, P) };
}
