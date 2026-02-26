/**
 * Audio Trimmer - Shorten Silence Segments
 * Extracts active segments and concatenates them to create a shortened audio
 */

import type { AudioAnalysisResult } from "./audioAnalyzer";

export interface TrimmerOptions {
  silenceCompressionRatio?: number; // 0-1, how much to compress silence (0 = remove, 1 = keep original)
  fadeInDuration?: number; // seconds, fade in at segment start
  fadeOutDuration?: number; // seconds, fade out at segment end
}

/**
 * Create a shortened audio by compressing silence segments
 * Returns an AudioBuffer with silence compressed
 */
export async function createShortenedAudio(
  audioBuffer: AudioBuffer,
  analysisResult: AudioAnalysisResult,
  options: TrimmerOptions = {},
  onProgress?: (progress: number) => void
): Promise<AudioBuffer> {
  const {
    silenceCompressionRatio = 0.1, // Keep 10% of silence by default
    fadeInDuration = 0.01,
    fadeOutDuration = 0.01,
  } = options;

  const audioContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.sampleRate * 60 * 60, // Max 1 hour output
    audioBuffer.sampleRate
  );

  const sampleRate = audioBuffer.sampleRate;
  const inputData: Float32Array[] = [];

  // Extract channel data
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    inputData[ch] = audioBuffer.getChannelData(ch).slice();
  }

  let outputSampleIndex = 0;
  let totalInputSamples = audioBuffer.length;

  // Process each active segment
  for (let segIdx = 0; segIdx < analysisResult.activeSegments.length; segIdx++) {
    const segment = analysisResult.activeSegments[segIdx];
    const startSample = Math.floor(segment.start * sampleRate);
    const endSample = Math.floor(segment.end * sampleRate);
    const segmentLength = endSample - startSample;

    onProgress?.((segIdx / analysisResult.activeSegments.length) * 100);

    // Copy active segment samples
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const sourceData = inputData[ch];
      const targetData = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        segmentLength,
        sampleRate
      ).getChannelData(ch);

      for (let i = 0; i < segmentLength; i++) {
        targetData[i] = sourceData[startSample + i];
      }
    }

    outputSampleIndex += segmentLength;

    // Add compressed silence after this segment (except last segment)
    if (segIdx < analysisResult.activeSegments.length - 1) {
      const nextSegment = analysisResult.activeSegments[segIdx + 1];
      const silenceStart = segment.end;
      const silenceEnd = nextSegment.start;
      const silenceDuration = silenceEnd - silenceStart;

      // Compress silence
      const compressedSilenceDuration = silenceDuration * silenceCompressionRatio;
      const compressedSilenceSamples = Math.floor(compressedSilenceDuration * sampleRate);

      if (compressedSilenceSamples > 0) {
        outputSampleIndex += compressedSilenceSamples;
      }
    }
  }

  onProgress?.(100);

  // Create output buffer with calculated length
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    outputSampleIndex,
    sampleRate
  );

  // Copy data to output buffer
  outputSampleIndex = 0;
  for (let segIdx = 0; segIdx < analysisResult.activeSegments.length; segIdx++) {
    const segment = analysisResult.activeSegments[segIdx];
    const startSample = Math.floor(segment.start * sampleRate);
    const endSample = Math.floor(segment.end * sampleRate);
    const segmentLength = endSample - startSample;

    // Copy active segment
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const sourceData = inputData[ch];
      const targetData = outputBuffer.getChannelData(ch);

      for (let i = 0; i < segmentLength; i++) {
        targetData[outputSampleIndex + i] = sourceData[startSample + i];
      }
    }

    outputSampleIndex += segmentLength;

    // Add compressed silence
    if (segIdx < analysisResult.activeSegments.length - 1) {
      const nextSegment = analysisResult.activeSegments[segIdx + 1];
      const silenceStart = segment.end;
      const silenceEnd = nextSegment.start;
      const silenceDuration = silenceEnd - silenceStart;
      const compressedSilenceDuration = silenceDuration * silenceCompressionRatio;
      const compressedSilenceSamples = Math.floor(compressedSilenceDuration * sampleRate);

      // Fill with silence (zeros)
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const targetData = outputBuffer.getChannelData(ch);
        for (let i = 0; i < compressedSilenceSamples; i++) {
          targetData[outputSampleIndex + i] = 0;
        }
      }

      outputSampleIndex += compressedSilenceSamples;
    }
  }

  return outputBuffer;
}

/**
 * Export AudioBuffer to WAV file
 */
export function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numberOfChannels; ch++) {
    channelData[ch] = audioBuffer.getChannelData(ch);
  }

  const length = audioBuffer.length;
  const arrayBuffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length * blockAlign, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, length * blockAlign, true);

  // Write audio data
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * Download audio buffer as WAV file
 */
export function downloadAudioBuffer(audioBuffer: AudioBuffer, filename: string) {
  const wav = audioBufferToWav(audioBuffer);
  const url = URL.createObjectURL(wav);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
