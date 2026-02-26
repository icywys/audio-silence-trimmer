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
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { useCountUpTime } from "@/hooks/useCountUpTime";
import {
  analyzeAudio,
  formatDuration,
  formatFileSize,
  DEFAULT_PARAMS,
  type AudioAnalysisResult,
  type AnalysisParams,
} from "@/lib/audioAnalyzer";

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  accent = false,
  sublabel,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
  sublabel?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col gap-1"
    >
      <span
        className="text-xs font-medium tracking-widest uppercase"
        style={{ color: "#9B9B95", fontFamily: "'IBM Plex Sans', sans-serif" }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span
          className="font-bold leading-none"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(2rem, 4vw, 3.5rem)",
            color: accent ? "#2D4EF5" : "#1A1A1A",
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="text-sm font-medium"
            style={{ color: "#9B9B95", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {unit}
          </span>
        )}
      </div>
      {sublabel && (
        <span
          className="text-xs"
          style={{ color: "#B0B0AA", fontFamily: "'IBM Plex Sans', sans-serif" }}
        >
          {sublabel}
        </span>
      )}
    </motion.div>
  );
}

// ─── Animated Ratio Bar ────────────────────────────────────────────────────────

function RatioBar({ ratio }: { ratio: number }) {
  return (
    <div className="w-full">
      <div className="flex justify-between mb-1.5">
        <span
          className="text-xs tracking-widest uppercase"
          style={{ color: "#9B9B95", fontFamily: "'IBM Plex Sans', sans-serif" }}
        >
          有效占比
        </span>
        <span
          className="text-xs font-medium"
          style={{ color: "#2D4EF5", fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {(ratio * 100).toFixed(1)}%
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: "4px", background: "#E8E8E4" }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          style={{ height: "100%", background: "#2D4EF5", borderRadius: "9999px" }}
        />
      </div>
    </div>
  );
}

// ─── Segment Timeline ─────────────────────────────────────────────────────────

function SegmentTimeline({ result }: { result: AudioAnalysisResult }) {
  return (
    <div className="w-full">
      <div className="flex justify-between mb-2">
        <span
          className="text-xs tracking-widest uppercase"
          style={{ color: "#9B9B95", fontFamily: "'IBM Plex Sans', sans-serif" }}
        >
          时间轴分布
        </span>
        <span
          className="text-xs"
          style={{ color: "#9B9B95", fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {formatDuration(result.totalDuration)}
        </span>
      </div>
      <div
        className="w-full flex rounded overflow-hidden"
        style={{ height: "8px", background: "#E8E8E4" }}
      >
        {result.activeSegments.map((seg, i) => (
          <motion.div
            key={`active-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 + 0.4 }}
            style={{
              width: `${(seg.duration / result.totalDuration) * 100}%`,
              background: "#2D4EF5",
              marginLeft: i === 0 && result.silenceSegments.length > 0 && result.silenceSegments[0].start === 0
                ? `${(result.silenceSegments[0].duration / result.totalDuration) * 100}%`
                : undefined,
            }}
          />
        ))}
      </div>
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#2D4EF5" }} />
          <span className="text-xs" style={{ color: "#9B9B95", fontFamily: "'IBM Plex Sans', sans-serif" }}>
            有效音频
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#D4D4D0" }} />
          <span className="text-xs" style={{ color: "#9B9B95", fontFamily: "'IBM Plex Sans', sans-serif" }}>
            静音段
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Silence Segments Table ───────────────────────────────────────────────────

function SilenceTable({ result }: { result: AudioAnalysisResult }) {
  if (result.silenceSegments.length === 0) {
    return (
      <div
        className="text-sm py-4 text-center"
        style={{ color: "#9B9B95", fontFamily: "'IBM Plex Sans', sans-serif" }}
      >
        未检测到静音段
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto" style={{ maxHeight: "200px" }}>
      <table className="w-full text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #E8E8E4" }}>
            <th className="text-left py-1.5 pr-4 font-medium" style={{ color: "#9B9B95" }}>#</th>
            <th className="text-left py-1.5 pr-4 font-medium" style={{ color: "#9B9B95" }}>开始</th>
            <th className="text-left py-1.5 pr-4 font-medium" style={{ color: "#9B9B95" }}>结束</th>
            <th className="text-left py-1.5 font-medium" style={{ color: "#9B9B95" }}>时长</th>
          </tr>
        </thead>
        <tbody>
          {result.silenceSegments.map((seg, i) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{ borderBottom: "1px solid #F0F0EC" }}
            >
              <td className="py-1.5 pr-4" style={{ color: "#B0B0AA" }}>{i + 1}</td>
              <td className="py-1.5 pr-4" style={{ color: "#1A1A1A" }}>{seg.start.toFixed(2)}s</td>
              <td className="py-1.5 pr-4" style={{ color: "#1A1A1A" }}>{seg.end.toFixed(2)}s</td>
              <td className="py-1.5" style={{ color: "#2D4EF5" }}>{seg.duration.toFixed(2)}s</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({
  onFile,
  isDragging,
  setIsDragging,
}: {
  onFile: (file: File) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("audio/")) {
        onFile(file);
      }
    },
    [onFile, setIsDragging]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <motion.div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      animate={{
        borderColor: isDragging ? "#2D4EF5" : "#D4D4D0",
        background: isDragging ? "rgba(45,78,245,0.04)" : "transparent",
      }}
      transition={{ duration: 0.2 }}
      className="w-full flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed cursor-pointer select-none"
      style={{ minHeight: "180px", padding: "2rem" }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleChange}
      />
      <img
        src="https://private-us-east-1.manuscdn.com/sessionFile/6DytyFBPCtN5QMCFn5Cp8v/sandbox/NI3JXE06UGoSrz8dviebW7_1772123973510_na1fn_YXVkaW8tdXBsb2FkLWljb24.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvNkR5dHlGQlBDdE41UU1DRm41Q3A4di9zYW5kYm94L05JM0pYRTA2VUdvU3J6OGR2aWViVzdfMTc3MjEyMzk3MzUxMF9uYTFmbl9ZWFZrYVc4dGRYQnNiMkZrTFdsamIyNC5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=GUVINHOThd8Sc-W~877xWqPMlOzxXd0pPgbnpDoY7bq-PlSy0DFD3PaXzd8~yDLzJX9uaABNrtmnFRGh5n8x3gnOwJ0-pjXF2MqDs3E-YCAF~jky~TcRLeMk~U1J6nD~6DAuqUsaJWX7piwCQQ0a8iToZwWLentaahRBPaauIC1DQD1TnvEyzCTAeHVGbPKlYbb-QN21soJC~bVXVc3bk5tiybNkI3lS-pcJPw0RNUzeo3MCwJnxtG8x4vbyt65RZvrt8oEUtVAOLvtr09IB1pFDO26jrDv5afYXmToeFVo4HcQoCnzm8Hs60sDLvWMZIBt~gwJb0BgOLgUI1pp5kQ__"
        alt="upload"
        className="w-12 h-12 opacity-60"
        style={{ filter: isDragging ? "none" : "grayscale(0.3)" }}
      />
      <div className="text-center">
        <p
          className="text-sm font-medium"
          style={{ color: "#1A1A1A", fontFamily: "'IBM Plex Sans', sans-serif" }}
        >
          {isDragging ? "松开以上传" : "拖拽或点击上传音频"}
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: "#9B9B95", fontFamily: "'IBM Plex Sans', sans-serif" }}
        >
          支持 MP3、WAV、M4A、OGG、FLAC 等格式
        </p>
      </div>
    </motion.div>
  );
}

// ─── Parameter Control ────────────────────────────────────────────────────────

function ParamControl({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
  description,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <span
          className="text-xs font-medium tracking-wide uppercase"
          style={{ color: "#9B9B95", fontFamily: "'IBM Plex Sans', sans-serif" }}
        >
          {label}
        </span>
        <span
          className="text-sm font-medium"
          style={{ color: "#1A1A1A", fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {value}
          <span className="text-xs ml-0.5" style={{ color: "#9B9B95" }}>{unit}</span>
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
      {description && (
        <p className="text-xs" style={{ color: "#B0B0AA", fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {description}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [params, setParams] = useState<AnalysisParams>(DEFAULT_PARAMS);
  const [result, setResult] = useState<AudioAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveCountUp = useCountUpTime(result?.effectiveDuration ?? 0, 1200);
  const silenceCountUp = useCountUpTime(result?.silenceDuration ?? 0, 1200);
  const totalCountUp = useCountUpTime(result?.totalDuration ?? 0, 1000);

  const runAnalysis = useCallback(async (file: File, analysisParams: AnalysisParams) => {
    setAnalyzing(true);
    setProgress(0);
    setError(null);
    try {
      const res = await analyzeAudio(file, analysisParams, setProgress);
      setResult(res);
    } catch (err) {
      setError("音频解析失败，请检查文件格式是否支持。");
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      setCurrentFile(file);
      setResult(null);
      runAnalysis(file, params);
    },
    [params, runAnalysis]
  );

  const handleParamChange = useCallback(
    (key: keyof AnalysisParams, value: number) => {
      const newParams = { ...params, [key]: value };
      setParams(newParams);
      if (currentFile) {
        runAnalysis(currentFile, newParams);
      }
    },
    [params, currentFile, runAnalysis]
  );

  return (
    <div
      className="min-h-screen"
      style={{ background: "#FAFAF8", fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      {/* Header */}
      <header
        className="w-full border-b"
        style={{ borderColor: "#E8E8E4", background: "#FAFAF8" }}
      >
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded flex items-center justify-center"
              style={{ background: "#2D4EF5" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="5" width="2" height="4" rx="0.5" fill="white" />
                <rect x="4" y="3" width="2" height="8" rx="0.5" fill="white" />
                <rect x="7" y="1" width="2" height="12" rx="0.5" fill="white" />
                <rect x="10" y="4" width="2" height="6" rx="0.5" fill="white" />
              </svg>
            </div>
            <div>
              <h1
                className="text-sm font-semibold leading-tight"
                style={{ color: "#1A1A1A", letterSpacing: "-0.01em" }}
              >
                音频有效时长计算器
              </h1>
              <p className="text-xs" style={{ color: "#9B9B95" }}>
                Audio Silence Analyzer
              </p>
            </div>
          </div>
          {result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs"
              style={{ color: "#9B9B95", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {result.fileName} · {formatFileSize(result.fileSize)}
            </motion.div>
          )}
        </div>
      </header>

      {/* Hero waveform banner - always visible as decorative element */}
      <div
        className="w-full overflow-hidden"
        style={{ height: "72px", opacity: result ? 0.15 : 0.3, transition: "opacity 0.6s ease" }}
      >
        <img
          src="https://private-us-east-1.manuscdn.com/sessionFile/6DytyFBPCtN5QMCFn5Cp8v/sandbox/NI3JXE06UGoSrz8dviebW7-img-1_1772123970000_na1fn_YXVkaW8taGVyby1iZw.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvNkR5dHlGQlBDdE41UU1DRm41Q3A4di9zYW5kYm94L05JM0pYRTA2VUdvU3J6OGR2aWViVzctaW1nLTFfMTc3MjEyMzk3MDAwMF9uYTFmbl9ZWFZrYVc4dGFHVnlieTFpWncucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=Jb~finqXfb0DdnUOUJ9ooaghnp-BnkVZqvy7jVVjF-qPanN0Rdm0QkMOTani7g6fQqiZUXkJcFfAmpkZ1Niv6eWVgU2Bx5vrSweGq4LGv4WvpmV74-qsCo8zLpnuUpkbrjQeSPQFPTtg7nlJRM--mNWfY0MU3BRw8s3qSRRf4KRC3UTWQqYeZtLISr0WTqJP9LkqndkCsvFiNX9PXMa-zaSti0VFr6BnVEfXHLsxlq~hQJcTOSRCBhHn7XlkylaacNGl8PzwT8yUjsB2luhMT1Gx66pJ9pPOJiU6R4lYbsCYzFsRvSmLJBj5VFhjRKYOIoSBm8vnAMiVYMIOdnSW4w__"
          alt=""
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Main content */}
      <main className="container py-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

          {/* ── Left Panel: Controls ── */}
          <div className="lg:w-1/3 flex flex-col gap-6">
            {/* Upload */}
            <div>
              <h2
                className="text-xs font-medium tracking-widest uppercase mb-3"
                style={{ color: "#9B9B95" }}
              >
                上传音频
              </h2>
              <UploadZone
                onFile={handleFile}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
              />
              {error && (
                <p className="text-xs mt-2" style={{ color: "#E05252" }}>
                  {error}
                </p>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: "1px", background: "#E8E8E4" }} />

            {/* Parameters */}
            <div className="flex flex-col gap-5">
              <h2
                className="text-xs font-medium tracking-widest uppercase"
                style={{ color: "#9B9B95" }}
              >
                检测参数
              </h2>

              <ParamControl
                label="静音阈值"
                value={params.silenceThresholdDb}
                unit="dB"
                min={-70}
                max={-10}
                step={1}
                onChange={(v) => handleParamChange("silenceThresholdDb", v)}
                description="低于此音量视为静音，越低越严格"
              />

              <ParamControl
                label="最短静音时长"
                value={params.minSilenceDuration}
                unit="s"
                min={0.1}
                max={3}
                step={0.05}
                onChange={(v) => handleParamChange("minSilenceDuration", v)}
                description="连续静音超过此时长才计入空白"
              />

              <ParamControl
                label="边缘保留时长"
                value={params.paddingDuration}
                unit="s"
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => handleParamChange("paddingDuration", v)}
                description="静音段两端保留的音频缓冲"
              />
            </div>

            {/* Divider */}
            <div style={{ height: "1px", background: "#E8E8E4" }} />

            {/* File info */}
            {result && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col gap-1.5"
              >
                <h2
                  className="text-xs font-medium tracking-widest uppercase mb-1"
                  style={{ color: "#9B9B95" }}
                >
                  文件信息
                </h2>
                {[
                  ["文件名", result.fileName],
                  ["大小", formatFileSize(result.fileSize)],
                  ["采样率", `${result.sampleRate.toLocaleString()} Hz`],
                  ["静音段数", `${result.silenceSegments.length} 段`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-xs" style={{ color: "#9B9B95" }}>{k}</span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: "#1A1A1A", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* ── Right Panel: Results ── */}
          <div className="lg:w-2/3 flex flex-col gap-8">

            {/* Analyzing state */}
            <AnimatePresence>
              {analyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-4 py-16"
                >
                  <div
                    className="text-xs tracking-widest uppercase"
                    style={{ color: "#9B9B95" }}
                  >
                    正在分析
                  </div>
                  <div className="w-48 rounded-full overflow-hidden" style={{ height: "2px", background: "#E8E8E4" }}>
                    <motion.div
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                      style={{ height: "100%", background: "#2D4EF5" }}
                    />
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "#B0B0AA", fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {progress}%
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {!result && !analyzing && (
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

            {/* Results */}
            <AnimatePresence>
              {result && !analyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col gap-8"
                >
                  {/* Main stats */}
                  <div className="grid grid-cols-3 gap-6">
                    <StatCard
                      label="有效时长"
                      value={effectiveCountUp}
                      accent
                    />
                    <StatCard
                      label="静音时长"
                      value={silenceCountUp}
                    />
                    <StatCard
                      label="总时长"
                      value={totalCountUp}
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
                        波形视图
                      </span>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-sm" style={{ background: "#2D4EF5" }} />
                          <span className="text-xs" style={{ color: "#9B9B95" }}>有效</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-sm" style={{ background: "#D4D4D0" }} />
                          <span className="text-xs" style={{ color: "#9B9B95" }}>静音</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className="rounded-lg overflow-hidden"
                      style={{ background: "#F4F4F2", padding: "12px 16px" }}
                    >
                      <WaveformVisualizer result={result} height={130} />
                    </div>
                  </div>

                  {/* Timeline */}
                  <SegmentTimeline result={result} />

                  {/* Divider */}
                  <div style={{ height: "1px", background: "#E8E8E4" }} />

                  {/* Silence segments table */}
                  <div>
                    <h3
                      className="text-xs font-medium tracking-widest uppercase mb-3"
                      style={{ color: "#9B9B95" }}
                    >
                      静音段详情 ({result.silenceSegments.length} 段)
                    </h3>
                    <SilenceTable result={result} />
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
