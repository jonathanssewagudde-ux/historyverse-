/**
 * Captions from narration: the spoken text of each scene, split into readable cues and timed
 * across that scene's narration. Pure functions, unit-tested.
 */

export interface CaptionScene {
  /** Seconds from the start of the video. */
  start: number;
  /** Seconds of narration audio in the scene (captions never outlast the voice). */
  spokenSeconds: number;
  text: string;
}

export interface Cue {
  start: number;
  end: number;
  lines: string[];
}

const LINE = 42;
const CUE_CHARS = LINE * 2;

function wrap(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current && current.length + 1 + word.length > LINE) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines;
}

/** Split text into chunks of at most two caption lines, preferring sentence ends. */
export function chunkCaption(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (current && (wrap(next).length > 2 || next.length > CUE_CHARS)) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
      if (/[.!?]["')]?$/.test(word) && current.length > LINE) {
        chunks.push(current);
        current = "";
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function buildCues(scenes: CaptionScene[]): Cue[] {
  const cues: Cue[] = [];
  for (const scene of scenes) {
    const chunks = chunkCaption(scene.text);
    const total = chunks.reduce((n, c) => n + c.length, 0) || 1;
    let t = scene.start;
    for (const chunk of chunks) {
      // Time is shared out by length, the way speech is.
      const length = (chunk.length / total) * scene.spokenSeconds;
      cues.push({ start: t, end: t + length, lines: wrap(chunk) });
      t += length;
    }
  }
  return cues;
}

const stamp = (seconds: number, sep: "," | ".") => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
};

export function toSrt(cues: Cue[]): string {
  return cues
    .map(
      (c, i) =>
        `${i + 1}\n${stamp(c.start, ",")} --> ${stamp(c.end, ",")}\n${c.lines.join("\n")}\n`,
    )
    .join("\n");
}

export function toVtt(cues: Cue[]): string {
  return `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, ".")} --> ${stamp(c.end, ".")}\n${c.lines.join("\n")}\n`).join("\n")}`;
}
