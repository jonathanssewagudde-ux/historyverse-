import { SectionArticle, sectionArticleMetadata } from "@/components/content/section-pages";

export function generateMetadata({ params }: PageProps<"/people/[slug]">) {
  return sectionArticleMetadata("people", params);
}

export default function PeopleArticlePage({ params }: PageProps<"/people/[slug]">) {
  return <SectionArticle section="people" params={params} />;
}
