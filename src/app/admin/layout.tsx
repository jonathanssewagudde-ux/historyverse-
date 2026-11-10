import type { Metadata } from "next";

import { StudioShell } from "@/components/admin/studio-shell";

export const metadata: Metadata = {
  title: { default: "AI Studio", template: "%s · AI Studio" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <StudioShell>{children}</StudioShell>;
}
