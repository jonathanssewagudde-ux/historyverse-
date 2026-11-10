/**
 * Provider contracts. Every external capability (LLM, TTS, image generation, storage, archive
 * sources, video publishing) is consumed through one of these interfaces so a provider can be
 * replaced without touching feature code. Concrete adapters arrive with their milestones.
 *
 * Rules every adapter must follow:
 *  - Never fabricate a successful response. Missing credentials → throw ProviderUnavailableError.
 *  - Billable operations must return a cost estimate first and only run after explicit approval.
 *  - Provenance (source URL, license, retrieval time) travels with every piece of retrieved content.
 */

export class ProviderUnavailableError extends Error {
  constructor(
    public readonly integrationId: string,
    message: string,
  ) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

export interface CostEstimate {
  currency: "USD";
  amount: number;
  /** How the estimate was derived, shown to the administrator before approval. */
  basis: string;
}

// ------------------------------------------------------------------------ language models
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateTextRequest {
  messages: ChatMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  /** Structured output: the adapter must return JSON matching this JSON Schema. */
  jsonSchema?: Record<string, unknown>;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LanguageModelProvider {
  readonly id: string;
  estimateCost(request: GenerateTextRequest): CostEstimate;
  generate(request: GenerateTextRequest, signal?: AbortSignal): Promise<GenerateTextResult>;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}

// ------------------------------------------------------------------------ speech
export interface Voice {
  id: string;
  name: string;
  language: string;
  /** Synthetic stock voice. Cloning a real person's voice requires documented authorization. */
  synthetic: true;
}

export interface SynthesizeSpeechRequest {
  text: string;
  voiceId: string;
  language: string;
  speed?: number;
  /** Pronunciation overrides, e.g. { "Kabaka": "kah-BAH-kah" }. */
  lexicon?: Record<string, string>;
}

export interface SpeechProvider {
  readonly id: string;
  listVoices(): Promise<Voice[]>;
  estimateCost(request: SynthesizeSpeechRequest): CostEstimate;
  synthesize(
    request: SynthesizeSpeechRequest,
    signal?: AbortSignal,
  ): Promise<{ audio: Uint8Array; mimeType: string; durationMs: number }>;
}

// ------------------------------------------------------------------------ images
export interface GenerateImageRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  variations?: number;
}

export interface ImageGenerationProvider {
  readonly id: string;
  estimateCost(request: GenerateImageRequest): CostEstimate;
  /** Output is ALWAYS stored and displayed as an AI-generated historical reconstruction. */
  generate(
    request: GenerateImageRequest,
    signal?: AbortSignal,
  ): Promise<Array<{ image: Uint8Array; mimeType: string }>>;
}

// ------------------------------------------------------------------------ storage
export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
}

export interface StorageProvider {
  readonly id: "local" | "s3";
  put(key: string, body: Uint8Array, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  /** URL a browser can load (public path or time-limited signed URL). */
  url(key: string, expiresInSeconds?: number): Promise<string>;
}

// ------------------------------------------------------------------------ archive sources
export type LicenseKind =
  "public-domain" | "cc0" | "cc-by" | "cc-by-sa" | "other-free" | "rights-reserved" | "unknown";

export interface ArchivalMediaCandidate {
  sourceId: string;
  source: string;
  title: string;
  description?: string;
  date?: string;
  creator?: string;
  sourceUrl: string;
  mediaUrl: string;
  license: { kind: LicenseKind; name: string; url?: string };
  attribution: string;
  retrievedAt: string;
}

export interface ArchiveSourceProvider {
  readonly id: string;
  searchMedia(
    query: string,
    options?: { limit?: number },
    signal?: AbortSignal,
  ): Promise<ArchivalMediaCandidate[]>;
}

// ------------------------------------------------------------------------ video publishing
export interface VideoUploadRequest {
  filePath: string;
  title: string;
  description: string;
  tags: string[];
  /** Uploads always start private; public release requires a separate approved action. */
  privacyStatus: "private";
  containsSyntheticMedia: boolean;
  publishAt?: string;
}

export interface VideoPublishingProvider {
  readonly id: string;
  upload(
    request: VideoUploadRequest,
    onProgress?: (fraction: number) => void,
  ): Promise<{ videoId: string }>;
}
