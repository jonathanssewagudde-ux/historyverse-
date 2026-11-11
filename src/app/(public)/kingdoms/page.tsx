import type { Metadata } from "next";

import { SectionListing, sectionCopy } from "@/components/content/section-pages";

export const metadata: Metadata = {
  title: sectionCopy.kingdoms.title,
  description: sectionCopy.kingdoms.description,
};

export default function KingdomsPage() {
  return <SectionListing section="kingdoms" />;
}
