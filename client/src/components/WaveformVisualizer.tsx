/**
 * WaveformVisualizer Component
 * Design: Minimal Scientific - waveform as decorative data visualization
 * Shows audio waveform with silence segments highlighted in gray, active segments in indigo
 */

import { useEffect, useRef } from "react";
import type { AudioAnalysisResult } from "@/lib/audioAnalyzer";

interface WaveformVisualizerProps {
  result: AudioAnalysisResult;
  height?: number;
}

export function WaveformVisualizer({ result, height = 120 }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const displayHeight = height;

    canvas.width = width * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, displayHeight);

    const data = result.waveformData;
    const totalDuration = result.totalDuration;
    const barWidth = width / data.length;
    const midY = displayHeight / 2;

    // Build silence map: for each sample index, is it in a silence segment?
    function isInSilence(sampleIndex: number): boolean {
      const t = (sampleIndex / data.length) * totalDuration;
      for (const seg of result.silenceSegments) {
        if (t >= seg.start && t <= seg.end) return true;
      }
      return false;
    }

    // Draw waveform bars
    for (let i = 0; i < data.length; i++) {
      const amplitude = data[i];
      const barHeight = Math.max(1, amplitude * (displayHeight * 0.85));
      const x = i * barWidth;
      const silent = isInSilence(i);

      if (silent) {
        ctx.fillStyle = "rgba(180, 180, 175, 0.55)";
      } else {
        // Indigo gradient based on amplitude
        const intensity = Math.min(1, amplitude * 2);
        ctx.fillStyle = `rgba(45, 78, 245, ${0.35 + intensity * 0.65})`;
      }

      ctx.fillRect(x, midY - barHeight / 2, Math.max(barWidth - 0.5, 0.5), barHeight);
    }

    // Draw center line
    ctx.strokeStyle = "rgba(45, 78, 245, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Draw silence segment boundary markers
    for (const seg of result.silenceSegments) {
      const xStart = (seg.start / totalDuration) * width;
      const xEnd = (seg.end / totalDuration) * width;

      // Subtle background for silence region
      ctx.fillStyle = "rgba(200, 200, 195, 0.12)";
      ctx.fillRect(xStart, 0, xEnd - xStart, displayHeight);

      // Boundary lines
      ctx.strokeStyle = "rgba(180, 180, 175, 0.4)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(xStart, 0);
      ctx.lineTo(xStart, displayHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xEnd, 0);
      ctx.lineTo(xEnd, displayHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [result, height]);

  return (
    <div className="w-full relative" style={{ height }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: "block" }}
      />
    </div>
  );
}
