import { NavLink } from "@/components/site/nav-link";
import { Badge } from "@/components/ui/badge";
import { milestones } from "@/config/milestones";
import { footerNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  const current = milestones.find((m) => m.status === "in_progress" || m.status === "in_review");

  return (
    <footer className="mt-24 px-3 pb-3 sm:px-6 sm:pb-6">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border bg-card">
        <div className="grid gap-10 p-6 sm:p-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <p className="font-display text-2xl font-bold">{siteConfig.tagline}</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Every article is sourced and reviewed by an editor before it goes live. AI-made images
              are always tagged{" "}
              <Badge variant="reconstruction" className="align-middle">
                AI reconstruction
              </Badge>{" "}
              and never passed off as real photos.
            </p>
          </div>
          {footerNav.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h2 className="mb-3 font-mono text-xs font-medium text-muted-foreground lowercase">
                {"// "}
                {group.heading}
              </h2>
              <ul className="space-y-2 text-sm">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} className="transition-colors hover:text-primary" />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p
          aria-hidden
          className="text-gradient px-4 pb-4 font-display text-[14.5vw] leading-[0.9] font-extrabold tracking-tighter whitespace-nowrap select-none lg:text-[10.5rem]"
        >
          historyverse
        </p>
        <div className="flex flex-col gap-2 border-t px-6 py-4 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <span>© {siteConfig.name}</span>
          {current && (
            <span>
              building in public · milestone {current.number}/{milestones.length} ·{" "}
              {current.title.toLowerCase()}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
