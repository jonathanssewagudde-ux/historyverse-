import type { Metadata } from "next";

import { SectionListing, sectionCopy } from "@/components/content/section-pages";

export const metadata: Metadata = {
  title: sectionCopy.countries.title,
  description: sectionCopy.countries.description,
};

export default function CountriesPage() {
  return <SectionListing section="countries" />;
}
