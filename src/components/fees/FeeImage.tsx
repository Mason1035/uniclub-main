import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { feesApi } from '../../lib/feesApi';
import { AdminButton } from '../../pages/admin/components';

export default function FeeImage({ path, version, sessionKey, alt, className = '' }: {
  path: string; version: string | null; sessionKey: string; alt: string; className?: string;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setUrl('');
    setError(false);
    void feesApi.image(path, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, version, sessionKey, retry]);

  if (error) return <div className="fee-image-state" role="alert"><p>图片暂时无法显示，请重试。</p><AdminButton variant="secondary" onClick={() => setRetry(value => value + 1)}>重新加载图片</AdminButton></div>;
  if (!url) return <div className="fee-image-state" role="status"><Loader2 className="h-5 w-5 animate-spin"/>正在加载图片…</div>;
  return <img className={`fee-image ${className}`} src={url} alt={alt} onError={() => setError(true)}/>;
}
