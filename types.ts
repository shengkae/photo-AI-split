
export interface Boundary {
  id: string;
  centerX: number; // Percentage 0-100
  centerY: number; // Percentage 0-100
  width: number;   // Percentage 0-100 (aligned with photo's own axes)
  height: number;  // Percentage 0-100 (aligned with photo's own axes)
  rotation: number; // Degrees clockwise
}

export interface CroppedImage {
  id: string;
  dataUrl: string;
  isRestoring?: boolean;
}

export interface SourceScan {
  id: string;
  dataUrl: string;
  file: File;
  boundaries: Boundary[];
  isDetected: boolean;
  isProcessing?: boolean;
  statusText?: string;
  history?: Boundary[][]; // Stack of previous boundary states
  future?: Boundary[][];  // Stack of future boundary states (for redo)
}
