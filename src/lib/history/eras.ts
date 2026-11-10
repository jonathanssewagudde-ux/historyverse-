import { formatHistoricalDate, formatHistoricalRange, type HistoricalDate } from "./dates";

/**
 * Conventional world-history periodisation used by the timeline. These boundaries are teaching
 * conventions, not facts about the past: they originate largely in European historiography and
 * vary by region (e.g. "medieval" has no single meaning for the Americas or East Asia). The UI
 * must always present them as approximate.
 */
export interface Era {
  id: string;
  name: string;
  start: HistoricalDate | null;
  end: HistoricalDate | null;
  summary: string;
}

const circa = (year: number): HistoricalDate => ({ year, precision: "year", approximate: true });

export const worldEras: Era[] = [
  {
    id: "prehistory",
    name: "Prehistory",
    start: null,
    end: circa(-3200),
    summary:
      "Human societies before written records, known through archaeology, oral tradition and the natural sciences.",
  },
  {
    id: "ancient",
    name: "Ancient",
    start: circa(-3200),
    end: circa(500),
    summary:
      "From the earliest writing systems to the classical empires, with cities, states and long-distance trade.",
  },
  {
    id: "medieval",
    name: "Medieval",
    start: circa(500),
    end: circa(1500),
    summary:
      "Also called the post-classical era: kingdoms, empires, faith traditions and trade networks spanning continents.",
  },
  {
    id: "early-modern",
    name: "Early Modern",
    start: circa(1500),
    end: circa(1800),
    summary:
      "Oceanic voyages, global exchange, the transatlantic slave trade, new empires and scientific change.",
  },
  {
    id: "modern",
    name: "Modern",
    start: circa(1800),
    end: { year: 1945, precision: "year" },
    summary: "Industrialisation, colonial empires, nationalism, revolutions and two world wars.",
  },
  {
    id: "contemporary",
    name: "Contemporary",
    start: { year: 1945, precision: "year" },
    end: null,
    summary: "Decolonisation and independence, the Cold War, globalisation and the digital age.",
  },
];

/** Display range, e.g. "c. 3200 BCE – c. 500 CE"; open ends read "Before …" / "… – present". */
export function formatEraRange(era: Era): string {
  if (!era.start && era.end) return `Before ${formatHistoricalDate(era.end)}`;
  // CE is labelled only where a range crosses the BCE/CE boundary.
  return formatHistoricalRange(era.start, era.end, { showCommonEra: "never" });
}
