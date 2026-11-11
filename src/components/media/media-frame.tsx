import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * How an asset relates to the past. This drives labelling and is never optional:
 * the editorial policy requires authentic material, artwork and AI reconstructions to be
 * distinguishable at a glance.
 */
export type MediaKind =
  | "authentic_photo"
  | "authentic_document"
  | "artwork"
  | "map"
  | "modern_photo"
  | "diagram"
  | "unclassified"
  | "ai_reconstruction";

export const RECONSTRUCTION_LABEL =
  "AI-Generated Historical Reconstruction — Not an Authentic Photograph";

const kindLabels: Record<Exclude<MediaKind, "ai_reconstruction">, string> = {
  authentic_photo: "Archival photograph",
  authentic_document: "Historical document",
  artwork: "Historical artwork",
  map: "Map",
  modern_photo: "Modern photograph",
  diagram: "Diagram",
  unclassified: "Unclassified (not public)",
};

export interface MediaCredit {
  /** Holding institution or repository, e.g. "Wikimedia Commons". */
  source: string;
  sourceUrl?: string;
  creator?: string;
  /** License name, e.g. "Public domain" or "CC BY-SA 4.0". Required: unlicensed media is not shown. */
  license: string;
  licenseUrl?: string;
}

export interface MediaFrameProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  kind: MediaKind;
  caption?: string;
  /** Display date, already formatted (see lib/history/dates). */
  date?: string;
  credit: MediaCredit;
  priority?: boolean;
  sizes?: string;
  className?: string;
  /** Serve the file as-is instead of through the image optimizer (e.g. permission-checked media). */
  unoptimized?: boolean;
}

function ExternalLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

export function MediaFrame({
  src,
  alt,
  width,
  height,
  kind,
  caption,
  date,
  credit,
  priority,
  sizes = "(min-width: 1024px) 66vw, 100vw",
  className,
  unoptimized,
}: MediaFrameProps) {
  const isReconstruction = kind === "ai_reconstruction";

  return (
    <figure
      className={cn("overflow-hidden rounded-xl border bg-card", className)}
      data-media-kind={kind}
    >
      <div className="relative">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          priority={priority}
          unoptimized={unoptimized}
          className="h-auto w-full object-cover"
        />
        {isReconstruction ? (
          <Badge
            variant="reconstruction"
            className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] bg-[oklch(0.18_0.04_260/0.85)] whitespace-normal backdrop-blur"
          >
            {RECONSTRUCTION_LABEL}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="absolute top-3 left-3 border-[oklch(0.78_0.11_80/0.6)] bg-[oklch(0.18_0.04_260/0.75)] text-[oklch(0.9_0.05_85)] backdrop-blur"
          >
            {kindLabels[kind]}
          </Badge>
        )}
      </div>
      <figcaption className="space-y-1.5 px-4 py-3 text-sm">
        {caption && (
          <p className="text-foreground">
            {caption}
            {date && <span className="text-muted-foreground"> · {date}</span>}
          </p>
        )}
        {isReconstruction && (
          <p className="text-xs font-medium text-reconstruction">{RECONSTRUCTION_LABEL}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {credit.creator && <>{credit.creator} · </>}
          <ExternalLink href={credit.sourceUrl}>{credit.source}</ExternalLink>
          {" · "}
          <ExternalLink href={credit.licenseUrl}>{credit.license}</ExternalLink>
        </p>
      </figcaption>
    </figure>
  );
}
