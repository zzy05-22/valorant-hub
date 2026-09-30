import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['入门', '机制', '经济', '术语']),
    excerpt: z.string(),
    publishDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

const esports = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/esports' }),
  schema: z.object({
    title: z.string(),
    type: z.enum(['赛程', '新闻', '赛事科普']),
    excerpt: z.string(),
    publishDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

const patchNotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/patch-notes' }),
  schema: z.object({
    title: z.string(),
    patchVersion: z.string(),
    excerpt: z.string(),
    source: z.string().url(),
    publishDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { guides, esports, patchNotes };
