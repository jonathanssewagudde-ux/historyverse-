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
      {items.map((t) => {
        const Icon = icons[t.icon];
        return (
          <li
            key={t.name}
            className="flex flex-col gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-gold/50"
          >
            <span className="grid size-11 place-items-center rounded-lg bg-gold/10 text-gold">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-sans text-base font-semibold">
                History of {t.name.replace(/^The /, "the ")}
              </h3>
              <StatusPill status="planned" className="mt-1" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
