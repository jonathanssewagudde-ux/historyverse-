import "server-only";

import { spawn } from "node:child_process";

import { ProviderUnavailableError } from "@/server/providers/contracts";

/** Run FFmpeg/FFprobe; rejects with the tail of stderr (FFmpeg reports errors at the end). */
export function runTool(command: string, args: string[], timeoutMs = 30 * 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += String(d)));
    child.stderr.on("data", (d) => {
      stderr += String(d);
      if (stderr.length > 20_000) stderr = stderr.slice(-10_000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? new ProviderUnavailableError("ffmpeg", `${command} is not installed.`)
          : error,
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else
        reject(
          new Error(
            `${command} failed (${code}): ${stderr.trim().split("\n").slice(-3).join(" ").slice(0, 400)}`,
          ),
        );
    });
  });
}

/** Duration of a media file in seconds, read by FFprobe. */
export async function probeDuration(ffprobe: string, file: string): Promise<number> {
  const out = await runTool(
    ffprobe,
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    60_000,
  );
  const seconds = Number(out.trim());
  if (!Number.isFinite(seconds)) throw new Error("Could not read the media duration.");
  return seconds;
}

/** Quote a path for use inside an FFmpeg filter graph (":", "'", "\" and "," are special). */
export function filterPath(file: string): string {
  return `'${file.replace(/\\/g, "\\\\").replace(/'/g, "'\\''").replace(/:/g, "\\:").replace(/,/g, "\\,")}'`;
}
