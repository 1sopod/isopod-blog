import { getCollection, type CollectionEntry } from "astro:content";

export type Article = CollectionEntry<"posts"> | CollectionEntry<"writeups">;

// Drafts (and unretired writeups) show up in `npm run dev` but never in a build.
function isVisible(entry: { data: { draft: boolean } }) {
  return import.meta.env.DEV || !entry.data.draft;
}

const byDateDesc = (a: Article, b: Article) =>
  b.data.pubDate.valueOf() - a.data.pubDate.valueOf();

export async function getPosts() {
  return (await getCollection("posts", isVisible)).sort(byDateDesc);
}

export async function getWriteups() {
  return (await getCollection("writeups", (e) =>
    isVisible(e) && (import.meta.env.DEV || e.data.retired)
  )).sort(byDateDesc) as CollectionEntry<"writeups">[];
}

export async function getProjects() {
  const projects = await getCollection("projects", isVisible);
  return projects.sort((a, b) =>
    Number(b.data.featured) - Number(a.data.featured) ||
    (b.data.pubDate?.valueOf() ?? 0) - (a.data.pubDate?.valueOf() ?? 0)
  );
}

export async function getArticles() {
  return [...(await getPosts()), ...(await getWriteups())].sort(byDateDesc);
}

export const articleUrl = (entry: Article) => `/${entry.collection}/${entry.id}/`;

export const slugifyTag = (tag: string) =>
  tag.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function getTags() {
  const tags = new Map<string, { name: string; count: number }>();
  for (const entry of await getArticles()) {
    for (const name of entry.data.tags) {
      const slug = slugifyTag(name);
      const tag = tags.get(slug) ?? { name, count: 0 };
      tag.count++;
      tags.set(slug, tag);
    }
  }
  return [...tags].map(([slug, t]) => ({ slug, ...t })).sort((a, b) => b.count - a.count);
}

export const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

export function readingTime(body = "") {
  const words = body.replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}
