export type ImageFormat = "jpg" | "png" | "webp";
export type FileCategory = "image" | "pdf" | "office" | "audio" | "video" | "unsupported";
export type Signature = string;

export interface FileDescriptor {
  name: string;
  extension: string;
  mime: string;
  detectedType: Signature;
  size: number;
  category: FileCategory;
  signature: Signature;
  supportedConversions: string[];
  error?: string;
}

export type JobStatus = "CREATED" | "VALIDATING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type ConversionStage = "queued" | "uploading" | "processing" | "decoding" | "encoding" | "completed";

export interface ConversionSettings {
  output: ImageFormat;
  quality: number;
  width?: number;
  height?: number;
}

export interface JobSettings {
  output: string;
  quality: number;
  width?: number;
  height?: number;
  pages?: string;
  dpi?: number;
  rotation?: number;
  bitrate?: number;
}

export interface ConversionJob {
  id: string;
  workspace?: string;
  file: File;
  descriptor: FileDescriptor;
  settings: JobSettings;
  status: JobStatus;
  stage: ConversionStage;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  output?: Blob;
  outputName?: string;
  outputSize?: number;
  serverId?: string;
  progress?: number | null;
}
