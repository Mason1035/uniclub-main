import site from '../../shared/seo.json';
import branding from './branding.json';

export const PRIVATE_ROBOTS = 'noindex, nofollow, noarchive, nosnippet';
export const PUBLIC_ROBOTS = 'index, follow';

/** Only this reviewed allowlist can publish metadata or structured data. */
export function pageMetadata(pathname: string, notFound = false) {
  // Match React Router / Vercel's case-insensitive routes and canonicalize aliases.
  const path = pathname.replace(/\/+$/, '').toLowerCase() || '/';
  const page = !notFound && site.publicPages.find(item => item.path === path);
  if (!page) return {
    title: notFound ? '404 · ClassHub' : '成员空间 · ClassHub',
    description: notFound ? '你访问的 ClassHub 页面不存在。' : 'ClassHub 成员空间，需登录并通过权限校验后访问。',
    robots: PRIVATE_ROBOTS, canonical: null, image: null, structuredData: null,
  };
  const canonical = site.origin + page.path;
  const website = {
    '@type': 'WebSite', '@id': `${site.origin}/#website`,
    name: site.name, url: `${site.origin}/`, inLanguage: 'zh-CN',
    description: site.publicPages[0].description,
  };
  const structuredData = page.path === '/' ? { '@context': 'https://schema.org', ...website }
    : page.path === '/about' ? {
      '@context': 'https://schema.org', '@type': 'WebApplication',
      '@id': `${canonical}#application`, name: site.name, url: `${site.origin}/`,
      description: page.description, applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web', browserRequirements: 'Requires JavaScript for member features',
      featureList: ['班级公告', '新闻阅读与新闻问答', '活动与相册', '学习资源', '班级动态', '随机点名', '量化材料提交', '班费缴纳记录', '管理员 AI 助手'],
    } : null;
  return { ...page, robots: PUBLIC_ROBOTS, canonical,
    image: site.origin + branding.logoFallback.src, structuredData };
}

export function jsonLdText(value: unknown) {
  // Safe in both build-time HTML and the live document; cannot terminate script.
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
