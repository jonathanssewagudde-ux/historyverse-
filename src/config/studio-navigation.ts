import type { Permission } from "@/lib/auth/roles";

/** AI Studio modules, in the order of the product specification, with the milestone that ships each. */
export interface StudioNavItem {
  title: string;
  href: string;
  milestone: number;
  permission: Permission;
}

export const studioNav: StudioNavItem[] = [
  { title: "Overview", href: "/admin", milestone: 3, permission: "studio:access" },
  { title: "Data Imports", href: "/admin/imports", milestone: 4, permission: "entity:edit" },
  {
    title: "Generate History Project",
    href: "/admin/projects/new",
    milestone: 8,
    permission: "project:create",
  },
  {
    title: "Historical Research",
    href: "/admin/research",
    milestone: 8,
    permission: "research:run",
  },
  { title: "Article Studio", href: "/admin/articles", milestone: 5, permission: "article:draft" },
  {
    title: "Historical Media Library",
    href: "/admin/media",
    milestone: 7,
    permission: "media:upload",
  },
  { title: "AI Image Studio", href: "/admin/ai-images", milestone: 9, permission: "media:upload" },
  {
    title: "Documentary Script Studio",
    href: "/admin/scripts",
    milestone: 10,
    permission: "documentary:edit",
  },
  {
    title: "Voiceover Studio",
    href: "/admin/voiceovers",
    milestone: 10,
    permission: "documentary:edit",
  },
  {
    title: "Video Editor",
    href: "/admin/video-editor",
    milestone: 11,
    permission: "documentary:edit",
  },
  {
    title: "Thumbnail Generator",
    href: "/admin/thumbnails",
    milestone: 11,
    permission: "documentary:edit",
  },
  { title: "YouTube Studio", href: "/admin/youtube", milestone: 12, permission: "youtube:upload" },
  { title: "Countries Manager", href: "/admin/countries", milestone: 7, permission: "entity:edit" },
  { title: "People Manager", href: "/admin/people", milestone: 7, permission: "entity:edit" },
  { title: "Kingdoms Manager", href: "/admin/kingdoms", milestone: 7, permission: "entity:edit" },
  {
    title: "Civilizations Manager",
    href: "/admin/civilizations",
    milestone: 7,
    permission: "entity:edit",
  },
  { title: "Events Manager", href: "/admin/events", milestone: 7, permission: "entity:edit" },
  { title: "Timeline Manager", href: "/admin/timelines", milestone: 13, permission: "entity:edit" },
  { title: "Categories", href: "/admin/categories", milestone: 7, permission: "taxonomy:manage" },
  { title: "References", href: "/admin/citations", milestone: 7, permission: "source:manage" },
  {
    title: "Editorial Reviews",
    href: "/admin/reviews",
    milestone: 7,
    permission: "article:review",
  },
  {
    title: "Publishing Calendar",
    href: "/admin/calendar",
    milestone: 7,
    permission: "article:publish",
  },
  { title: "Analytics", href: "/admin/analytics", milestone: 15, permission: "analytics:view" },
  { title: "Users", href: "/admin/users", milestone: 7, permission: "user:view" },
  {
    title: "Integrations",
    href: "/admin/integrations",
    milestone: 7,
    permission: "integration:view",
  },
  { title: "Settings", href: "/admin/settings", milestone: 7, permission: "settings:manage" },
];
