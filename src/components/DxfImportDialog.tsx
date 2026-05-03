import React, { useRef, useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import {
  parseDxf, convertDxfToScheme,
  DEFAULT_MAPPING, DxfParseResult, AxisMapping, ConvertedScheme,
} from "@/lib/dxfParser";

interface Props {
  onImport: (data: ConvertedScheme, mode: "replace" | "append") => void;
  onClose: () => void;
}

const AIRWAY_COLORS: Record<string, string> = {
  main: "#22c55e", branch: "#60a5fa", intake: "#34d399",
  exhaust: "#f87171", tube: "#a78bfa",
};

const AIRWAY_LABELS: Record<string, string> = {
  main: "Главный ствол", branch: "Участок", intake: "Свежая струя",
  exhaust: "Исходящая", tube: "Труба/Лава",
};

export default function DxfImportDialog({ onImport, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [parseResult, setParseResult] = useState<DxfParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<AxisMapping>({ ...DEFAULT_MAPPING });
  const [converted, setConverted] = useState<ConvertedScheme | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "append">("append");
  const [step, setStep] = useState<"upload" | "configure" | "preview">("upload");
  const [dragging, setDragging] = useState(false);

  // ── Обновляем конвертацию при изменении маппинга ─────────────────────────
  useEffect(() => {
    if (!parseResult) return;
    const result = convertDxfToScheme(parseResult, mapping);
    setConverted(result);
  }, [parseResult, mapping]);

  // ── Предпросмотр на canvas ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !converted) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f8f9fb";
    ctx.fillRect(0, 0, W, H);

    // Сетка
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Выработки
    converted.airways.forEach(aw => {
      if (aw.points.length < 2) return;
      const col = AIRWAY_COLORS[aw.style] || "#64748b";
      ctx.strokeStyle = col;
      ctx.lineWidth = aw.style === "main" ? 4 : 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      aw.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });

    // Позиции
    converted.positions.forEach(pos => {
      ctx.fillStyle = pos.color;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(pos.num), pos.x, pos.y);
      ctx.textBaseline = "alphabetic";
    });

    // Статистика
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(4, 4, 170, 32);
    ctx.fillStyle = "#fff";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Выработок: ${converted.airways.length}   Позиций: ${converted.positions.length}`, 10, 24);

  }, [converted]);

  // ── Читаем файл ───────────────────────────────────────────────────────────
  const readFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".dxf")) {
      alert("Пожалуйста, выберите файл с расширением .dxf");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseDxf(text);
      setParseResult(result);
      // Авто-маппинг: если есть Z-данные — предлагаем Z как глубину
      const hasZ = result.bounds.maxZ !== result.bounds.minZ;
      if (!hasZ) {
        setMapping(m => ({ ...m, schemeZ: "z" }));
      }
      // По умолчанию все слои
      setMapping(m => ({ ...m, layerFilter: [] }));
      setStep("configure");
    };
    reader.readAsText(file, "utf-8");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const patchMapping = (patch: Partial<AxisMapping>) => {
    setMapping(m => ({ ...m, ...patch }));
  };

  const toggleLayer = (layer: string) => {
    setMapping(m => {
      const current = m.layerFilter;
      if (current.length === 0) {
        // все → выбираем все кроме этого
        return { ...m, layerFilter: (parseResult?.layers ?? []).filter(l => l !== layer) };
      }
      if (current.includes(layer)) {
        const next = current.filter(l => l !== layer);
        return { ...m, layerFilter: next.length === (parseResult?.layers.length ?? 0) ? [] : next };
      } else {
        const next = [...current, layer];
        return { ...m, layerFilter: next.length === (parseResult?.layers.length ?? 0) ? [] : next };
      }
    });
  };

  const isLayerActive = (layer: string) =>
    mapping.layerFilter.length === 0 || mapping.layerFilter.includes(layer);

  const inputCls = "w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-400 transition-colors";
  const selectCls = inputCls;

  const hasZ = parseResult ? (parseResult.bounds.maxZ - parseResult.bounds.minZ) > 0.001 : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.7)" }}>
      <div className="flex flex-col rounded-xl shadow-2xl overflow-hidden"
        style={{ width: 860, maxHeight: "90vh", background: "#fff" }}>

        {/* Заголовок */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100"
          style={{ background: "#1e3a5f" }}>
          <div className="flex items-center gap-2.5">
            <Icon name="FileUp" size={18} className="text-white" />
            <span className="font-display text-sm font-semibold text-white">Импорт DXF</span>
            {fileName && <span className="rounded px-2 py-0.5 text-xs font-mono" style={{ background: "rgba(255,255,255,0.12)", color: "#93c5fd" }}>{fileName}</span>}
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Шаги */}
        <div className="flex gap-0 border-b border-slate-100">
          {[
            { id: "upload", label: "1. Файл" },
            { id: "configure", label: "2. Настройка осей" },
            { id: "preview", label: "3. Предпросмотр" },
          ].map(s => (
            <button key={s.id}
              onClick={() => { if (parseResult) setStep(s.id as typeof step); }}
              disabled={s.id !== "upload" && !parseResult}
              className="px-5 py-2.5 text-xs font-medium border-b-2 transition-all"
              style={{
                borderColor: step === s.id ? "#1e3a5f" : "transparent",
                color: step === s.id ? "#1e3a5f" : "#94a3b8",
                background: "transparent",
              }}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Шаг 1: Загрузка ── */}
          {step === "upload" && (
            <div className="flex flex-1 flex-col items-center justify-center p-8">
              <div
                className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed transition-all p-12 cursor-pointer"
                style={{
                  borderColor: dragging ? "#3b82f6" : "#cbd5e1",
                  background: dragging ? "#eff6ff" : "#f8fafc",
                }}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}>
                <div className="flex h-16 w-16 items-center justify-center rounded-full mb-4"
                  style={{ background: "#e0f2fe" }}>
                  <Icon name="FileUp" size={32} className="text-blue-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Перетащите .dxf файл или нажмите для выбора</p>
                <p className="text-xs text-slate-400 mb-4">Поддерживается: AutoCAD DXF R12–R2018 · LINE · POLYLINE · LWPOLYLINE · SPLINE · ARC · POINT</p>
                <button className="rounded px-4 py-1.5 text-xs font-semibold text-white"
                  style={{ background: "#1e3a5f" }}>
                  Выбрать файл
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".dxf" className="hidden" onChange={handleFileChange} />

              <div className="mt-6 rounded-lg p-4 w-full" style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}>
                <p className="text-xs font-semibold text-sky-700 mb-2">Как подготовить DXF:</p>
                <ul className="text-xs text-sky-600 space-y-1 list-disc list-inside">
                  <li>Экспортируйте из AutoCAD / nanoCAD / ZWCAD через «Сохранить как → DXF»</li>
                  <li>Линии (LINE, POLYLINE) станут выработками, точки (POINT) — позициями</li>
                  <li>Для 3D-схемы используйте 3D-полилинии с реальными Z-координатами (глубина в метрах)</li>
                  <li>Разные слои (Layers) можно фильтровать на шаге настройки</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Шаг 2: Настройка ── */}
          {step === "configure" && parseResult && (
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Левая колонка — настройки */}
              <div className="flex w-72 flex-col overflow-y-auto border-r border-slate-100 p-4 gap-4">

                {/* Инфо о файле */}
                <div className="rounded-lg p-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Содержимое файла</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-slate-400">Объектов:</span>
                    <span className="font-mono text-slate-700">{parseResult.entities.length}</span>
                    <span className="text-slate-400">Слоёв:</span>
                    <span className="font-mono text-slate-700">{parseResult.layers.length}</span>
                    <span className="text-slate-400">Единицы:</span>
                    <span className="font-mono text-slate-700">{parseResult.unit}</span>
                    {hasZ && <>
                      <span className="text-slate-400">Z-диапазон:</span>
                      <span className="font-mono text-slate-700">{Math.round(parseResult.bounds.minZ)}…{Math.round(parseResult.bounds.maxZ)}м</span>
                    </>}
                  </div>
                  {parseResult.errors.length > 0 && (
                    <div className="mt-2 rounded p-2" style={{ background: "#fef2f2" }}>
                      {parseResult.errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-600">{e}</p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Маппинг осей */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Маппинг осей DXF → схема</p>
                  <div className="space-y-2">
                    {[
                      { label: "X схемы (горизонталь →)", key: "schemeX" as const },
                      { label: "Y схемы (вертикаль ↓)", key: "schemeY" as const },
                      { label: "Z схемы (глубина)", key: "schemeZ" as const },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="mb-0.5 block text-xs text-slate-400">{label}</label>
                        <select className={selectCls} value={mapping[key]}
                          onChange={e => patchMapping({ [key]: e.target.value as "x"|"y"|"z" })}>
                          <option value="x">X (из DXF)</option>
                          <option value="y">Y (из DXF)</option>
                          <option value="z">Z (из DXF)</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Масштаб */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Масштаб Z (глубина)</p>
                  <div className="flex items-center gap-2">
                    <input className={inputCls} type="number" step="0.01" value={mapping.scaleZ}
                      onChange={e => patchMapping({ scaleZ: parseFloat(e.target.value) || 1 })} />
                    <span className="text-xs text-slate-400">×</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">Если DXF в мм, поставьте 0.001 для перевода в м</p>
                </div>

                {/* Тип выработки */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Тип выработки по умолчанию</p>
                  <select className={selectCls} value={mapping.airwayStyle}
                    onChange={e => patchMapping({ airwayStyle: e.target.value as AxisMapping["airwayStyle"] })}>
                    {Object.entries(AIRWAY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                {/* Слои */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-600">Слои</p>
                    <button className="text-xs text-blue-500 hover:underline"
                      onClick={() => patchMapping({ layerFilter: [] })}>
                      Все
                    </button>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {parseResult.layers.map(layer => (
                      <label key={layer} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-50">
                        <input type="checkbox" checked={isLayerActive(layer)}
                          onChange={() => toggleLayer(layer)}
                          className="rounded" />
                        <span className="text-xs text-slate-700 truncate flex-1">{layer}</span>
                        <span className="text-xs text-slate-400">
                          {parseResult.entities.filter(e => e.layer === layer).length}
                        </span>
                      </label>
                    ))}
                    {parseResult.layers.length === 0 && (
                      <p className="text-xs text-slate-400">Слои не обнаружены</p>
                    )}
                  </div>
                </div>

                {/* Опции */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Что импортировать</p>
                  <div className="space-y-1.5">
                    {[
                      { key: "lineAsAirway" as const, label: "LINE/POLYLINE → выработки" },
                      { key: "pointAsPosition" as const, label: "POINT → позиции" },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={mapping[key]}
                          onChange={e => patchMapping({ [key]: e.target.checked })} />
                        <span className="text-xs text-slate-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button onClick={() => setStep("preview")}
                  className="mt-auto w-full rounded py-2 text-xs font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: "#1e3a5f" }}>
                  Предпросмотр →
                </button>
              </div>

              {/* Правая колонка — мини предпросмотр */}
              <div className="flex flex-1 flex-col">
                <div className="flex-shrink-0 border-b border-slate-100 px-4 py-2.5 flex items-center gap-2">
                  <Icon name="Eye" size={13} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">Предпросмотр (обновляется при изменении настроек)</span>
                </div>
                <div className="flex-1 relative" style={{ background: "#f8fafc" }}>
                  <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }}
                    width={500} height={400} />
                  {converted && (
                    <div className="absolute bottom-3 left-3 flex gap-3 flex-wrap">
                      {Object.entries(AIRWAY_COLORS).map(([style, color]) => {
                        const count = converted.airways.filter(a => a.style === style).length;
                        if (count === 0) return null;
                        return (
                          <div key={style} className="flex items-center gap-1.5 rounded px-2 py-1"
                            style={{ background: "rgba(255,255,255,0.9)", border: `1px solid ${color}` }}>
                            <div className="h-2 w-4 rounded" style={{ background: color }} />
                            <span className="text-xs" style={{ color }}>{AIRWAY_LABELS[style]} ({count})</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Шаг 3: Предпросмотр ── */}
          {step === "preview" && converted && (
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Статистика */}
              <div className="flex w-64 flex-col overflow-y-auto border-r border-slate-100 p-4 gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Итого к импорту</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                      <span className="text-xs text-green-700">Выработок</span>
                      <span className="font-mono font-bold text-green-700">{converted.airways.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                      <span className="text-xs text-blue-700">Позиций</span>
                      <span className="font-mono font-bold text-blue-700">{converted.positions.length}</span>
                    </div>
                  </div>
                </div>

                {/* По слоям */}
                {parseResult && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-2">По слоям</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {parseResult.layers.filter(l => isLayerActive(l)).map(layer => {
                        const aw = converted.airways.filter(a => a.layer === layer).length;
                        const pos = converted.positions.filter(p => p.layer === layer).length;
                        return (
                          <div key={layer} className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-slate-600 truncate flex-1 mr-2">{layer}</span>
                            <span className="text-slate-400">{aw > 0 ? `${aw} выр.` : ""} {pos > 0 ? `${pos} поз.` : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Режим импорта */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Режим добавления</p>
                  <div className="space-y-1.5">
                    {([
                      { v: "append",  l: "Добавить к текущей схеме", icon: "Plus" },
                      { v: "replace", l: "Заменить схему полностью", icon: "RefreshCw" },
                    ] as const).map(({ v, l, icon }) => (
                      <label key={v} className="flex items-start gap-2 cursor-pointer rounded-lg p-2 transition-all"
                        style={{
                          background: importMode === v ? "#eff6ff" : "#f8fafc",
                          border: `1px solid ${importMode === v ? "#bfdbfe" : "#e2e8f0"}`,
                        }}>
                        <input type="radio" name="mode" value={v} checked={importMode === v}
                          onChange={() => setImportMode(v)} className="mt-0.5" />
                        <div>
                          <Icon name={icon} size={11} className="inline mr-1 text-slate-500" />
                          <span className="text-xs text-slate-700">{l}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-auto space-y-2">
                  <button onClick={() => setStep("configure")}
                    className="w-full rounded py-1.5 text-xs font-medium transition-all hover:bg-slate-100"
                    style={{ background: "#f1f5f9", color: "#475569" }}>
                    ← Назад
                  </button>
                  <button
                    onClick={() => { onImport(converted, importMode); onClose(); }}
                    disabled={converted.airways.length === 0 && converted.positions.length === 0}
                    className="w-full rounded py-2 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ background: "#22c55e" }}>
                    Импортировать в схему
                  </button>
                </div>
              </div>

              {/* Canvas предпросмотра */}
              <div className="flex flex-1 flex-col">
                <div className="flex-shrink-0 border-b border-slate-100 px-4 py-2 flex items-center gap-2">
                  <Icon name="Map" size={13} className="text-slate-400" />
                  <span className="text-xs text-slate-500">Финальный предпросмотр — результат будет добавлен в схему</span>
                </div>
                <div className="flex-1 relative" style={{ background: "#f8fafc" }}>
                  <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }}
                    width={560} height={430} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
