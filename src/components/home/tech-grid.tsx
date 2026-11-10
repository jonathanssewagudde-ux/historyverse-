import {
  Camera,
  Car,
  Clapperboard,
  Cpu,
  Gamepad2,
  Globe,
  Plane,
  Smartphone,
  Stethoscope,
  TrainFront,
  type LucideIcon,
} from "lucide-react";

import { StatusPill } from "@/components/home/status-pill";
import type { TechIcon, technologyTopics } from "@/content/homepage";
import { cn } from "@/lib/utils";

const tileColors = [
  "bg-lime text-lime-foreground",
  "bg-primary text-primary-foreground",
  "bg-pink text-[oklch(0.99_0_0)]",
  "bg-cyan text-[oklch(0.15_0.02_285)] dark:text-[oklch(0.15_0.02_285)]",
];

const icons: Record<TechIcon, LucideIcon> = {
  Globe,
  Cpu,
  Smartphone,
  Car,
  Plane,
  TrainFront,
  Gamepad2,
  Camera,
  Clapperboard,
  Stethoscope,
};

export function TechGrid({ items }: { items: typeof technologyTopics }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((t, i) => {
        const Icon = icons[t.icon];
        return (
          <li
            key={t.name}
            className="group flex flex-col gap-5 rounded-3xl border bg-card p-5 transition duration-300 hover:-translate-y-1 hover:border-primary/60"
          >
            <span
              className={cn(
                "grid size-12 place-items-center rounded-2xl transition group-hover:rotate-6",
                tileColors[i % tileColors.length],
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-base leading-tight font-bold">
                History of {t.name.replace(/^The /, "the ")}
              </h3>
              <StatusPill status="planned" className="mt-2" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
