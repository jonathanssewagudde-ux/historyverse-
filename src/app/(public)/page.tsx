import { Film, Newspaper } from "lucide-react";

import { ContinentGrid } from "@/components/home/continent-grid";
import { EmptyState } from "@/components/home/empty-state";
import { EraTimeline } from "@/components/home/era-timeline";
import { ExploreWorld } from "@/components/home/explore-world";
import { FeaturedStories } from "@/components/home/featured-stories";
import { Hero } from "@/components/home/hero";
import { PopularSearches } from "@/components/home/popular-searches";
import { Section } from "@/components/home/section";
import { TechGrid } from "@/components/home/tech-grid";
import { TodayInHistory } from "@/components/home/today-in-history";
import { TopicRail } from "@/components/home/topic-rail";
import {
  africanKingdoms,
  ancientCivilizations,
  continents,
  famousFigures,
  featuredStories,
  historicalMysteries,
  monarchs,
  suggestedSearches,
  technologyTopics,
  worldLeaders,
} from "@/content/homepage";

/**
 * Public homepage. Sections are ordered as in the product specification. Until the database ships,
 * topic sections show planned subjects (name and region only) and data-driven sections show honest
 * empty states. See src/content/homepage.ts for the editorial rule.
 */
export default function HomePage() {
  return (
    <>
      <Hero />

      <Section
        id="featured"
        eyebrow="Featured"
        title="Featured Historical Stories"
        description="Flagship projects, each with a sourced article, archival media and a documentary."
      >
        <FeaturedStories stories={featuredStories} />
      </Section>

      <Section id="today" eyebrow="On this day" title="Today in History">
        <TodayInHistory />
      </Section>

      <Section
        id="explore-world"
        eyebrow="Atlas"
        title="Explore the World"
        description="Every country and territory, its ancient societies, kingdoms, independence movements and modern history."
      >
        <ExploreWorld />
      </Section>

      <Section
        id="ancient-civilizations"
        eyebrow="Antiquity"
        title="Ancient Civilizations"
        action={{ title: "All civilizations", href: "/civilizations", milestone: 5 }}
      >
        <TopicRail topics={ancientCivilizations} label="Ancient civilizations" />
      </Section>

      <Section
        id="monarchs"
        eyebrow="Royalty"
        title="Kings and Queens"
        description="Monarchs, emperors, sultans and traditional rulers, with their dynasties and documented family trees."
        action={{ title: "All monarchs", href: "/monarchs", milestone: 5 }}
      >
        <TopicRail topics={monarchs} label="Kings and queens" />
      </Section>

      <Section
        id="leaders"
        eyebrow="Statecraft"
        title="Presidents and World Leaders"
        description="Presidents, prime ministers, independence leaders and revolutionaries: their terms, policies and legacies."
        action={{ title: "All presidents", href: "/presidents", milestone: 5 }}
      >
        <TopicRail topics={worldLeaders} label="Presidents and world leaders" />
      </Section>

      <Section
        id="african-kingdoms"
        eyebrow="Collection"
        title="Great African Kingdoms"
        description="Kingdoms and empires across the continent, from the Horn of Africa to the Great Lakes, the Sahel and the south."
        action={{ title: "All kingdoms", href: "/kingdoms", milestone: 5 }}
      >
        <TopicRail topics={africanKingdoms} label="Great African kingdoms" />
      </Section>

      <Section
        id="mysteries"
        eyebrow="Open questions"
        title="Historical Mysteries"
        description="Unresolved questions, presented with the evidence and the competing interpretations side by side."
      >
        <TopicRail topics={historicalMysteries} label="Historical mysteries" />
      </Section>

      <Section
        id="figures"
        eyebrow="Lives"
        title="Famous Historical Figures"
        action={{ title: "All people", href: "/people", milestone: 5 }}
      >
        <TopicRail topics={famousFigures} label="Famous historical figures" />
      </Section>

      <Section
        id="technology"
        eyebrow="Everyday things"
        title="History of Technology"
        description="How the inventions around us came to be."
      >
        <TechGrid items={technologyTopics} />
      </Section>

      <Section
        id="timeline"
        eyebrow="Chronology"
        title="Interactive World Timeline"
        action={{ title: "Open the timeline", href: "/timeline", milestone: 13 }}
      >
        <EraTimeline />
      </Section>

      <Section id="continents" eyebrow="Regions" title="Explore by Continent">
        <ContinentGrid items={continents} />
      </Section>

      <Section
        id="documentaries"
        eyebrow="Watch"
        title="Latest Documentaries"
        action={{ title: "All documentaries", href: "/documentaries", milestone: 12 }}
      >
        <EmptyState icon={Film} title="No documentaries published yet">
          The first HISTORYVERSE documentary, on the Buganda Kingdom, is planned. Documentaries
          appear here only after editorial review and approval, with their sources and image
          licences credited.
        </EmptyState>
      </Section>

      <Section id="popular-searches" eyebrow="Search" title="Popular Searches">
        <PopularSearches searches={suggestedSearches} />
      </Section>

      <Section id="recent" eyebrow="Newsroom" title="Recently Published Stories">
        <EmptyState icon={Newspaper} title="Nothing published yet">
          Stories appear here once they have been sourced, checked in research review and approved
          by an editor.
        </EmptyState>
      </Section>
    </>
  );
}
