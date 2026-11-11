import type { Metadata } from "next";

import { SectionListing, sectionCopy } from "@/components/content/section-pages";

export const metadata: Metadata = {
  title: sectionCopy.people.title,
  description: sectionCopy.people.description,
};

export default function PeoplePage() {
  return <SectionListing section="people" />;
}
