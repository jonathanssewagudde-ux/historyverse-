import { NavLink } from "@/components/site/nav-link";
import { Wordmark } from "@/components/site/wordmark";
import { Badge } from "@/components/ui/badge";
import { milestones } from "@/config/milestones";
import { footerNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  const current = milestones.find((m) => m.status === "in_progress" || m.status === "in_review");

  return (
    <footer className="mt-24 border-t border-border/70 bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Wordmark />
          <p className="max-w-sm text-sm text-muted-foreground">{siteConfig.tagline}</p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            Every article is sourced and reviewed by an editor before publication. AI-generated
            reconstructions are always labelled{" "}
            <Badge variant="reconstruction" className="align-middle">
              AI reconstruction
            </Badge>{" "}
            and never presented as authentic photographs.
          </p>
        </div>
        {footerNav.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <h2 className="mb-3 font-sans text-xs font-semibold tracking-widest text-gold uppercase">
              {group.heading}
            </h2>
            <ul className="space-y-2 text-sm">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  />
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {siteConfig.name}</span>
          {current && (
            <span>
              In development · Milestone {current.number} of {milestones.length}: {current.title}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
