// ═══════════════════════════════════════════════════════════════════════════════
// РАСЧЁТ ВОЗДУХОРАСПРЕДЕЛЕНИЯ ВЕНТИЛЯЦИОННОЙ СЕТИ
// Метод: итерационный Харди-Кросс по независимым контурам (хордам)
//        + метод узловых давлений через решение СЛАУ (метод Гаусса)
//
// Физика:
//   ΔP = R·Q·|Q|         — потеря давления в ветви
//   R  = α·L·П / S³      — аэродинамическое сопротивление (кМюрг)
//   П  = периметр сечения (4√S для квадратного приближения)
//   Поправка Харди-Кросса: ΔQ = -ΣR·Q·|Q| / (2·Σ|R·Q|)  (по контуру)
//   Вентилятор: ΔP_fan = A - B·Q² (характеристика параболой)
//   Естественная тяга: h_e = g·ρ·ΔZ / (ρ_ср)
//
// Реализация:
//   1. Построение ориентированного графа (spanning tree + хорды)
//   2. Поиск независимых контуров через матрицу циклов
//   3. Итерации Харди-Кросса по каждому независимому контуру
//   4. Расчёт давлений в узлах через СЛАУ (Гаусс) после сходимости Q
//   5. Тепловой расчёт — распространение температуры по потокам
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Интерфейсы ───────────────────────────────────────────────────────────────

export interface CalcNode {
  id: string;
  coordZ: number;           // высотная отметка, м
  airTemp: number;          // температура воздуха (задана), °C
  wallTemp: number;         // температура стенок, °C
  appliedPressure: number;  // приведённое давление, Па
  connectedToAtm: boolean;  // граничный узел (атмосфера)
}

export interface CalcAirway {
  id: string;
  nodeFrom: string;
  nodeTo: string;
  length: number;           // м
  section: number;          // м²
  perimeter?: number;       // м (если не задан — 4√S)
  alpha?: number;           // коэф. аэрод. трения, кг/м³
  style: string;
  label?: string;
  givenQ?: number;          // фиксированный расход, м³/с
  fanPressure?: number;     // давление вентилятора, Па (постоянное)
  fanCurveA?: number;       // характеристика вентилятора: P = A - B·Q²
  fanCurveB?: number;
}

export interface CalcResult {
  // Узлы
  nodePressure:      Record<string, number>;  // абс. давление, Па
  nodeAirTemp:       Record<string, number>;  // температура воздуха, °C
  nodeWallTemp:      Record<string, number>;  // температура стенок, °C
  nodeGasConc:       Record<string, number>;  // концентрация CH₄, %
  nodeExplosionP:    Record<string, number>;  // давление взрыва, кПа
  nodeNatDraft:      Record<string, number>;  // естественная тяга на горизонт, Па

  // Ветви
  airwayQ:           Record<string, number>;  // расход, м³/с
  airwayV:           Record<string, number>;  // скорость, м/с
  airwayDeltaP:      Record<string, number>;  // потеря давления, Па
  airwayR:           Record<string, number>;  // сопротивление, кМюрг
  airwayDir:         Record<string, 1 | -1>;  // направление
  airwayFanDeltaP:   Record<string, number>;  // давление вентилятора в ветви, Па

  // Контуры
  loopResiduals:     number[];                // невязки контуров, Па
  loopIds:           string[][];              // id ветвей каждого контура

  // Диагностика
  errors:            string[];
  warnings:          string[];
  iterations:        number;
  converged:         boolean;
  totalFlow:         number;                  // суммарный расход, м³/с
  maxResidual:       number;                  // макс. невязка контура, Па
  balanceError:      number;                  // ошибка баланса в узлах, м³/с
  deadAirways:       Set<string>;             // id тупиковых непроветриваемых ветвей
}

// ─── Физические константы ─────────────────────────────────────────────────────
const G       = 9.81;      // м/с²
const R_AIR   = 287.05;    // Дж/(кг·К)
const C_P     = 1005;      // Дж/(кг·К)
const P0      = 101325;    // Па
const ALPHA0  = 0.0025;    // кг/м³ — коэф. по умолчанию (арочная с сеткой)

// ─── Вспомогательные функции ──────────────────────────────────────────────────

function resistance(aw: CalcAirway): number {
  if (aw.section <= 0 || aw.length <= 0) return 1e9;
  const alpha = aw.alpha ?? ALPHA0;
  const perim = aw.perimeter ?? 4 * Math.sqrt(aw.section);
  const s3    = aw.section * aw.section * aw.section;
  return (alpha * aw.length * perim) / s3;
}

function baroPress(z: number, tempC: number): number {
  return P0 * Math.exp(-(G * Math.abs(z)) / (R_AIR * (tempC + 273.15)));
}

function rho(P: number, TC: number): number {
  return P / (R_AIR * (TC + 273.15));
}

// Давление вентилятора в ветви (положит. = добавляется по направлению from→to)
function fanDeltaP(aw: CalcAirway, Q: number): number {
  if (aw.fanCurveA !== undefined && aw.fanCurveB !== undefined) {
    return aw.fanCurveA - aw.fanCurveB * Q * Q;
  }
  return aw.fanPressure ?? 0;
}

// Потеря давления в ветви (знак = направление from→to)
function branchDeltaP(aw: CalcAirway, Q: number): number {
  const R  = resistance(aw);
  const Hf = R * Q * Math.abs(Q);   // гидравлические потери
  const Hv = fanDeltaP(aw, Q);      // давление вентилятора
  return Hf - Hv;                   // итоговая потеря (Hf - давление насоса)
}

// ─── 1. Топология: spanning tree + независимые контуры ────────────────────────

interface TreeResult {
  treeEdges: Set<string>;  // id ветвей дерева
  chords:    string[];     // id хордовых ветвей
  loops:     string[][];   // независимые контуры: массив id ветвей (+ знак в dir)
  loopDirs:  number[][];   // направление каждой ветви в контуре (+1 / -1)
}

function buildCycleBase(nodes: CalcNode[], airways: CalcAirway[]): TreeResult {
  const nodeIds  = nodes.map(n => n.id);
  const treeEdges = new Set<string>();
  const chords:   string[] = [];

  // BFS spanning tree
  const visited = new Set<string>();
  const start   = nodeIds[0];
  if (!start) return { treeEdges, chords, loops: [], loopDirs: [] };

  const queue = [start];
  visited.add(start);
  while (queue.length > 0) {
    const u = queue.shift()!;
    for (const aw of airways) {
      let v: string | null = null;
      if (aw.nodeFrom === u) v = aw.nodeTo;
      else if (aw.nodeTo === u) v = aw.nodeFrom;
      if (!v) continue;
      if (visited.has(v)) {
        // Проверим — может уже добавили эту ветвь в дерево иначе
        if (!treeEdges.has(aw.id) && !chords.includes(aw.id)) chords.push(aw.id);
      } else {
        treeEdges.add(aw.id);
        visited.add(v);
        queue.push(v);
      }
    }
  }

  // Для каждой хорды находим фундаментальный контур
  // Строим карту: node → смежные ветви дерева
  const treeAdj = new Map<string, { nb: string; awId: string }[]>();
  nodeIds.forEach(id => treeAdj.set(id, []));
  airways.filter(aw => treeEdges.has(aw.id)).forEach(aw => {
    treeAdj.get(aw.nodeFrom)!.push({ nb: aw.nodeTo,   awId: aw.id });
    treeAdj.get(aw.nodeTo)!.push({   nb: aw.nodeFrom, awId: aw.id });
  });

  const loops:    string[][] = [];
  const loopDirs: number[][] = [];

  for (const chord of chords) {
    const aw = airways.find(a => a.id === chord)!;
    // Ищем путь от aw.nodeFrom до aw.nodeTo по дереву (BFS)
    const path = bfsPath(aw.nodeFrom, aw.nodeTo, treeAdj);
    if (!path) continue;

    // Контур = хорда + путь по дереву
    const loopAws:  string[] = [chord];
    const loopDir:  number[] = [1]; // хорда — ориентирована from→to

    for (let i = 0; i < path.edges.length; i++) {
      const edgeId = path.edges[i];
      loopAws.push(edgeId);
      loopDir.push(path.dirs[i]);
    }
    loops.push(loopAws);
    loopDirs.push(loopDir);
  }

  return { treeEdges, chords, loops, loopDirs };
}

// BFS-поиск пути в дереве
function bfsPath(
  from: string, to: string,
  adj: Map<string, { nb: string; awId: string }[]>
): { edges: string[]; dirs: number[] } | null {
  const prev = new Map<string, { from: string; awId: string; dir: number }>();
  const q    = [from];
  prev.set(from, { from: "", awId: "", dir: 0 });
  while (q.length) {
    const u = q.shift()!;
    if (u === to) break;
    for (const { nb, awId } of (adj.get(u) ?? [])) {
      if (prev.has(nb)) continue;
      // Направление: если nb = aw.nodeTo → dir=+1, иначе −1
      const aw2 = adj;  // не используем тут, dir вычисляем ниже
      void aw2;
      prev.set(nb, { from: u, awId, dir: 1 }); // уточним dir после
      q.push(nb);
    }
  }
  if (!prev.has(to)) return null;

  const edges: string[] = [];
  const dirs:  number[] = [];
  let cur = to;
  while (cur !== from) {
    const p = prev.get(cur)!;
    edges.unshift(p.awId);
    // Направление ветви p.awId: если p.from → cur совпадает с nodeFrom → nodeTo, то +1
    dirs.unshift(p.dir);
    cur = p.from;
  }
  return { edges, dirs };
}

// ─── 2. Харди-Кросс ────────────────────────────────────────────────────────────
// Классический метод: для каждого независимого контура
//   ΔQ_loop = -Σ(R_i·Q_i·|Q_i| - H_fan_i) / (2·Σ|R_i·Q_i|)
// Применяется одновременно ко всем контурам (синхронная итерация)

function hardyCross(
  airways:   CalcAirway[],
  loops:     string[][],
  loopDirs:  number[][],
  maxIter  = 300,
  tol      = 0.01,   // Па — критерий невязки
): { Q: Record<string, number>; iters: number; converged: boolean; residuals: number[] } {
  const awMap = new Map(airways.map(a => [a.id, a]));

  // Начальные расходы
  const Q: Record<string, number> = {};
  airways.forEach(aw => {
    Q[aw.id] = aw.givenQ !== undefined ? aw.givenQ : aw.section * 1.5 + 0.01;
  });

  let iters = 0;
  let converged = false;
  const residuals: number[] = new Array(loops.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    iters++;
    const corrections: Record<string, number> = {};
    airways.forEach(aw => { corrections[aw.id] = 0; });

    let maxResid = 0;

    for (let li = 0; li < loops.length; li++) {
      const loop    = loops[li];
      const dirs    = loopDirs[li];
      let   sumHR   = 0;  // Σ R·Q·|Q| − H_fan (взято со знаком контура)
      let   sumDen  = 0;  // Σ 2·|R·Q|

      for (let ei = 0; ei < loop.length; ei++) {
        const awId = loop[ei];
        const d    = dirs[ei];
        const aw   = awMap.get(awId);
        if (!aw) continue;

        if (aw.givenQ !== undefined) continue; // фиксированный расход — не трогаем

        const q    = Q[awId];
        const R    = resistance(aw);
        const Hfan = fanDeltaP(aw, Math.abs(q));
        // Потеря давления по направлению контура
        const h    = R * q * Math.abs(q) - Hfan * Math.sign(q);
        sumHR  += d * h;
        sumDen += 2 * R * Math.abs(q);
      }

      const dQ = sumDen > 1e-12 ? -sumHR / sumDen : 0;
      residuals[li] = Math.abs(sumHR);
      maxResid = Math.max(maxResid, Math.abs(sumHR));

      // Накапливаем поправку
      for (let ei = 0; ei < loop.length; ei++) {
        const awId = loop[ei];
        const aw   = awMap.get(awId);
        if (!aw || aw.givenQ !== undefined) continue;
        corrections[awId] += dirs[ei] * dQ;
      }
    }

    // Применяем накопленные поправки (под-релаксация 0.9)
    const relax = 0.9;
    airways.forEach(aw => {
      if (aw.givenQ !== undefined) { Q[aw.id] = aw.givenQ; return; }
      Q[aw.id] += relax * corrections[aw.id];
    });

    if (maxResid < tol) { converged = true; break; }
  }

  return { Q, iters, converged, residuals };
}

// ─── 3. СЛАУ для узловых давлений (метод Гаусса) ──────────────────────────────
// Для каждого узла i (кроме опорного): Σ_j (P_i - P_j - ΔP_ij) / R_ij = 0
// Упрощённо: P_i = (Σ_j (P_j + ΔP_ij) / R_ij) / (Σ_j 1/R_ij)
// Итерируем до сходимости (Гаусс-Зейдель)

function calcNodePressures(
  nodes:   CalcNode[],
  airways: CalcAirway[],
  Q:       Record<string, number>,
): Record<string, number> {
  const P: Record<string, number> = {};

  // Инициализация: барометрическое давление
  nodes.forEach(n => {
    P[n.id] = n.connectedToAtm
      ? P0 + n.appliedPressure
      : baroPress(n.coordZ, n.airTemp) + n.appliedPressure;
  });

  // Опорные узлы — атмосфера или первый
  const fixedNodes = new Set(nodes.filter(n => n.connectedToAtm).map(n => n.id));
  if (fixedNodes.size === 0 && nodes.length > 0) fixedNodes.add(nodes[0].id);

  // Гаусс-Зейдель
  for (let iter = 0; iter < 200; iter++) {
    let maxDiff = 0;

    for (const n of nodes) {
      if (fixedNodes.has(n.id)) continue;

      // Смежные ветви
      const adj = airways.filter(aw => aw.nodeFrom === n.id || aw.nodeTo === n.id);
      if (adj.length === 0) continue;

      let   sumNum = 0;
      let   sumDen = 0;

      for (const aw of adj) {
        const R  = Math.max(resistance(aw), 1e-6);
        const w  = 1 / R;
        const q  = Q[aw.id] ?? 0;
        const dP = R * q * Math.abs(q);  // потеря from→to
        const Hf = fanDeltaP(aw, Math.abs(q));

        if (aw.nodeFrom === n.id) {
          // aw: n → neighbor,  P[n] = P[nb] + dP - Hf
          const nb = aw.nodeTo;
          sumNum += w * (P[nb] + dP - Hf);
        } else {
          // aw: neighbor → n,  P[n] = P[nb] - dP + Hf
          const nb = aw.nodeFrom;
          sumNum += w * (P[nb] - dP + Hf);
        }
        sumDen += w;
      }

      const newP = sumDen > 1e-12 ? sumNum / sumDen : P[n.id];
      maxDiff    = Math.max(maxDiff, Math.abs(newP - P[n.id]));
      P[n.id]    = newP;
    }

    if (maxDiff < 0.01) break;
  }

  return P;
}

// ─── 4. Проверка баланса расходов в узлах ─────────────────────────────────────
function calcBalance(
  nodes:   CalcNode[],
  airways: CalcAirway[],
  Q:       Record<string, number>,
): number {
  let maxErr = 0;
  for (const n of nodes) {
    let sum = 0;
    for (const aw of airways) {
      if (aw.nodeFrom === n.id) sum += Q[aw.id] ?? 0;
      if (aw.nodeTo   === n.id) sum -= Q[aw.id] ?? 0;
    }
    // Для граничных узлов дисбаланс = приток/вытяжка — это нормально
    if (!n.connectedToAtm) maxErr = Math.max(maxErr, Math.abs(sum));
  }
  return maxErr;
}

// ─── 5. Тепловой расчёт ───────────────────────────────────────────────────────
function calcTemperatures(
  nodes:   CalcNode[],
  airways: CalcAirway[],
  Q:       Record<string, number>,
  P:       Record<string, number>,
): Record<string, number> {
  const T: Record<string, number> = {};
  nodes.forEach(n => { T[n.id] = n.airTemp; });

  // Распространяем по направлению потока (BFS)
  const settled = new Set<string>(nodes.filter(n => n.connectedToAtm || n.airTemp !== 20).map(n => n.id));
  const queue   = [...settled];
  let   safety  = 0;

  while (queue.length > 0 && safety++ < 50000) {
    const nid = queue.shift()!;
    for (const aw of airways) {
      const q = Q[aw.id] ?? 0;
      let fromId: string | null = null;
      let toId:   string | null = null;
      if (q >= 0 && aw.nodeFrom === nid) { fromId = nid; toId = aw.nodeTo;   }
      if (q <  0 && aw.nodeTo   === nid) { fromId = nid; toId = aw.nodeFrom; }
      if (!fromId || !toId || settled.has(toId)) continue;

      const T_in   = T[fromId] ?? 20;
      const rho_   = rho(P[fromId] ?? P0, T_in);
      const mass   = Math.abs(q) * rho_;
      if (mass < 0.001) { T[toId] = T_in; }
      else {
        const perim = aw.perimeter ?? 4 * Math.sqrt(Math.max(aw.section, 0.1));
        const h_w   = 8.0;  // Вт/(м²·К)
        const twNode = nodes.find(nn => nn.id === toId)?.wallTemp ?? 20;
        const dT    = (h_w * perim * aw.length * (twNode - T_in)) / (mass * C_P);
        const T_out = T_in + dT;
        T[toId]     = twNode > T_in ? Math.min(T_out, twNode) : Math.max(T_out, twNode);
      }
      settled.add(toId);
      queue.push(toId);
    }
  }
  return T;
}

// ─── 6. Концентрация газа (упрощённая) ────────────────────────────────────────
function calcGasConc(nodes: CalcNode[]): Record<string, number> {
  const res: Record<string, number> = {};
  nodes.forEach(n => {
    const depth = Math.abs(n.coordZ);
    res[n.id] = Math.min(0.5, depth / 2000 * 0.3);
  });
  return res;
}

// ─── 7. Естественная тяга ─────────────────────────────────────────────────────
// h_e = g · (ρ_in - ρ_out) · ΔZ
function calcNatDraft(
  nodes:   CalcNode[],
  airways: CalcAirway[],
  T:       Record<string, number>,
  P:       Record<string, number>,
): Record<string, number> {
  const res: Record<string, number> = {};
  nodes.forEach(n => { res[n.id] = 0; });

  airways.forEach(aw => {
    const nF   = nodes.find(n => n.id === aw.nodeFrom);
    const nT   = nodes.find(n => n.id === aw.nodeTo);
    if (!nF || !nT) return;

    const dZ   = nT.coordZ - nF.coordZ;
    const rhoF = rho(P[nF.id] ?? P0, T[nF.id] ?? 20);
    const rhoT = rho(P[nT.id] ?? P0, T[nT.id] ?? 20);
    const h_e  = G * (rhoF - rhoT) * Math.abs(dZ) / 2;

    res[nF.id] = (res[nF.id] ?? 0) + h_e;
    res[nT.id] = (res[nT.id] ?? 0) + h_e;
  });
  return res;
}

// ─── 8. Определение проветриваемых ветвей ────────────────────────────────────
// Ветвь получает воздух только если существует путь от атмосферного узла
// ИЛИ от узла с ВМП до обоих её концов (узлов).
// Тупиковые ветви (нет такого пути) — Q обнуляем.
//
// Алгоритм:
//   1. Строим "источники вентиляции": атм. узлы + узлы на ветвях с ВМП
//   2. BFS по НЕОРИЕНТИРОВАННОМУ графу от всех источников
//   3. Ветвь "проветривается" если оба её конца достижимы из источников
//   4. Для тупиковых ветвей (один конец — тупик, нет второго пути) —
//      дополнительная проверка: узел является степени 1 и не является источником

function findVentilatedAirways(
  nodes:   CalcNode[],
  airways: CalcAirway[],
): Set<string> {
  // Источники проветривания
  const sources = new Set<string>();

  // Атмосферные узлы
  nodes.filter(n => n.connectedToAtm).forEach(n => sources.add(n.id));

  // Узлы на ветвях с ВМП (вентилятором местного проветривания)
  airways.forEach(aw => {
    if (aw.fanPressure !== undefined && aw.fanPressure > 0 ||
        aw.fanCurveA   !== undefined && aw.fanCurveA   > 0) {
      sources.add(aw.nodeFrom);
      sources.add(aw.nodeTo);
    }
  });

  // Нет ни одного источника — никакого воздуха нет
  if (sources.size === 0) return new Set<string>();

  // BFS от всех источников по неориентированному графу
  const reachable = new Set<string>(sources);
  const queue     = [...sources];
  while (queue.length > 0) {
    const u = queue.shift()!;
    for (const aw of airways) {
      const nb = aw.nodeFrom === u ? aw.nodeTo
               : aw.nodeTo   === u ? aw.nodeFrom
               : null;
      if (nb && !reachable.has(nb)) {
        reachable.add(nb);
        queue.push(nb);
      }
    }
  }

  // Степень каждого узла (количество смежных ветвей)
  const degree = new Map<string, number>();
  nodes.forEach(n => degree.set(n.id, 0));
  airways.forEach(aw => {
    degree.set(aw.nodeFrom, (degree.get(aw.nodeFrom) ?? 0) + 1);
    degree.set(aw.nodeTo,   (degree.get(aw.nodeTo)   ?? 0) + 1);
  });

  // Ветвь проветривается если:
  //   — оба конца достижимы из источников
  //   — И хотя бы один конец не является тупиковым узлом (степень 1)
  //     без источника (т.е. не атмосфера и не ВМП)
  const ventilated = new Set<string>();
  for (const aw of airways) {
    const fromReach = reachable.has(aw.nodeFrom);
    const toReach   = reachable.has(aw.nodeTo);

    if (!fromReach || !toReach) continue; // недостижима

    // Проверяем тупиковость: если один из узлов степени 1 и не является
    // источником — это тупиковая ветвь без сквозного проветривания
    const fromDead = (degree.get(aw.nodeFrom) ?? 0) === 1 && !sources.has(aw.nodeFrom);
    const toDead   = (degree.get(aw.nodeTo)   ?? 0) === 1 && !sources.has(aw.nodeTo);

    // Ветвь тупиковая только если ОБА конца тупиковые (изолированный сегмент)
    // или ОДИН тупиковый + ветвь с ВМП (тогда ВМП сама создаёт поток)
    const hasFan = (aw.fanPressure !== undefined && aw.fanPressure > 0) ||
                   (aw.fanCurveA   !== undefined && aw.fanCurveA   > 0);

    if (fromDead && toDead && !hasFan) continue; // тупик без ВМП

    ventilated.add(aw.id);
  }

  return ventilated;
}

// ─── 9. Главная функция ────────────────────────────────────────────────────────

export function runAeroCalc(
  nodes:   CalcNode[],
  airways: CalcAirway[],
): CalcResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  // Валидация
  if (nodes.length < 2)   { errors.push("Недостаточно узлов (минимум 2)");    return emptyResult(errors); }
  if (airways.length < 1) { errors.push("Нет выработок для расчёта");         return emptyResult(errors); }

  // Проверка связности через BFS
  const visited = new Set<string>();
  const q0      = [nodes[0].id];
  visited.add(nodes[0].id);
  while (q0.length) {
    const u = q0.shift()!;
    airways.forEach(aw => {
      const nb = aw.nodeFrom === u ? aw.nodeTo : aw.nodeTo === u ? aw.nodeFrom : null;
      if (nb && !visited.has(nb)) { visited.add(nb); q0.push(nb); }
    });
  }
  if (visited.size < nodes.length) {
    warnings.push(`Граф не связен: ${nodes.length - visited.size} изолированных узлов`);
  }

  // (базис циклов строится ниже только по активным ветвям)

  // Определяем проветриваемые ветви ДО расчёта
  const ventilatedAirways = findVentilatedAirways(nodes, airways);

  // Тупиковые ветви — фиксируем Q=0 (они не участвуют в Харди-Кросс)
  const deadAirways = airways.filter(aw => !ventilatedAirways.has(aw.id));
  if (deadAirways.length > 0) {
    deadAirways.forEach(aw => {
      warnings.push(
        `Ветвь "${aw.label ?? aw.id}" — тупиковая, нет пути к атмосфере и ВМП → Q=0`
      );
    });
  }

  // Для расчёта используем только проветриваемые ветви
  const activeAirways = airways.filter(aw => ventilatedAirways.has(aw.id));

  // Строим базис циклов только по активным ветвям
  const activeNodes = nodes.filter(n =>
    activeAirways.some(aw => aw.nodeFrom === n.id || aw.nodeTo === n.id)
  );
  const cycleBaseActive = activeAirways.length > 0
    ? buildCycleBase(activeNodes, activeAirways)
    : { loops: [], loopDirs: [], treeEdges: new Set<string>(), chords: [] };

  if (cycleBaseActive.loops.length === 0 && activeAirways.length > 0) {
    warnings.push("Контуров не найдено — активная сеть является деревом, баланс определяется однозначно");
  }

  // Харди-Кросс только по активным ветвям
  const { Q: Qactive, iters, converged, residuals } = hardyCross(
    activeAirways,
    cycleBaseActive.loops,
    cycleBaseActive.loopDirs,
    500,
    0.5,
  );

  // Объединяем: тупиковые ветви получают Q=0
  const Q: Record<string, number> = { ...Qactive };
  deadAirways.forEach(aw => { Q[aw.id] = 0; });

  if (!converged && activeAirways.length > 0) {
    warnings.push(`Расчёт не сошёлся за 500 итераций. Макс. невязка: ${Math.max(...residuals).toFixed(1)} Па`);
  }

  // Узловые давления (по всем ветвям, тупиковые с Q=0)
  const nodePressure = calcNodePressures(nodes, airways, Q);

  // Температуры
  const nodeAirTemp  = calcTemperatures(nodes, airways, Q, nodePressure);
  const nodeWallTemp: Record<string, number> = {};
  nodes.forEach(n => { nodeWallTemp[n.id] = n.wallTemp; });

  // Прочие параметры
  const nodeGasConc   = calcGasConc(nodes);
  const nodeNatDraft  = calcNatDraft(nodes, airways, nodeAirTemp, nodePressure);
  const nodeExplosionP: Record<string, number> = {};
  nodes.forEach(n => { nodeExplosionP[n.id] = 0; });  // базовое значение

  // Параметры ветвей
  const airwayV:        Record<string, number>  = {};
  const airwayDeltaP:   Record<string, number>  = {};
  const airwayR:        Record<string, number>  = {};
  const airwayDir:      Record<string, 1 | -1>  = {};
  const airwayFanDeltaP: Record<string, number> = {};

  airways.forEach(aw => {
    const q   = Q[aw.id] ?? 0;
    const R   = resistance(aw);
    airwayR[aw.id]        = R;
    airwayV[aw.id]        = aw.section > 0 ? Math.abs(q) / aw.section : 0;
    airwayDeltaP[aw.id]   = R * q * Math.abs(q);
    airwayDir[aw.id]      = q >= 0 ? 1 : -1;
    airwayFanDeltaP[aw.id] = fanDeltaP(aw, Math.abs(q));
  });

  // Предупреждения по скоростям
  airways.forEach(aw => {
    const v = airwayV[aw.id] ?? 0;
    if (v > 8)   warnings.push(`Скорость в "${aw.label ?? aw.id}": ${v.toFixed(1)} м/с > 8 м/с (ПБ)`);
    if (v < 0.25 && (aw.style === "main" || aw.style === "intake" || aw.style === "exhaust")) {
      warnings.push(`Низкая скорость в "${aw.label ?? aw.id}": ${v.toFixed(2)} м/с`);
    }
  });

  // Баланс
  const balanceError = calcBalance(nodes, airways, Q);
  if (balanceError > 1) {
    warnings.push(`Ошибка баланса расходов в узлах: ${balanceError.toFixed(2)} м³/с`);
  }

  // Суммарный расход (через граничные узлы)
  let totalFlow = 0;
  nodes.filter(n => n.connectedToAtm).forEach(n => {
    airways.forEach(aw => {
      if (aw.nodeFrom === n.id) totalFlow += Math.max(0,  Q[aw.id] ?? 0);
      if (aw.nodeTo   === n.id) totalFlow += Math.max(0, -(Q[aw.id] ?? 0));
    });
  });
  if (totalFlow === 0 && airways.length > 0) {
    totalFlow = Object.values(Q).reduce((s, q) => s + Math.abs(q), 0) / airways.length;
  }

  return {
    nodePressure, nodeAirTemp, nodeWallTemp,
    nodeGasConc, nodeExplosionP, nodeNatDraft,
    airwayQ: Q, airwayV, airwayDeltaP, airwayR, airwayDir, airwayFanDeltaP,
    loopResiduals: residuals,
    loopIds: cycleBaseActive.loops,
    errors, warnings,
    iterations: iters, converged,
    totalFlow,
    maxResidual: residuals.length > 0 ? Math.max(...residuals) : 0,
    balanceError,
    deadAirways: new Set(deadAirways.map(aw => aw.id)),
  };
}

// ─── Пустой результат ─────────────────────────────────────────────────────────
function emptyResult(errors: string[]): CalcResult {
  return {
    deadAirways: new Set(),
    nodePressure: {}, nodeAirTemp: {}, nodeWallTemp: {},
    nodeGasConc: {}, nodeExplosionP: {}, nodeNatDraft: {},
    airwayQ: {}, airwayV: {}, airwayDeltaP: {}, airwayR: {}, airwayDir: {},
    airwayFanDeltaP: {},
    loopResiduals: [], loopIds: [],
    errors, warnings: [], iterations: 0, converged: false,
    totalFlow: 0, maxResidual: 0, balanceError: 0,
  };
}

// ─── Конвертер схемы в граф расчёта ───────────────────────────────────────────
export interface SchemePoint  { x: number; y: number; z?: number }
export interface SchemeAirway {
  id: string; points: SchemePoint[]; style: string;
  label?: string; q?: string; l?: string; s?: string; z?: number;
  alpha?: string; perimeter?: string;
  sectionArea?: string;
  fanPressure?: number;
  fanCurveA?: number;
  fanCurveB?: number;
}

export function schemeToCalcGraph(
  airways:      SchemeAirway[],
  nodeOverrides: Record<string, {
    coordZ: number; airTemp: number; wallTemp: number;
    appliedPressure: number; connectedToAtm: boolean;
  }>,
): { nodes: CalcNode[]; airways: CalcAirway[] } {
  const SNAP = 12; // px — порог объединения точек в один узел
  const pointMap = new Map<string, { x: number; y: number; z: number }>();

  const getKey = (x: number, y: number): string => {
    for (const [k, pt] of pointMap) {
      if (Math.hypot(pt.x - x, pt.y - y) < SNAP) return k;
    }
    const k = `n_${Math.round(x)}_${Math.round(y)}`;
    pointMap.set(k, { x, y, z: 0 });
    return k;
  };

  // Регистрируем все точки
  airways.forEach(aw => {
    aw.points.forEach(p => {
      const k = getKey(p.x, p.y);
      const z = p.z ?? aw.z ?? 0;
      const existing = pointMap.get(k);
      if (existing && z !== 0) existing.z = z;
      else if (!existing) pointMap.set(k, { x: p.x, y: p.y, z });
    });
  });

  // Узлы
  const nodes: CalcNode[] = Array.from(pointMap.entries()).map(([k, pt]) => {
    const ov = nodeOverrides[k] ?? {};
    return {
      id:               k,
      coordZ:           ov.coordZ           ?? pt.z,
      airTemp:          ov.airTemp          ?? 20,
      wallTemp:         ov.wallTemp         ?? 20,
      appliedPressure:  ov.appliedPressure  ?? 0,
      connectedToAtm:   ov.connectedToAtm   ?? false,
    };
  });

  // Ветви (каждый сегмент выработки — отдельная ветвь)
  const calcAirways: CalcAirway[] = [];
  airways.forEach(aw => {
    const userL = aw.l ? parseFloat(aw.l) : 0;
    const userS = aw.sectionArea ? parseFloat(aw.sectionArea) : aw.s ? parseFloat(aw.s) : sectionByStyle(aw.style);
    const userAlpha = aw.alpha ? parseFloat(aw.alpha) : undefined;
    const userPerim = aw.perimeter ? parseFloat(aw.perimeter) : undefined;
    const totalSegs = aw.points.length - 1;

    for (let i = 0; i < totalSegs; i++) {
      const p1 = aw.points[i], p2 = aw.points[i + 1];
      const k1 = getKey(p1.x, p1.y);
      const k2 = getKey(p2.x, p2.y);
      if (k1 === k2) continue;

      const segLen = userL > 0
        ? userL / totalSegs
        : Math.hypot(p2.x - p1.x, p2.y - p1.y) / 5; // 1px ≈ 0.2 м

      const userQ = (i === 0 && aw.q) ? parseFloat(aw.q) : undefined;

      calcAirways.push({
        id:          `${aw.id}_seg${i}`,
        nodeFrom:    k1,
        nodeTo:      k2,
        length:      Math.max(segLen, 1),
        section:     Math.max(userS, 0.1),
        alpha:       userAlpha,
        perimeter:   userPerim,
        style:       aw.style,
        label:       i === 0 ? aw.label : undefined,
        givenQ:      userQ,
        fanPressure: aw.fanPressure,
        fanCurveA:   aw.fanCurveA,
        fanCurveB:   aw.fanCurveB,
      });
    }
  });

  return { nodes, airways: calcAirways };
}

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