import { SectionArticle, sectionArticleMetadata } from "@/components/content/section-pages";

export function generateMetadata({ params }: PageProps<"/kingdoms/[slug]">) {
  return sectionArticleMetadata("kingdoms", params);
}

export default function KingdomsArticlePage({ params }: PageProps<"/kingdoms/[slug]">) {
  return <SectionArticle section="kingdoms" params={params} />;
}
