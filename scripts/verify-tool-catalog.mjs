import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const read = (path) => readFileSync(resolve(root, path), 'utf8');

const dashboard = read('components/Tools/Dashboard.tsx');
const app = read('App.tsx');
const seo = read('components/SEO/RouteSEO.tsx');
const sitemap = read('public/sitemap.xml');

const dashboardRoutes = [...dashboard.matchAll(/path:\s*'([^']+)'/g)].map((match) => match[1]);
const appRoutes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]);
const seoRoutes = [...seo.matchAll(/'([^']+)':\s*\{/g)].map((match) => match[1]);
const sitemapRoutes = [...sitemap.matchAll(/<loc>https:\/\/pdfchef\.dhananjaytech\.app\/([^<]*)<\/loc>/g)]
  .map((match) => `/${match[1]}`)
  .map((route) => (route === '/' ? '/' : route.replace(/\/$/, '')));

const requiredRoutes = Array.from(new Set([...dashboardRoutes, '/', '/privacy-policy', '/pdf-chef-privacy'])).sort();
const failures = [];

for (const route of dashboardRoutes) {
  if (!appRoutes.includes(route)) failures.push(`Dashboard route is missing in App.tsx: ${route}`);
  if (!seoRoutes.includes(route)) failures.push(`Dashboard route is missing SEO metadata: ${route}`);
}

for (const route of requiredRoutes) {
  if (!sitemapRoutes.includes(route)) failures.push(`Required route is missing from sitemap.xml: ${route}`);
}

const duplicateDashboardRoutes = dashboardRoutes.filter((route, index) => dashboardRoutes.indexOf(route) !== index);
for (const route of new Set(duplicateDashboardRoutes)) {
  failures.push(`Dashboard route is duplicated: ${route}`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Verified ${dashboardRoutes.length} dashboard tools, ${appRoutes.length} app routes, and ${sitemapRoutes.length} sitemap entries.`);
