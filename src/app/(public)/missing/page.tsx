import { notFound } from "next/navigation";

/**
 * Target of the proxy's rewrite for unknown or unpublished article URLs. It reaches notFound()
 * while prerendering, so it is served with a real 404 status and the site's not-found page.
 */
export default function Missing() {
  notFound();
}
