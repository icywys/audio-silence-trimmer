/**
 * Home Page - Audio Silence Trimmer
 * Design: Minimal Scientific / Data Journalism aesthetic
 * Color: Warm white #FAFAF8, Deep indigo #2D4EF5, Charcoal #1A1A1A
 * Typography: Playfair Display (display numbers) + IBM Plex Sans (labels) + IBM Plex Mono (data)
 * Layout: Asymmetric - left 1/3 controls, right 2/3 results; waveform spans full width
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { useCountUpTime } from "@/hooks/useCountUpTime";
import {
  analyzeAudio,
  analyzeMergedAudio,
  formatFileSize,
  DEFAULT_PARAMS,
  type AudioAnalysisResult,
  type AnalysisParams,
} from "@/lib/audioAnalyzer";
import { createShortenedAudio, downloadAudioBuffer } from "@/lib/audioTrimmer";

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  accent,
  compact,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-4 ${
        compact ? "bg-white border" : "bg-white/50 backdrop-blur-sm border"
      }`}
      style={{ borderColor: "#E8E8E4" }}
    >
      <div
        className={`text-xs font-medium tracking-widest uppercase mb-2 ${
          compact ? "" : "mb-3"
        }`}
        style={{ color: "#9B9B95" }}
      >
        {label}
      </div>
      <div
        className={`font-bold leading-none ${
          compact ? "text-lg" : "text-2xl"
        }`}
        style={{
          fontFamily: "'Playfair Display', serif",
          color: accent ? "#2D4EF5" : "#1A1A1A",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
        {unit && (
          <span
            className="text-xs font-normal ml-1"
            style={{ color: "#9B9B95" }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Ratio Bar ────────────────────────────────────────────────────────────────

function RatioBar({ ratio }: { ratio: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${ratio * 100}%`,
            background: "#2D4EF5",
          }}
        />
      </div>
      <span
        className="text-xs font-mono"
        style={{ color: "#9B9B95", minWidth: "40px" }}
      >
        {(ratio * 100).toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Param Control ────────────────────────────────────────────────────────────

function ParamControl({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  description,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <label
          className="text-xs font-medium tracking-widest uppercase"
          style={{ color: "#1A1A1A" }}
        >
          {label}
        </label>
        <span
          className="text-sm font-mono"
          style={{ color: "#2D4EF5", fontWeight: "600" }}
        >
          {value.toFixed(value < 1 ? 2 : 0)}{unit}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        min={min}
        max={max}
        step={step}
        className="mb-2"
      />
      <p
        className="text-xs leading-relaxed"
        style={{ color: "#9B9B95", lineHeight: "1.5" }}
      >
        {description}
      </p>
    </div>
  );
}

// ─── Upload Zone ────────────────────────────────────────────────────────────

function UploadZone({
  onFiles,
  disabled,
  onWarning,
}: {
  onFiles: (files: File[]) => void;
  disabled: boolean;
  onWarning?: (warning: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const MAX_FILE_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB

  const checkFilesAndWarn = (files: File[]) => {
    const audioFiles = files.filter((f) => f.type.startsWith("audio/"));
    
    let totalSize = 0;
    let hasLargeFile = false;
    
    for (const file of audioFiles) {
      totalSize += file.size;
      if (file.size > MAX_FILE_SIZE) {
        hasLargeFile = true;
      }
    }
    
    if (hasLargeFile || totalSize > MAX_FILE_SIZE) {
      const sizeMB = (totalSize / (1024 * 1024)).toFixed(0);
      const warning = `⚠️ 文件较大 (${sizeMB}MB)，建议使用 96-128kbps MP3 格式以获得最佳性能`;
      onWarning?.(warning);
    } else {
      onWarning?.(null);
    }
    
    if (audioFiles.length > 0) {
      onFiles(audioFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    checkFilesAndWarn(files);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isDragging ? "bg-blue-50" : "bg-white"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      style={{
        borderColor: isDragging ? "#2D4EF5" : "#E8E8E4",
        backgroundColor: isDragging ? "#F0F4FF" : "#FAFAF8",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        !disabled && setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={!disabled ? handleClick : undefined}
    >
      <div className="mb-3">
        <svg
          className="w-12 h-12 mx-auto"
          style={{ color: "#2D4EF5" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 16v-4m0 0V8m0 4H8m4 0h4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <p
        className="text-sm font-medium mb-1"
        style={{ color: "#1A1A1A" }}
      >
        拖拽或点击上传音频
      </p>
      <p
        className="text-xs"
        style={{ color: "#9B9B95" }}
      >
        支持 MP3、WAV、M4A、OGG、FLAC 等格式
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="audio/*"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          checkFilesAndWarn(files);
        }}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Home() {
  const [params, setParams] = useState<AnalysisParams>(DEFAULT_PARAMS);
  const [result, setResult] = useState<AudioAnalysisResult | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchResults, setBatchResults] = useState<Map<string, AudioAnalysisResult>>(new Map());
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [shortenedSilenceDuration, setShortenedSilenceDuration] = useState(0.5);
  const [exporting, setExporting] = useState(false);

  const effectiveCountUp = useCountUpTime(result?.effectiveDuration || 0);
  const silenceCountUp = useCountUpTime(result?.silenceDuration || 0);
  const totalCountUp = useCountUpTime(result?.totalDuration || 0);

  const handleParamChange = useCallback(
    (key: keyof AnalysisParams, value: number) => {
      const newParams = { ...params, [key]: value };
      setParams(newParams);
      if (result) {
        setAnalyzing(true);
        setTimeout(async () => {
          try {
            // Re-analyze with new params
            setAnalyzing(false);
          } catch (err) {
            console.error("Re-analysis failed:", err);
            setAnalyzing(false);
          }
        }, 100);
      }
    },
    [params, result]
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      
      setBatchMode(true);
      setBatchResults(new Map());
      setError(null);
      setResult(null);
      setAnalyzing(true);
      setProgress(0);
      
      try {
        // First, analyze individual files
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setProgress(Math.round((i / files.length) * 40));
          
          try {
            const res = await analyzeAudio(file, params, () => {});
            setBatchResults(prev => new Map(prev).set(file.name, res));
          } catch (err) {
            console.error(`Failed to analyze ${file.name}:`, err);
            setError(`分析 ${file.name} 失败，文件可能过大或格式不支持`);
          }
        }
        
        // Then, analyze merged audio
        setProgress(50);
        try {
          const mergedResult = await analyzeMergedAudio(files, params, (p: number) => {
            setProgress(50 + Math.round(p * 0.5));
          });
          
          // Store merged result with a special key
          setBatchResults(prev => new Map(prev).set('__merged__', mergedResult));
        } catch (err) {
          console.error('Merged analysis failed:', err);
          setError('合并分析失败，建议使用更低比特率的 MP3 文件');
        }
        
        setProgress(100);
      } catch (err) {
        setError('批量分析失败，请检查音频文件。');
        console.error('Batch analysis failed:', err);
      } finally {
        setAnalyzing(false);
        setTimeout(() => setProgress(0), 500);
      }
    },
    [params]
  );

  const handleExport = async () => {
    if (!result) return;
    setExporting(true);
    try {
      setError("Export feature coming soon");
    } catch (err) {
      console.error("Export failed:", err);
      setError("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-40" style={{ borderColor: "#E8E8E4", background: "#FAFAF8" }}>
        <div className="container py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#1A1A1A", fontFamily: "'Playfair Display', serif" }}>
              音频有效时长计算器
            </h1>
            <p className="text-xs" style={{ color: "#9B9B95" }}>
              Audio Silence Trimmer
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Controls */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              {/* Upload */}
              <div className="mb-8">
                <h2 className="text-sm font-semibold mb-4 tracking-widest uppercase" style={{ color: "#1A1A1A" }}>
                  上传音频
                </h2>
                <UploadZone onFiles={handleFiles} disabled={analyzing} onWarning={setWarning} />
                
                {/* File size warning */}
                {warning && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-3 rounded-lg text-xs"
                    style={{ background: "#FEF3C7", borderLeft: "3px solid #F59E0B", color: "#92400E" }}
                  >
                    {warning}
                  </motion.div>
                )}
              </div>

              {/* Parameters */}
              <div className="mb-8">
                <h2 className="text-sm font-semibold mb-4 tracking-widest uppercase" style={{ color: "#1A1A1A" }}>
                  检测参数
                </h2>
                <ParamControl
                  label="静音阈值"
                  value={params.silenceThresholdDb}
                  onChange={(v) => handleParamChange("silenceThresholdDb", v)}
                  min={-80}
                  max={-20}
                  step={1}
                  unit="dB"
                  description="低于此音量视为静音，越低越严格"
                />
                <ParamControl
                  label="最短静音时长"
                  value={params.minSilenceDuration}
                  onChange={(v) => handleParamChange("minSilenceDuration", v)}
                  min={0.05}
                  max={1}
                  step={0.01}
                  unit="s"
                  description="连续静音超过此时长才算作一个静音段"
                />
                <ParamControl
                  label="边缘保留时长"
                  value={params.paddingDuration}
                  onChange={(v) => handleParamChange("paddingDuration", v)}
                  min={0}
                  max={0.5}
                  step={0.01}
                  unit="s"
                  description="在静音段边缘保留的音频时长"
                />
              </div>

              {/* Shortened Silence Duration */}
              <div className="mb-8">
                <h2 className="text-sm font-semibold mb-4 tracking-widest uppercase" style={{ color: "#1A1A1A" }}>
                  缩短静音
                </h2>
                <ParamControl
                  label="缩短后静音时长"
                  value={shortenedSilenceDuration}
                  onChange={setShortenedSilenceDuration}
                  min={0.1}
                  max={2}
                  step={0.1}
                  unit="s"
                  description="每个静音段将被缩短到此时长"
                />
                
                {/* Quick buttons */}
                <div className="flex gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShortenedSilenceDuration(0.5)}
                    className={shortenedSilenceDuration === 0.5 ? "bg-blue-50" : ""}
                  >
                    500ms
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShortenedSilenceDuration(1.0)}
                    className={shortenedSilenceDuration === 1.0 ? "bg-blue-50" : ""}
                  >
                    1000ms
                  </Button>
                </div>

                {/* Export button */}
                {result && !batchMode && (
                  <Button
                    onClick={handleExport}
                    disabled={exporting || analyzing}
                    className="w-full"
                  >
                    {exporting ? "导出中..." : "导出缩短后的音频"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-2">
            {/* Loading state */}
            {analyzing && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center gap-4 py-20"
              >
                <div
                  className="w-12 h-12 border-4 border-transparent rounded-full animate-spin"
                  style={{ borderTopColor: "#2D4EF5" }}
                />
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: "#1A1A1A" }}>
                    分析中... {progress}%
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#9B9B95" }}>
                    处理音频文件
                  </p>
                </div>
              </motion.div>
            )}

            {/* Error state */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg p-4 mb-4"
                style={{ background: "#FEE2E2", borderLeft: "4px solid #EF4444" }}
              >
                <p className="text-sm" style={{ color: "#991B1B" }}>
                  {error}
                </p>
                {error.includes("文件可能过大") && (
                  <p className="text-xs mt-2" style={{ color: "#991B1B" }}>
                    💡 建议：将文件转换为 96-128kbps MP3 格式，或升级到完整版以处理大文件
                  </p>
                )}
              </motion.div>
            )}

            {/* Empty state */}
            {!result && !batchMode && !analyzing && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center gap-3 py-20"
              >
                <div
                  className="text-xs tracking-widest uppercase"
                  style={{ color: "#C8C8C4" }}
                >
                  等待音频上传
                </div>
                <p
                  className="text-sm text-center max-w-xs"
                  style={{ color: "#C8C8C4", lineHeight: 1.6 }}
                >
                  上传音频文件后，系统将自动检测静音段并计算有效时长
                </p>
              </motion.div>
            )}

            {/* Batch Results */}
            <AnimatePresence>
              {batchMode && batchResults.size > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col gap-6"
                >
                  <div>
                    <h3 className="text-sm font-semibold mb-4" style={{ color: "#1A1A1A" }}>
                      批量分析结果 ({batchResults.size - 1})
                    </h3>
                    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#E8E8E4" }}>
                      <table className="w-full text-xs">
                        <thead style={{ background: "#F4F4F2" }}>
                          <tr>
                            <th className="px-4 py-3 text-left" style={{ color: "#9B9B95" }}>文件名</th>
                            <th className="px-4 py-3 text-right" style={{ color: "#9B9B95" }}>有效时长</th>
                            <th className="px-4 py-3 text-right" style={{ color: "#9B9B95" }}>静音时长</th>
                            <th className="px-4 py-3 text-right" style={{ color: "#9B9B95" }}>总时长</th>
                            <th className="px-4 py-3 text-right" style={{ color: "#9B9B95" }}>有效占比</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(batchResults.entries()).map(([name, res]) => {
                            if (name === '__merged__') return null;
                            
                            const formatTime = (seconds: number) => {
                              const hours = Math.floor(seconds / 3600);
                              const minutes = Math.floor((seconds % 3600) / 60);
                              const secs = Math.floor(seconds % 60);
                              const parts = [];
                              if (hours > 0) parts.push(`${hours}h`);
                              if (minutes > 0) parts.push(`${minutes}m`);
                              if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
                              return parts.join(' ');
                            };
                            
                            return (
                              <tr key={name} style={{ borderTop: "1px solid #E8E8E4" }}>
                                <td className="px-4 py-3" style={{ color: "#1A1A1A" }}>{name}</td>
                                <td className="px-4 py-3 text-right" style={{ color: "#2D4EF5", fontWeight: "500" }}>{formatTime(res.effectiveDuration)}</td>
                                <td className="px-4 py-3 text-right" style={{ color: "#9B9B95" }}>{formatTime(res.silenceDuration)}</td>
                                <td className="px-4 py-3 text-right" style={{ color: "#9B9B95" }}>{formatTime(res.totalDuration)}</td>
                                <td className="px-4 py-3 text-right" style={{ color: "#9B9B95" }}>{(res.effectiveRatio * 100).toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Merged result summary */}
                    {batchResults.has('__merged__') && (() => {
                      const mergedRes = batchResults.get('__merged__')!;
                      
                      const formatTime = (seconds: number) => {
                        const hours = Math.floor(seconds / 3600);
                        const minutes = Math.floor((seconds % 3600) / 60);
                        const secs = Math.floor(seconds % 60);
                        const parts = [];
                        if (hours > 0) parts.push(`${hours}h`);
                        if (minutes > 0) parts.push(`${minutes}m`);
                        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
                        return parts.join(' ');
                      };
                      
                      const exportedDuration = mergedRes.effectiveDuration + (mergedRes.silenceSegments.length * shortenedSilenceDuration);
                      
                      return (
                        <div className="mt-4 p-4 rounded-lg" style={{ background: "#F4F4F2" }}>
                          <div className="grid grid-cols-5 gap-4 text-xs font-semibold mb-6">
                            <div style={{ color: "#9B9B95" }}>合并总计</div>
                            <div className="text-right" style={{ color: "#2D4EF5" }}>{formatTime(mergedRes.effectiveDuration)}</div>
                            <div className="text-right" style={{ color: "#9B9B95" }}>{formatTime(mergedRes.silenceDuration)}</div>
                            <div className="text-right" style={{ color: "#9B9B95" }}>{formatTime(mergedRes.totalDuration)}</div>
                            <div className="text-right" style={{ color: "#9B9B95" }}>{(mergedRes.effectiveRatio * 100).toFixed(1)}%</div>
                          </div>
                          
                          {/* Export duration preview */}
                          <div className="pt-4 border-t" style={{ borderColor: "#E8E8E4" }}>
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-xs font-medium tracking-wide uppercase" style={{ color: "#9B9B95" }}>合并后导出时长</span>
                              <span className="text-xs" style={{ color: "#9B9B95" }}>缩短参数: {shortenedSilenceDuration.toFixed(3)}s × {mergedRes.silenceSegments.length} 段</span>
                            </div>
                            <div className="font-bold leading-none" style={{
                              fontFamily: "'Playfair Display', serif",
                              fontSize: "clamp(2rem, 4vw, 3rem)",
                              color: "#2D4EF5",
                              letterSpacing: "-0.02em",
                            }}>
                              {formatTime(exportedDuration)}
                            </div>
                          </div>
                          
                          {/* Total duration sum of all files */}
                          <div className="pt-4 border-t" style={{ borderColor: "#E8E8E4" }}>
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-xs font-medium tracking-wide uppercase" style={{ color: "#9B9B95" }}>所有文件总时长</span>
                            </div>
                            <div className="font-bold leading-none" style={{
                              fontFamily: "'Playfair Display', serif",
                              fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
                              color: "#1A1A1A",
                              letterSpacing: "-0.02em",
                            }}>
                              {(() => {
                                const totalDuration = Array.from(batchResults.entries())
                                  .filter(([name]) => name !== '__merged__')
                                  .reduce((sum, [, res]) => sum + res.totalDuration, 0);
                                return formatTime(totalDuration);
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              )}
              {result && !analyzing && !batchMode && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col gap-8"
                >
                  {/* Main stats - compact mode */}
                  <div className="grid grid-cols-3 gap-4">
                    <StatCard
                      label="有效时长"
                      value={effectiveCountUp}
                      accent
                      compact
                    />
                    <StatCard
                      label="静音时长"
                      value={silenceCountUp}
                      compact
                    />
                    <StatCard
                      label="总时长"
                      value={totalCountUp}
                      compact
                    />
                  </div>

                  {/* Ratio bar */}
                  <RatioBar ratio={result.effectiveRatio} />

                  {/* Waveform */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span
                        className="text-xs font-medium tracking-widest uppercase"
                        style={{ color: "#9B9B95" }}
                      >
                        波形可视化
                      </span>
                      <span
                        className="text-xs font-mono"
                        style={{ color: "#9B9B95" }}
                      >
                        {result.silenceSegments.length} 个静音段
                      </span>
                    </div>
                    <WaveformVisualizer result={result} />
                  </div>

                  {/* Silence segments */}
                  {result.silenceSegments.length > 0 && (
                    <div>
                      <h3
                        className="text-xs font-medium tracking-widest uppercase mb-3"
                        style={{ color: "#1A1A1A" }}
                      >
                        静音段详情
                      </h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {result.silenceSegments.map((seg, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center px-3 py-2 rounded text-xs"
                            style={{ background: "#F4F4F2" }}
                          >
                            <span style={{ color: "#9B9B95" }}>
                              {seg.start.toFixed(2)}s - {seg.end.toFixed(2)}s
                            </span>
                            <span
                              style={{ color: "#2D4EF5", fontWeight: "500" }}
                            >
                              {seg.duration.toFixed(2)}s
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Export duration preview */}
                  <div className="p-4 rounded-lg" style={{ background: "#F4F4F2" }}>
                    <div className="flex justify-between items-center mb-3">
                      <span
                        className="text-xs font-medium tracking-wide uppercase"
                        style={{ color: "#9B9B95" }}
                      >
                        导出后时长
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: "#9B9B95" }}
                      >
                        缩短参数: {shortenedSilenceDuration.toFixed(3)}s × {result.silenceSegments.length} 段
                      </span>
                    </div>
                    <div
                      className="font-bold leading-none"
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: "clamp(2rem, 4vw, 3rem)",
                        color: "#2D4EF5",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {formatDurationHelper(
                        result.effectiveDuration +
                          result.silenceSegments.length * shortenedSilenceDuration
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function formatDurationHelper(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ');
}
