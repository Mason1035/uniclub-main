import { useState, type ImgHTMLAttributes } from 'react';
import { defaultAvatarUrl, resolveAvatarSrc } from '../lib/defaultAvatar';

interface UserAvatarImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  identity?: string | null;
}

export default function UserAvatarImage({ src, identity, onError, ...props }: UserAvatarImageProps) {
  const source = resolveAvatarSrc(src, identity);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  // Keep failures tied to the failed URL so a newly uploaded avatar can load.
  const displayedSource = failedSource === source ? defaultAvatarUrl(identity) : source;

  return <img {...props} src={displayedSource} onError={event => {
    setFailedSource(source);
    onError?.(event);
  }}/>;
}
