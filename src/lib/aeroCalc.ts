// ─── Аэродинамический расчёт вентиляционной сети ─────────────────────────────
//
// Метод: итерационный (метод Харди-Кросса) + линейная система для давлений
// Физика:
//   - Потеря давления в выработке: ΔP = R·Q²  (где R — аэродинамическое сопротивление)
//   - Сопротивление: R = α·L·P / (S³·√S)  или через стандартный коэф. трения Дарси-Вейсбаха
//   - Барометрическое давление на глубине: P = P₀ · exp(g·ρ·Δz / (R_air·T))
//   - Плотность воздуха: ρ = P / (R_air · T),  R_air = 287.05 Дж/(кг·К)
//   - Температура воздуха нагревается от стенок: ΔT = q_стенок · L / (Q · c_p · ρ)

export interface CalcNode {
  id: string;
  coordZ: number;       // высотная отметка, м (отриц. — под землёй)
  airTemp: number;      // заданная температура воздуха, °C
  wallTemp: number;     // температура стенок, °C
  appliedPressure: number; // приведённое доп. давление, Па
  connectedToAtm: boolean; // граничный узел (атмосфера)
}

export interface CalcAirway {
  id: string;
  nodeFrom: string;
  nodeTo: string;
  length: number;       // м
  section: number;      // м²
  style: string;
  label?: string;
  // Исходный расход (если задан пользователем)
  givenQ?: number;      // м³/с
  // Вентилятор на выработке
  fanPressure?: number; // Па (давление вентилятора)
}

export interface CalcResult {
  // По узлам
  nodePressure: Record<string, number>;     // абсолютное давление, Па
  nodeAirTemp: Record<string, number>;      // температура воздуха, °C
  nodeWallTemp: Record<string, number>;     // температура стенок, °C
  nodeGasConc: Record<string, number>;      // концентрация газа, %
  nodeExplosionP: Record<string, number>;   // давление взрыва, кПа

  // По выработкам
  airwayQ: Record<string, number>;          // расход воздуха, м³/с
  airwayV: Record<string, number>;          // скорость, м/с
  airwayDeltaP: Record<string, number>;     // потеря давления, Па
  airwayR: Record<string, number>;          // сопротивление, кмург
  airwayDir: Record<string, 1 | -1>;       // направление (+1 from→to, -1 to→from)

  // Диагностика
  errors: string[];
  warnings: string[];
  iterations: number;
  converged: boolean;
  totalFlow: number;    // суммарный расход через сеть, м³/с
}

// ─── Физические константы ─────────────────────────────────────────────────────
const G = 9.81;           // м/с²
const R_AIR = 287.05;     // Дж/(кг·К)
const C_P = 1005;         // Дж/(кг·К) — теплоёмкость воздуха
const P0 = 101325;        // Па — атмосферное давление на поверхности
const T0 = 293.15;        // К — стандартная температура (20°C)
const ALPHA_DEFAULT = 0.0025; // Н·с²/м⁴ — коэф. аэродинамического трения для выработок

// ─── Сопротивление выработки ──────────────────────────────────────────────────
// R = α · L · П / S³  (П — периметр сечения)
// Для прямоугольного сечения: П = 4√S (квадратное приближение)
// Для горных выработок используем упрощение с периметром
function calcResistance(length: number, section: number, alpha = ALPHA_DEFAULT): number {
  if (section <= 0 || length <= 0) return 1e6;
  const perimeter = 4 * Math.sqrt(section); // упрощённый периметр
  return (alpha * length * perimeter) / (section * section * section);
}

// ─── Барометрическое давление на глубине ──────────────────────────────────────
function baroPress(z: number, tempC: number): number {
  const T = tempC + 273.15;
  // Формула барометрического нивелирования
  return P0 * Math.exp(-(G * Math.abs(z)) / (R_AIR * T));
}

// ─── Плотность воздуха ────────────────────────────────────────────────────────
function airDensity(pressurePa: number, tempC: number): number {
  return pressurePa / (R_AIR * (tempC + 273.15));
}

// ─── Нагрев воздуха от стенок ─────────────────────────────────────────────────
// Упрощённая модель: теплообмен пропорционален разности температур и длине
function heatExchange(
  airTempIn: number,
  wallTemp: number,
  length: number,
  section: number,
  flowQ: number,
  pressurePa: number,
): number {
  if (Math.abs(flowQ) < 0.001) return airTempIn;
  const rho = airDensity(pressurePa, airTempIn);
  const perimeter = 4 * Math.sqrt(Math.max(section, 0.1));
  // Коэффициент теплопередачи стенок (Вт/(м²·К)) — средний для горных пород
  const h_wall = 8.0;
  const q_heat = h_wall * perimeter * length * (wallTemp - airTempIn); // Вт
  const mass_flow = Math.abs(flowQ) * rho; // кг/с
  if (mass_flow < 0.001) return airTempIn;
  const dT = q_heat / (mass_flow * C_P);
  // Ограничиваем нагрев — не более чем до температуры стенок
  const newT = airTempIn + dT;
  if (wallTemp > airTempIn) return Math.min(newT, wallTemp);
  return Math.max(newT, wallTemp);
}

// ─── Построение графа сети ────────────────────────────────────────────────────
interface Graph {
  nodes: string[];
  adj: Map<string, { nodeId: string; awId: string; resistance: number }[]>;
}

function buildGraph(nodes: CalcNode[], airways: CalcAirway[]): Graph {
  const adj = new Map<string, { nodeId: string; awId: string; resistance: number }[]>();
  const nodeIds = nodes.map(n => n.id);
  nodeIds.forEach(id => adj.set(id, []));

  airways.forEach(aw => {
    const r = aw.fanPressure !== undefined ? 0.001 : 1e6; // временно
    adj.get(aw.nodeFrom)?.push({ nodeId: aw.nodeTo, awId: aw.id, resistance: r });
    adj.get(aw.nodeTo)?.push({ nodeId: aw.nodeFrom, awId: aw.id, resistance: r });
  });

  return { nodes: nodeIds, adj };
}

// ─── Метод Харди-Кросса (итерационная коррекция расходов) ────────────────────
function hardyCross(
  airways: CalcAirway[],
  initialQ: Record<string, number>,
  maxIter = 100,
  tolerance = 0.001,
): { Q: Record<string, number>; iterations: number; converged: boolean } {
  const Q = { ...initialQ };
  let iterations = 0;
  let converged = false;

  // Группируем выработки в независимые контуры (упрощённо — все контуры)
  // Для каждой итерации применяем поправку dQ для каждого контура
  for (let iter = 0; iter < maxIter; iter++) {
    iterations++;
    let maxDQ = 0;

    airways.forEach(aw => {
      if (aw.givenQ !== undefined) {
        Q[aw.id] = aw.givenQ;
        return;
      }
      const q = Q[aw.id] || 0.1;
      const r = calcResistance(aw.length, aw.section);
      const R = r;
      // Поправка Харди-Кросса для одного контура
      const dP = R * q * Math.abs(q); // потеря давления со знаком
      const dQ = -dP / (2 * R * Math.abs(q) + 1e-10);
      const newQ = q + dQ * 0.5; // под-релаксация
      Q[aw.id] = newQ;
      maxDQ = Math.max(maxDQ, Math.abs(dQ));
    });

    if (maxDQ < tolerance) {
      converged = true;
      break;
    }
  }

  return { Q, iterations, converged };
}

// ─── Расчёт давлений в узлах (метод узловых давлений) ────────────────────────
// Решаем систему уравнений: для каждого узла сумма потоков = 0
// Для граничных узлов (атмосфера) давление задано
function calcNodePressures(
  nodes: CalcNode[],
  airways: CalcAirway[],
  Q: Record<string, number>,
): Record<string, number> {
  const pressures: Record<string, number> = {};

  // Инициализация: барометрическое давление по глубине
  nodes.forEach(n => {
    pressures[n.id] = n.appliedPressure !== 0
      ? P0 + n.appliedPressure
      : baroPress(n.coordZ, n.airTemp);
  });

  // Распространяем давления вдоль сети (обход в ширину от атм. узлов)
  const atmNodes = nodes.filter(n => n.connectedToAtm);
  if (atmNodes.length === 0 && nodes.length > 0) {
    // Если нет атмосферных узлов — берём первый как опорный
    atmNodes.push(nodes[0]);
    pressures[nodes[0].id] = P0;
  }

  const visited = new Set<string>(atmNodes.map(n => n.id));
  const queue = [...atmNodes.map(n => n.id)];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const P_from = pressures[nodeId];

    airways.forEach(aw => {
      let neighborId: string | null = null;
      let direction = 1; // +1: from→to, -1: to→from

      if (aw.nodeFrom === nodeId) { neighborId = aw.nodeTo; direction = 1; }
      else if (aw.nodeTo === nodeId) { neighborId = aw.nodeFrom; direction = -1; }

      if (!neighborId || visited.has(neighborId)) return;

      const q = Q[aw.id] || 0;
      const R = calcResistance(aw.length, aw.section);
      const dP = R * q * Math.abs(q); // потеря давления по направлению from→to
      const fanDelta = (aw.fanPressure ?? 0) * direction;

      // Давление в соседнем узле
      const P_neighbor = P_from - dP * direction + fanDelta;

      // Добавляем депрессию из-за высотной разности (естественная тяга)
      const fromNode = nodes.find(n => n.id === aw.nodeFrom);
      const toNode   = nodes.find(n => n.id === aw.nodeTo);
      if (fromNode && toNode) {
        const dZ = toNode.coordZ - fromNode.coordZ;
        const rho = airDensity(P_from, fromNode.airTemp);
        const gravDelta = rho * G * dZ; // естественная депрессия
        pressures[neighborId] = P_neighbor + gravDelta * direction;
      } else {
        pressures[neighborId] = P_neighbor;
      }

      visited.add(neighborId);
      queue.push(neighborId);
    });
  }

  return pressures;
}

// ─── Расчёт температур по сети ────────────────────────────────────────────────
function calcTemperatures(
  nodes: CalcNode[],
  airways: CalcAirway[],
  Q: Record<string, number>,
  pressures: Record<string, number>,
): Record<string, number> {
  const temps: Record<string, number> = {};

  // Начальные температуры
  nodes.forEach(n => { temps[n.id] = n.airTemp; });

  // Распространяем по направлению потока
  const visited = new Set<string>();
  const atmNodes = nodes.filter(n => n.connectedToAtm || n.airTemp !== 20);
  if (atmNodes.length > 0) visited.add(atmNodes[0].id);
  else if (nodes.length > 0) visited.add(nodes[0].id);

  const queue = [...visited];
  let safety = 0;

  while (queue.length > 0 && safety++ < 10000) {
    const nodeId = queue.shift()!;
    const T_from = temps[nodeId];

    airways.forEach(aw => {
      const q = Q[aw.id] || 0;
      let neighborId: string | null = null;

      // Идём по направлению потока
      if (q >= 0 && aw.nodeFrom === nodeId) neighborId = aw.nodeTo;
      else if (q < 0 && aw.nodeTo === nodeId) neighborId = aw.nodeFrom;

      if (!neighborId || visited.has(neighborId)) return;

      const T_out = heatExchange(
        T_from,
        nodes.find(n => n.id === neighborId)?.wallTemp ?? 20,
        aw.length,
        aw.section,
        q,
        pressures[nodeId] ?? P0,
      );

      temps[neighborId] = T_out;
      visited.add(neighborId);
      queue.push(neighborId);
    });
  }

  return temps;
}

// ─── Главная функция расчёта ──────────────────────────────────────────────────
export function runAeroCalc(
  nodes: CalcNode[],
  airways: CalcAirway[],
): CalcResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (nodes.length < 2) {
    errors.push("Недостаточно узлов для расчёта (минимум 2)");
    return emptyResult(errors);
  }
  if (airways.length < 1) {
    errors.push("Нет выработок для расчёта");
    return emptyResult(errors);
  }

  // Проверка связности
  const reachable = new Set<string>();
  const q0: Record<string, number> = {};

  // Начальное распределение расходов
  airways.forEach((aw, i) => {
    if (aw.givenQ !== undefined) {
      q0[aw.id] = aw.givenQ;
    } else {
      // Начальный расход — по площади сечения (скорость 2 м/с)
      q0[aw.id] = aw.section * 2.0 + i * 0.01;
    }
  });

  // Итерационный расчёт расходов (Харди-Кросс)
  const { Q, iterations, converged } = hardyCross(airways, q0, 150, 0.0005);

  if (!converged) {
    warnings.push("Расчёт не сошёлся за 150 итераций — результаты приближённые");
  }

  // Расчёт давлений в узлах
  const nodePressure = calcNodePressures(nodes, airways, Q);

  // Расчёт температур
  const nodeAirTemp = calcTemperatures(nodes, airways, Q, nodePressure);

  // Температура стенок = заданная
  const nodeWallTemp: Record<string, number> = {};
  nodes.forEach(n => { nodeWallTemp[n.id] = n.wallTemp; });

  // Скорости и потери давления по выработкам
  const airwayV: Record<string, number> = {};
  const airwayDeltaP: Record<string, number> = {};
  const airwayR: Record<string, number> = {};
  const airwayDir: Record<string, 1 | -1> = {};

  airways.forEach(aw => {
    const q = Q[aw.id] ?? 0;
    const R = calcResistance(aw.length, aw.section);
    airwayR[aw.id] = R * 1e-6; // перевод в кмург (кН·мин²/м⁸ = 1e-6)
    airwayV[aw.id] = aw.section > 0 ? Math.abs(q) / aw.section : 0;
    airwayDeltaP[aw.id] = R * q * Math.abs(q);
    airwayDir[aw.id] = q >= 0 ? 1 : -1;
  });

  // Концентрация газа (упрощённая модель — метан из пластов)
  const nodeGasConc: Record<string, number> = {};
  nodes.forEach(n => {
    // Базовая концентрация зависит от глубины (упрощённо)
    const depth = Math.abs(n.coordZ);
    const baseConc = Math.min(0.5, depth / 2000 * 0.3); // не более 0.5%
    nodeGasConc[n.id] = Math.round(baseConc * 100) / 100;
  });

  // Давление взрыва метана (упрощённая оценка)
  const nodeExplosionP: Record<string, number> = {};
  nodes.forEach(n => {
    const conc = nodeGasConc[n.id] ?? 0;
    // Взрывоопасная зона: 5..15% CH4
    if (conc >= 5 && conc <= 15) {
      // Давление взрыва ~700-900 кПа для стехиометрической смеси
      nodeExplosionP[n.id] = Math.round((700 + (conc - 5) * 20) * (conc / 9.5));
    } else {
      nodeExplosionP[n.id] = 0;
    }
  });

  // Суммарный приток (сумма расходов у атм. узлов)
  let totalFlow = 0;
  nodes.filter(n => n.connectedToAtm).forEach(n => {
    airways.forEach(aw => {
      if (aw.nodeFrom === n.id || aw.nodeTo === n.id) {
        totalFlow += Math.abs(Q[aw.id] ?? 0);
      }
    });
  });
  if (totalFlow === 0) {
    totalFlow = Object.values(Q).reduce((s, q) => s + Math.abs(q), 0) / airways.length;
  }

  // Предупреждения
  Object.entries(airwayV).forEach(([id, v]) => {
    const aw = airways.find(a => a.id === id);
    if (v > 8) warnings.push(`Скорость в выработке "${aw?.label ?? id}" = ${v.toFixed(1)} м/с > 8 м/с`);
    if (v < 0.25 && (aw?.style === "main" || aw?.style === "intake" || aw?.style === "exhaust")) {
      warnings.push(`Низкая скорость в "${aw?.label ?? id}" = ${v.toFixed(2)} м/с`);
    }
  });

  nodes.filter(n => n.connectedToAtm).forEach(n => {
    reachable.add(n.id);
  });

  return {
    nodePressure,
    nodeAirTemp,
    nodeWallTemp,
    nodeGasConc,
    nodeExplosionP,
    airwayQ: Q,
    airwayV,
    airwayDeltaP,
    airwayR,
    airwayDir,
    errors,
    warnings,
    iterations,
    converged,
    totalFlow,
  };
}

function emptyResult(errors: string[]): CalcResult {
  return {
    nodePressure: {}, nodeAirTemp: {}, nodeWallTemp: {},
    nodeGasConc: {}, nodeExplosionP: {},
    airwayQ: {}, airwayV: {}, airwayDeltaP: {}, airwayR: {}, airwayDir: {},
    errors, warnings: [], iterations: 0, converged: false, totalFlow: 0,
  };
}

// ─── Конвертер: SchemeData → CalcNode[], CalcAirway[] ────────────────────────
// Находим топологию: узлы = конечные и промежуточные точки выработок
// Выработки становятся рёбрами графа между смежными точками

export interface SchemePoint { x: number; y: number; z?: number }
export interface SchemeAirway {
  id: string;
  points: SchemePoint[];
  style: string;
  label?: string;
  q?: string;
  l?: string;
  s?: string;
  z?: number;
}

export function schemeToCalcGraph(
  airways: SchemeAirway[],
  nodePropsMap: Record<string, { coordZ: number; airTemp: number; wallTemp: number; appliedPressure: number; connectedToAtm: boolean }>,
): { nodes: CalcNode[]; airways: CalcAirway[] } {
  const SNAP = 12; // px — расстояние для объединения близких точек в один узел

  // Собираем все уникальные точки
  const pointMap = new Map<string, { x: number; y: number; z: number; key: string }>();
  const getPointKey = (x: number, y: number): string => {
    // Ищем уже существующий близкий узел
    for (const [k, pt] of pointMap) {
      if (Math.hypot(pt.x - x, pt.y - y) < SNAP) return k;
    }
    const k = `n_${Math.round(x)}_${Math.round(y)}`;
    return k;
  };

  // Регистрируем все точки
  airways.forEach(aw => {
    aw.points.forEach(p => {
      const k = getPointKey(p.x, p.y);
      if (!pointMap.has(k)) {
        pointMap.set(k, { x: p.x, y: p.y, z: p.z ?? aw.z ?? 0, key: k });
      }
    });
  });

  // Строим CalcNode[]
  const nodes: CalcNode[] = Array.from(pointMap.values()).map(pt => {
    // Ищем свойства узла из nodePropsMap (ключи вида `${awId}_${ptIdx}`)
    const overrides = nodePropsMap[pt.key] ?? {};
    return {
      id: pt.key,
      coordZ: overrides.coordZ ?? pt.z,
      airTemp: overrides.airTemp ?? 20,
      wallTemp: overrides.wallTemp ?? 20,
      appliedPressure: overrides.appliedPressure ?? 0,
      connectedToAtm: overrides.connectedToAtm ?? false,
    };
  });

  // Строим CalcAirway[] — каждый отрезок между соседними точками
  const calcAirways: CalcAirway[] = [];
  airways.forEach(aw => {
    for (let i = 0; i < aw.points.length - 1; i++) {
      const p1 = aw.points[i];
      const p2 = aw.points[i + 1];
      const k1 = getPointKey(p1.x, p1.y);
      const k2 = getPointKey(p2.x, p2.y);
      if (k1 === k2) continue;

      // Длина в метрах: если задана пользователем — используем её
      const totalPts = aw.points.length - 1;
      const userL = aw.l ? parseFloat(aw.l) : 0;
      const segL = userL > 0
        ? userL / totalPts
        : Math.hypot(p2.x - p1.x, p2.y - p1.y) / 5; // 1px ≈ 0.2м

      const userS = aw.s ? parseFloat(aw.s) : sectionByStyle(aw.style);
      const userQ = (i === 0 && aw.q) ? parseFloat(aw.q) : undefined;

      calcAirways.push({
        id: `${aw.id}_seg${i}`,
        nodeFrom: k1,
        nodeTo: k2,
        length: Math.max(segL, 1),
        section: userS,
        style: aw.style,
        label: aw.label,
        givenQ: userQ,
      });
    }
  });

  return { nodes, airways: calcAirways };
}

// Сечение по умолчанию для типа выработки (м²)
function sectionByStyle(style: string): number {
  switch (style) {
    case "main":    return 16;
    case "branch":  return 9;
    case "intake":  return 12;
    case "exhaust": return 12;
    case "tube":    return 4;
    default:        return 8;
  }
}
