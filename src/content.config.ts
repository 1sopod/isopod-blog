import { z, defineCollection } from "astro:content";
import { glob } from 'astro/loaders';

// Files starting with "_" (like _template.md) are ignored.
const pattern = '**/[^_]*.{md,mdx}';

const image = z.object({
  url: z.string(),
  alt: z.string()
});

const projectsCollection = defineCollection({
  loader: glob({ pattern, base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    image: image.optional(),
    screenshots: z.array(image).default([]),
    platform: z.string().optional(),
    stack: z.array(z.string()).default([]),
    website: z.string().url().optional(),
    github: z.string().url().optional(),
    tags: z.array(z.string()).default([]),
    pubDate: z.coerce.date().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  })
});

const postsCollection = defineCollection({
  loader: glob({ pattern, base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    image: image.optional(),
    draft: z.boolean().default(false),
  })
});

const writeupsCollection = defineCollection({
  loader: glob({ pattern, base: "./src/content/writeups" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    platform: z.string().default("HackTheBox"),
    category: z.string().default("Machine"),
    os: z.enum(["Linux", "Windows", "FreeBSD", "OpenBSD", "Android", "Other"]).optional(),
    difficulty: z.enum(["Very Easy", "Easy", "Medium", "Hard", "Insane"]),
    // HTB only allows public writeups for retired content.
    // Writeups with retired: false are hidden from production builds.
    retired: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    image: image.optional(),
    draft: z.boolean().default(false),
  })
});

export const collections = {
  projects: projectsCollection,
  posts: postsCollection,
  writeups: writeupsCollection,
};
