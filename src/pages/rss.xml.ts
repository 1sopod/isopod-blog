import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../consts';
import { articleUrl, getArticles } from '../utils';

export async function GET(context: APIContext) {
    const articles = await getArticles();
    return rss({
        title: SITE.title,
        description: SITE.description,
        site: context.site!,
        items: articles.map((entry) => ({
            title: entry.data.title,
            description: entry.data.description,
            pubDate: entry.data.pubDate,
            link: articleUrl(entry),
            categories: entry.data.tags,
        })),
    });
}
