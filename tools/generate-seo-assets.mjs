import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const distDir = resolve(projectRoot, 'dist');

const normalizeSiteUrl = (input) => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  if (withoutTrailingSlash.startsWith('http://') || withoutTrailingSlash.startsWith('https://')) {
    return withoutTrailingSlash;
  }
  return `https://${withoutTrailingSlash}`;
};

const fallbackSiteUrl = 'http://localhost:4173';
const siteUrl = normalizeSiteUrl(process.env.SITE_URL || process.env.VERCEL_URL) || fallbackSiteUrl;

const robotsTxt = `User-agent: *
Allow: /
Disallow: /gsxi
Disallow: /gsxi/
Disallow: /gsxi/*
Sitemap: ${siteUrl}/sitemap.xml
Host: ${siteUrl.replace(/^https?:\/\//, '')}
`;

const now = new Date().toISOString();
const urlEntries = [
  { loc: siteUrl, changefreq: 'weekly', priority: '0.8', lastmod: now },
];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries
    .map(
      ({ loc, changefreq, priority, lastmod }) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
    )
    .join('\n')}
</urlset>
`;

await mkdir(distDir, { recursive: true });
await Promise.all([
  writeFile(resolve(distDir, 'robots.txt'), robotsTxt, 'utf8'),
  writeFile(resolve(distDir, 'sitemap.xml'), sitemapXml, 'utf8'),
]);

console.log(`Generated robots.txt and sitemap.xml using ${siteUrl}`);


