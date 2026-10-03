import { useEffect, useId, useState } from 'react';
import { ImagePlus } from 'lucide-react';

const MAX_BYTES = 5 * 1024 * 1024;

export default function FeeImagePicker({ file, onChange, disabled = false, label, required = false, existing = false }: {
  file: File | null; onChange: (file: File | null) => void; disabled?: boolean; label: string; required?: boolean; existing?: boolean;
}) {
  const id = useId();
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const select = (selected: File | undefined) => {
    if (!selected) return;
    let message = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || !/\.(jpe?g|png|webp)$/i.test(selected.name)) message = '请选择 JPEG、PNG、WebP 图片。';
    else if (!selected.size || selected.size > MAX_BYTES) message = '图片不能为空，且不能超过 5MB。';
    setError(message);
    onChange(message ? null : selected);
  };

  return <div className="fee-picker">
    <label htmlFor={id} className="fee-field-label">{label}{required && <span className="text-destructive"> *</span>}</label>
    <label className="fee-file-control" htmlFor={id} aria-disabled={disabled}>
      <ImagePlus size={20} aria-hidden="true"/>
      <span>{file ? '重新选择图片' : existing ? '更换图片' : '选择图片'}</span>
      <input id={id} aria-label={label} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={disabled}
        onChange={event => { select(event.target.files?.[0]); event.target.value = ''; }}/>
    </label>
    <p className="fee-hint">JPEG、PNG、WebP，单张最大 5MB。{existing && '不选新图片时保留原图。'}</p>
    {error && <p className="fee-error" role="alert">{error}</p>}
    {file && preview && <figure className="fee-selected-image">
      <img className="fee-image" src={preview} alt={`${label}预览`} onError={() => { setError('图片内容无法识别，请重新选择。'); onChange(null); }}/>
      <figcaption>{file.name} · {(file.size / 1024).toFixed(1)} KB</figcaption>
    </figure>}
  </div>;
}
