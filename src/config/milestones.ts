/**
 * Source of truth for milestone progress, rendered on the development landing page and mirrored
 * in ROADMAP.md. Update both when a milestone's status changes.
 */
export type MilestoneStatus = "complete" | "in_review" | "in_progress" | "planned";

export interface Milestone {
  number: number;
  title: string;
  status: MilestoneStatus;
  summary: string;
}

export const milestones: Milestone[] = [
  {
    number: 1,
    title: "Project Foundation",
    status: "complete",
    summary:
      "Next.js, TypeScript, Tailwind, component library, architecture, testing, documentation.",
  },
  {
    number: 2,
    title: "Homepage and Design System",
    status: "complete",
    summary: "Branding, cinematic homepage, responsive navigation, dark/light themes.",
  },
  {
    number: 3,
    title: "Database and Authentication",
    status: "complete",
    summary: "PostgreSQL, Prisma models, migrations, Better Auth, roles, protected admin routes.",
  },
  {
    number: 4,
    title: "Historical Data Integration",
    status: "complete",
    summary: "Wikidata, Wikipedia, Wikimedia Commons ingestion with provenance and licensing.",
  },
  {
    number: 5,
    title: "Historical Article System",
    status: "complete",
    summary: "Article templates, country/biography/kingdom pages, references, galleries.",
  },
  {
    number: 6,
    title: "Historical Search Engine",
    status: "in_review",
    summary: "PostgreSQL full-text search, autocomplete, filters, discovery.",
  },
  {
    number: 7,
    title: "Administrator CMS",
    status: "planned",
    summary: "Dashboard, article editor, entity/media/citation management, editorial workflow.",
  },
  {
    number: 8,
    title: "AI Historical Research Engine",
    status: "planned",
    summary: "Generate History Project, source retrieval, evidence tracking, AI drafts, job queue.",
  },
  {
    number: 9,
    title: "Image and AI Reconstruction Studio",
    status: "planned",
    summary: "Media library, archival imports, licensing metadata, labelled AI reconstructions.",
  },
  {
    number: 10,
    title: "Documentary Scripts and Narration",
    status: "planned",
    summary: "Script generator, scene planner, configurable text-to-speech, audio storage.",
  },
  {
    number: 11,
    title: "Documentary Video Production",
    status: "planned",
    summary: "Remotion + FFmpeg rendering, subtitles, music, thumbnails, MP4 export.",
  },
  {
    number: 12,
    title: "YouTube Integration",
    status: "planned",
    summary: "OAuth, private uploads, metadata, scheduling, article-video linking.",
  },
  {
    number: 13,
    title: "Maps, Timelines, Family Trees",
    status: "planned",
    summary: "MapLibre map, period selector, global timeline, royal genealogies.",
  },
  {
    number: 14,
    title: "AI Assistant and Global Features",
    status: "planned",
    summary: "RAG assistant, multilingual UI, bookmarks, audio articles, quizzes, collections.",
  },
  {
    number: 15,
    title: "Testing, Optimization, Launch",
    status: "planned",
    summary: "Security, performance, accessibility, SEO, deployment, end-to-end testing.",
  },
];
