import { SectionArticle, sectionArticleMetadata } from "@/components/content/section-pages";

export function generateMetadata({ params }: PageProps<"/countries/[slug]">) {
  return sectionArticleMetadata("countries", params);
}

export default function CountriesArticlePage({ params }: PageProps<"/countries/[slug]">) {
  return <SectionArticle section="countries" params={params} />;
}
