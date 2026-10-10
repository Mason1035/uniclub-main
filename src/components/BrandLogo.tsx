import type { ImgHTMLAttributes } from 'react';
import branding from '../lib/branding.json';

type BrandLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'width' | 'height'> & {
  variant?: 'logo' | 'mark';
};

/** The same approved artwork at the pixel density needed by its container. */
export default function BrandLogo({ variant = 'logo', sizes, fetchPriority, ...props }: BrandLogoProps) {
  const images = branding[variant];
  const fallback = variant === 'logo' ? branding.logoFallback : branding.markFallback;
  // React 18 forwards the lowercase HTML attribute without its dev warning.
  const priority = fetchPriority ? { fetchpriority: fetchPriority } : {};
  return <picture>
    <source type="image/webp" srcSet={images.map(image => `${image.src} ${image.width}w`).join(', ')} sizes={sizes}/>
    <img {...props} {...priority} src={fallback.src} width={fallback.width} height={variant === 'logo' ? fallback.width / 3 : fallback.width} sizes={sizes}/>
  </picture>;
}
