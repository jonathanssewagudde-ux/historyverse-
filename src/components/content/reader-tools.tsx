"use client";

import { Check, Minus, Plus, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const SIZES = ["sm", "md", "lg", "xl"] as const;
type Size = (typeof SIZES)[number];
const STORAGE_KEY = "hv-reading-size";

function readStoredSize(): Size {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return SIZES.includes(v as Size) ? (v as Size) : "md";
  } catch {
    return "md";
  }
}

/**
 * Text-size and share controls. The size is applied as a data attribute on the article element
 * and remembered in this browser only.
 */
export function ReaderTools({ targetId, title }: { targetId: string; title: string }) {
  const [size, setSize] = useState<Size>("md");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with a browser-only preference after hydration
    setSize(readStoredSize());
  }, []);

  useEffect(() => {
    document.getElementById(targetId)?.setAttribute("data-reading-size", size);
    try {
      localStorage.setItem(STORAGE_KEY, size);
    } catch {
      // storage unavailable (private mode): the size still applies for this visit
    }
  }, [size, targetId]);

  const step = (delta: number) =>
    setSize((s) => SIZES[Math.min(SIZES.length - 1, Math.max(0, SIZES.indexOf(s) + delta))]!);

  async function share() {
    const url = window.location.href.split("#")[0]!;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // dismissed: fall back to copying
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Reading options">
      <div className="flex items-center rounded-full border p-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => step(-1)}
          disabled={size === "sm"}
          aria-label="Smaller text"
        >
          <Minus />
        </Button>
        <span className="px-1 font-mono text-xs" aria-live="polite">
          Aa {SIZES.indexOf(size) + 1}/{SIZES.length}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => step(1)}
          disabled={size === "xl"}
          aria-label="Larger text"
        >
          <Plus />
        </Button>
      </div>
      <Button variant="outline" size="sm" onClick={share}>
        {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
        {copied ? "Link copied" : "Share"}
      </Button>
    </div>
  );
}
