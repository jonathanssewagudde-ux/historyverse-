/**
 * Small, dependency-free audio helpers: WAV parsing and writing, MP3 duration estimation, and
 * the text clean-up applied before narration. Pure functions, unit-tested.
 */

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationMs: number;
}

const ascii = (b: Uint8Array, at: number, len: number) =>
  String.fromCharCode(...b.subarray(at, at + len));

/** Read a RIFF/WAVE header (PCM). Returns null when the bytes are not a WAV file. */
export function parseWav(body: Uint8Array): WavInfo | null {
  if (body.length < 44 || ascii(body, 0, 4) !== "RIFF" || ascii(body, 8, 4) !== "WAVE") return null;
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let offset = 12;
  let fmt: {
    channels: number;
    sampleRate: number;
    byteRate: number;
    bitsPerSample: number;
  } | null = null;
  while (offset + 8 <= body.length) {
    const id = ascii(body, offset, 4);
    let size = view.getUint32(offset + 4, true);
    if (id === "fmt ") {
      fmt = {
        channels: view.getUint16(offset + 10, true),
        sampleRate: view.getUint32(offset + 12, true),
        byteRate: view.getUint32(offset + 16, true),
        bitsPerSample: view.getUint16(offset + 22, true),
      };
    } else if (id === "data" && fmt) {
      // Streaming encoders may write 0 or 0xFFFFFFFF as the data size; use what is present.
      if (size === 0 || size === 0xffffffff || offset + 8 + size > body.length)
        size = body.length - offset - 8;
      return {
        sampleRate: fmt.sampleRate,
        channels: fmt.channels,
        bitsPerSample: fmt.bitsPerSample,
        durationMs: Math.round((size / fmt.byteRate) * 1000),
      };
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

/** Wrap 16-bit little-endian mono PCM in a WAV container. */
export function pcmToWav(pcm: Uint8Array, sampleRate: number, channels = 1): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const write = (at: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  write(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  write(36, "data");
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

const MP3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];

/**
 * Estimate an MP3's duration from its first frame's bitrate (exact for constant-bitrate files,
 * approximate for variable bitrate). Returns null when no MPEG-1 Layer III frame is found.
 */
export function estimateMp3DurationMs(body: Uint8Array): number | null {
  let i = 0;
  // Skip an ID3v2 tag.
  if (ascii(body, 0, 3) === "ID3" && body.length > 10) {
    i =
      10 +
      (((body[6]! & 0x7f) << 21) |
        ((body[7]! & 0x7f) << 14) |
        ((body[8]! & 0x7f) << 7) |
        (body[9]! & 0x7f));
  }
  for (; i + 4 < body.length; i++) {
    if (body[i] === 0xff && (body[i + 1]! & 0xfe) === 0xfa) {
      const bitrate = MP3_BITRATES[body[i + 2]! >> 4];
      if (!bitrate) continue;
      return Math.round(((body.length - i) * 8) / bitrate);
    }
  }
  return null;
}

/** Recognise narration audio from its bytes. */
export function sniffAudio(body: Uint8Array): { mime: string; ext: string } | null {
  if (parseWav(body)) return { mime: "audio/wav", ext: "wav" };
  if (ascii(body, 0, 3) === "ID3" || (body[0] === 0xff && (body[1]! & 0xe0) === 0xe0)) {
    return { mime: "audio/mpeg", ext: "mp3" };
  }
  return null;
}

/**
 * Text to speak: citation markers and emphasis marks removed, the pronunciation guide applied
 * (whole words, case-insensitive), whitespace collapsed.
 */
export function narrationText(text: string, lexicon: Record<string, string> = {}): string {
  let out = text
    .replace(/\[@[^\]]+\]|\[\^\d+\]/g, "")
    .replace(/\*\*?([^*]+)\*\*?/g, "$1")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const words = Object.entries(lexicon).filter(([w, say]) => w.trim() && say.trim());
  // Longest first, so "Kabaka Mwanga" wins over "Kabaka".
  words.sort((a, b) => b[0].length - a[0].length);
  for (const [word, say] of words) {
    const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu"),
      say.trim(),
    );
  }
  return out;
}

/** Spoken duration estimate at about 150 words a minute, for planning before narration exists. */
export function estimateSpeechSeconds(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round((words / 2.5) * 10) / 10);
}
