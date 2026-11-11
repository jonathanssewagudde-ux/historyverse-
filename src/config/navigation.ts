/**
 * Site navigation. Each item names the milestone that delivers its route. A route is linked only
 * once it is listed in `availableRoutes`; until then it renders as an unavailable item instead of
 * a link to a 404, so the navigation never promises pages that do not exist.
 */
export interface NavItem {
  title: string;
  href: string;
  milestone: number;
  description?: string;
}

/** Routes that are implemented. Add a route here in the milestone that ships it. */
export const availableRoutes: ReadonlySet<string> = new Set([
  "/",
  "/sign-in",
  "/sign-up",
  "/profile",
  "/admin",
  "/admin/imports",
  "/admin/articles",
  "/kingdoms",
  "/countries",
  "/people",
  "/search",
  "/explore",
]);

export function isRouteAvailable(href: string): boolean {
  const path = href.split(/[?#]/)[0] || "/";
  return availableRoutes.has(path);
}

export const primaryNav: NavItem[] = [
  { title: "Explore", href: "/explore", milestone: 6, description: "Browse every subject" },
  { title: "Countries", href: "/countries", milestone: 5, description: "National histories" },
  { title: "People", href: "/people", milestone: 5, description: "Biographies and leaders" },
  { title: "Kingdoms", href: "/kingdoms", milestone: 5, description: "Kingdoms and empires" },
  { title: "Timeline", href: "/timeline", milestone: 13, description: "World history by era" },
  { title: "Map", href: "/map", milestone: 13, description: "Interactive historical map" },
  {
    title: "Documentaries",
    href: "/documentaries",
    milestone: 12,
    description: "HISTORYVERSE films",
  },
  { title: "Ask History", href: "/ask-history", milestone: 14, description: "Grounded AI answers" },
];

export const footerNav: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Discover",
    items: [
      { title: "Countries", href: "/countries", milestone: 5 },
      { title: "People", href: "/people", milestone: 5 },
      { title: "Presidents", href: "/presidents", milestone: 5 },
      { title: "Monarchs", href: "/monarchs", milestone: 5 },
      { title: "Kingdoms", href: "/kingdoms", milestone: 5 },
      { title: "Civilizations", href: "/civilizations", milestone: 5 },
      { title: "Events", href: "/events", milestone: 5 },
    ],
  },
  {
    heading: "Explore",
    items: [
      { title: "Search", href: "/search", milestone: 6 },
      { title: "Timeline", href: "/timeline", milestone: 13 },
      { title: "Map", href: "/map", milestone: 13 },
      { title: "Today in History", href: "/today-in-history", milestone: 14 },
      { title: "Collections", href: "/collections", milestone: 14 },
    ],
  },
  {
    heading: "Watch & Ask",
    items: [
      { title: "Documentaries", href: "/documentaries", milestone: 12 },
      { title: "Ask History", href: "/ask-history", milestone: 14 },
      { title: "Bookmarks", href: "/bookmarks", milestone: 14 },
    ],
  },
];
