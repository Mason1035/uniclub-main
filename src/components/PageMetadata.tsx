import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { jsonLdText, pageMetadata } from '../lib/seo';

/** Own all route metadata; never derive public snippets from member records. */
export default function PageMetadata({ notFound }: { notFound: boolean }) {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const metadata = pageMetadata(pathname, notFound);
    document.title = metadata.title;
    document.head.querySelectorAll('[data-classhub-seo]').forEach(node => node.remove());
    const meta = (key: string, value: string, property = false) => {
      const node = document.createElement('meta');
      node.setAttribute(property ? 'property' : 'name', key);
      node.content = value;
      node.dataset.classhubSeo = '';
      document.head.append(node);
    };
    meta('description', metadata.description);
    meta('robots', metadata.robots);
    if (metadata.canonical) {
      const canonical = document.createElement('link');
      canonical.rel = 'canonical'; canonical.href = metadata.canonical;
      canonical.dataset.classhubSeo = ''; document.head.append(canonical);
      meta('og:title', metadata.title, true);
      meta('og:description', metadata.description, true);
      meta('og:type', 'website', true);
      meta('og:site_name', 'ClassHub', true);
      meta('og:locale', 'zh_CN', true);
      meta('og:url', metadata.canonical, true);
      meta('og:image', metadata.image!, true);
      meta('og:image:alt', 'ClassHub 标志', true);
      meta('twitter:card', 'summary');
      meta('twitter:title', metadata.title);
      meta('twitter:description', metadata.description);
      meta('twitter:image', metadata.image!);
    }
    if (metadata.structuredData) {
      const node = document.createElement('script');
      node.type = 'application/ld+json'; node.dataset.classhubSeo = '';
      node.textContent = jsonLdText(metadata.structuredData); document.head.append(node);
    }
  }, [pathname, notFound]);
  return null;
}
