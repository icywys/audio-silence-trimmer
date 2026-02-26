/**
 * Audio Trimmer - Shorten Silence Segments
 * Adobe Audition compatible: each silence segment is shortened to a fixed duration (default 500ms)
 */

import type { AudioAnalysisResult } from "./audioAnalyzer";

export interface TrimmerOptions {
  shortenedSilenceDuration?: number; // seconds, target duration for each silence segment (e.g. 0.5s = 500ms, AU standard)
  fadeInDuration?: number; // seconds, fade in at segment start
  fadeOutDuration?: number; // seconds, fade out at segment end
}

/**
 * Create a shortened audio by replacing each silence segment with fixed duration silence
 * Adobe Audition compatible approach
 */
export async function createShortenedAudio(
  audioBuffer: AudioBuffer,
  analysisResult: AudioAnalysisResult,
  options: TrimmerOptions = {},
  onProgress?: (progress: number) => void
): Promise<AudioBuffer> {
  const {
    shortenedSilenceDuration = 0.5, // 500ms default (Adobe Audition standard)
  } = options;

  const sampleRate = audioBuffer.sampleRate;
  const inputData: Float32Array[] = [];

  // Extract channel data
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    inputData[ch] = audioBuffer.getChannelData(ch).slice();
  }

  // Calculate output buffer size
  let outputSampleCount = 0;
  
  // Add all active segments
  for (const segment of analysisResult.activeSegments) {
    const startSample = Math.floor(segment.start * sampleRate);
    const endSample = Math.floor(segment.end * sampleRate);
    outputSampleCount += (endSample - startSample);
  }
  
  // Add shortened silence segments (each becomes shortenedSilenceDuration)
  const shortenedSilenceSamples = Math.floor(shortenedSilenceDuration * sampleRate);
  const silenceSegmentCount = Math.max(0, analysisResult.activeSegments.length - 1);
  outputSampleCount += shortenedSilenceSamples * silenceSegmentCount;

  // Create output buffer
  const outputBuffer = new AudioBuffer({
    numberOfChannels: audioBuffer.numberOfChannels,
    length: outputSampleCount,
    sampleRate: sampleRate,
  });

  // Copy data to output buffer
  let outputSampleIndex = 0;
  for (let segIdx = 0; segIdx < analysisResult.activeSegments.length; segIdx++) {
    const segment = analysisResult.activeSegments[segIdx];
    const startSample = Math.floor(segment.start * sampleRate);
    const endSample = Math.floor(segment.end * sampleRate);
    const segmentLength = endSample - startSample;

    onProgress?.((segIdx / analysisResult.activeSegments.length) * 50);

    // Copy active segment
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const sourceData = inputData[ch];
      const targetData = outputBuffer.getChannelData(ch);

      for (let i = 0; i < segmentLength; i++) {
        targetData[outputSampleIndex + i] = sourceData[startSample + i];
      }
    }

    outputSampleIndex += segmentLength;

    // Add shortened silence after this segment (except last segment)
    if (segIdx < analysisResult.activeSegments.length - 1) {
      // Fill with silence (zeros) for shortenedSilenceDuration
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const targetData = outputBuffer.getChannelData(ch);
        for (let i = 0; i < shortenedSilenceSamples; i++) {
          targetData[outputSampleIndex + i] = 0;
        }
      }

      outputSampleIndex += shortenedSilenceSamples;
    }
  }

  onProgress?.(100);
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
