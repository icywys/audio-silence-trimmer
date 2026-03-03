/**
 * Audio Silence Analyzer
 * Design: Minimal Scientific / Data Journalism aesthetic
 * Core logic for detecting silence segments and computing effective duration
 */

export interface SilenceSegment {
  start: number; // seconds
  end: number;   // seconds
  duration: number; // seconds
}

export interface ActiveSegment {
  start: number;
  end: number;
  duration: number;
}

export interface AudioAnalysisResult {
  totalDuration: number;
  effectiveDuration: number;
  silenceDuration: number;
  effectiveRatio: number; // 0-1
  silenceSegments: SilenceSegment[];
  activeSegments: ActiveSegment[];
  waveformData: Float32Array;
  sampleRate: number;
  fileName: string;
  fileSize: number;
  fileType: 'audio';
}

export interface AnalysisParams {
  silenceThresholdDb: number;  // e.g. -60 dB (Adobe Audition standard)
  minSilenceDuration: number;  // seconds, e.g. 0.14 (140ms - AU standard)
  paddingDuration: number;     // seconds to keep around silence edges
}

export const DEFAULT_PARAMS: AnalysisParams = {
  silenceThresholdDb: -60,
  minSilenceDuration: 0.50,
  paddingDuration: 0.02,
};

/**
 * Convert dB value to linear amplitude
 */
function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Compute RMS (Root Mean Square) for a frame
 */
function computeRms(data: Float32Array, start: number, end: number): number {
  let sum = 0;
  const len = end - start;
  for (let i = start; i < end; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / len);
}

/**
 * Downsample waveform data for visualization
 */
export function downsampleWaveform(data: Float32Array, targetPoints: number): Float32Array {
  const step = Math.floor(data.length / targetPoints);
  const result = new Float32Array(targetPoints);
  for (let i = 0; i < targetPoints; i++) {
    const start = i * step;
    const end = Math.min(start + step, data.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(data[j]);
      if (abs > max) max = abs;
    }
    result[i] = max;
  }
  return result;
}

/**
 * Core analysis logic: analyze a single audio buffer
 */
async function analyzeAudioBuffer(
  audioBuffer: AudioBuffer,
  params: AnalysisParams,
  fileName: string,
  fileSize: number,
  onProgress?: (progress: number) => void
): Promise<AudioAnalysisResult> {
  const sampleRate = audioBuffer.sampleRate;
  const totalDuration = audioBuffer.duration;

  // Mix down to mono
  const channelData = audioBuffer.getChannelData(0);
  if (audioBuffer.numberOfChannels > 1) {
    const ch2 = audioBuffer.getChannelData(1);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = (channelData[i] + ch2[i]) / 2;
    }
  }

  // Analysis window: 20ms frames
  const frameSize = Math.floor(sampleRate * 0.02);
  const threshold = dbToLinear(params.silenceThresholdDb);
  const minSilenceFrames = Math.ceil(params.minSilenceDuration / 0.02);

  // Compute RMS per frame
  const totalFrames = Math.floor(channelData.length / frameSize);
  const isSilent = new Uint8Array(totalFrames);

  for (let f = 0; f < totalFrames; f++) {
    const rms = computeRms(channelData, f * frameSize, (f + 1) * frameSize);
    isSilent[f] = rms < threshold ? 1 : 0;
  }

  onProgress?.(70);

  // Detect silence segments (consecutive silent frames >= minSilenceFrames)
  const silenceSegments: SilenceSegment[] = [];
  let silenceStart = -1;
  let silenceCount = 0;

  for (let f = 0; f <= totalFrames; f++) {
    if (f < totalFrames && isSilent[f]) {
      if (silenceStart === -1) silenceStart = f;
      silenceCount++;
    } else {
      if (silenceStart !== -1 && silenceCount >= minSilenceFrames) {
        const startSec = silenceStart * 0.02;
        const endSec = (silenceStart + silenceCount) * 0.02;
        silenceSegments.push({
          start: Math.max(0, startSec - params.paddingDuration),
          end: Math.min(totalDuration, endSec + params.paddingDuration),
          duration: endSec - startSec,
        });
      }
      silenceStart = -1;
      silenceCount = 0;
    }
  }

  // Merge overlapping silence segments
  const merged: SilenceSegment[] = [];
  for (const seg of silenceSegments) {
    if (merged.length > 0 && seg.start <= merged[merged.length - 1].end) {
      const last = merged[merged.length - 1];
      last.end = Math.max(last.end, seg.end);
      last.duration = last.end - last.start;
    } else {
      merged.push({ ...seg });
    }
  }

  // Compute active segments (gaps between silence)
  const activeSegments: ActiveSegment[] = [];
  let cursor = 0;
  for (const silence of merged) {
    if (silence.start > cursor) {
      activeSegments.push({
        start: cursor,
        end: silence.start,
        duration: silence.start - cursor,
      });
    }
    cursor = silence.end;
  }
  if (cursor < totalDuration) {
    activeSegments.push({
      start: cursor,
      end: totalDuration,
      duration: totalDuration - cursor,
    });
  }

  const silenceDuration = merged.reduce((sum, s) => sum + s.duration, 0);
  const effectiveDuration = Math.max(0, totalDuration - silenceDuration);

  onProgress?.(90);

  // Downsample waveform for visualization
  const waveformData = downsampleWaveform(channelData, 1200);

  onProgress?.(100);

  return {
    totalDuration,
    effectiveDuration,
    silenceDuration,
    effectiveRatio: totalDuration > 0 ? effectiveDuration / totalDuration : 0,
    silenceSegments: merged,
    activeSegments,
    waveformData,
    sampleRate,
    fileName,
    fileSize,
    fileType: 'audio',
  };
}

/**
 * Main analysis function: detect silence segments and compute effective duration
 */
export async function analyzeAudio(
  file: File,
  params: AnalysisParams,
  onProgress?: (progress: number) => void
): Promise<AudioAnalysisResult> {
  const audioContext = new AudioContext();

  onProgress?.(10);

  // Decode audio file
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.(30);

  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  onProgress?.(50);

  const result = await analyzeAudioBuffer(audioBuffer, params, file.name, file.size, onProgress);
  await audioContext.close();

  return result;
}

/**
 * Merge multiple audio files and analyze as a single combined audio
 */
export async function analyzeMergedAudio(
  files: File[],
  params: AnalysisParams,
  onProgress?: (progress: number) => void
): Promise<AudioAnalysisResult> {
  const audioContext = new AudioContext();
  const audioBuffers: AudioBuffer[] = [];
  let totalSamples = 0;
  let sampleRate = 0;

  // Decode all files
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(Math.floor((i / files.length) * 40));

    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer);
    audioBuffers.push(decoded);
    
    if (i === 0) {
      sampleRate = decoded.sampleRate;
    }
    
    totalSamples += decoded.length;
  }

  onProgress?.(50);

  // Create merged audio buffer
  const mergedBuffer = audioContext.createBuffer(1, totalSamples, sampleRate);
  const mergedData = mergedBuffer.getChannelData(0);

  // Boundary smoothing: remove potential artifacts at file junctions
  const boundaryFadeMs = 50; // 50ms fade at boundaries
  const boundaryFadeSamples = Math.floor((boundaryFadeMs / 1000) * sampleRate);

  let offset = 0;
  for (let i = 0; i < audioBuffers.length; i++) {
    const buffer = audioBuffers[i];
    const channelData = buffer.getChannelData(0);
    
    // For files after the first, apply fade-in at the start
    if (i > 0) {
      const fadeInStart = offset;
      const fadeInEnd = Math.min(offset + boundaryFadeSamples, offset + channelData.length);
      for (let j = fadeInStart; j < fadeInEnd; j++) {
        const fadeRatio = (j - fadeInStart) / (fadeInEnd - fadeInStart);
        mergedData[j] = channelData[j - offset] * fadeRatio;
      }
      // Copy remaining data
      for (let j = fadeInEnd; j < offset + channelData.length; j++) {
        mergedData[j] = channelData[j - offset];
      }
    } else {
      // First file: copy as-is
      mergedData.set(channelData, offset);
    }
    
    offset += buffer.length;
  }

  onProgress?.(60);

  // Analyze merged buffer
  const result = await analyzeAudioBuffer(
    mergedBuffer,
    params,
    `${files.length} files merged`,
    files.reduce((sum, f) => sum + f.size, 0),
    (p) => onProgress?.(60 + p * 0.4)
  );

  await audioContext.close();

  return result;
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ');
}

/**
 * Format file size in bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}
