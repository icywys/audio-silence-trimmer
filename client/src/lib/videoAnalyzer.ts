/**
 * Video Duration Analyzer
 * Simple utility to extract duration from video files
 */

export interface VideoAnalysisResult {
  totalDuration: number;
  fileName: string;
  fileSize: number;
  fileType: string;
}

/**
 * Get video duration from file
 */
export async function getVideoDuration(file: File): Promise<VideoAnalysisResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    
    video.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve({
        totalDuration: video.duration || 0,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });
    });
    
    video.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load video: ${file.name}`));
    });
    
    video.src = url;
  });
}

/**
 * Check if file is video
 */
export function isVideoFile(file: File): boolean {
  const videoMimeTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
  ];
  
  const videoExtensions = ['.mp4', '.webm', '.ogv', '.mov', '.avi', '.mkv', '.flv', '.m4v', '.wmv'];
  
  return (
    videoMimeTypes.includes(file.type) ||
    videoExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
  );
}

/**
 * Check if file is audio
 */
export function isAudioFile(file: File): boolean {
  const audioMimeTypes = [
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/flac',
    'audio/aac',
    'audio/mp4',
    'audio/webm',
  ];
  
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.webm'];
  
  return (
    audioMimeTypes.includes(file.type) ||
    audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
  );
}
