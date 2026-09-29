export type ImageFormat = "jpg" | "png" | "webp";
export type FileCategory = "image" | "unsupported";
export type Signature = ImageFormat | "unknown";

export interface FileDescriptor {
  name: string;
  extension: string;
  mime: string;
  detectedType: Signature;
  size: number;
  category: FileCategory;
  signature: Signature;
  supportedConversions: ImageFormat[];
  error?: string;
}

export type JobStatus = "CREATED" | "VALIDATING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type ConversionStage = "queued" | "decoding" | "encoding" | "completed";

export interface ConversionSettings {
  output: ImageFormat;
  quality: number;
}

export interface ConversionJob {
  id: string;
  file: File;
  descriptor: FileDescriptor;
  settings: ConversionSettings;
  status: JobStatus;
  stage: ConversionStage;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  output?: Blob;
  outputName?: string;
}
