import files from '../../shared/default-avatars.json';

/** A stable account ID gives the same library avatar on every device and page. */
export function defaultAvatarUrl(identity?: string | null): string {
  const seed = identity?.trim() || 'classhub-guest';
  // FNV-1a distributes IDs over the supplied library without render-time
  // randomness, database writes, or reliance on optional browser storage.
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193);
  }
  return `${import.meta.env.BASE_URL}default-avatars/${files[(hash >>> 0) % files.length]}`;
}

/** Keep the uploaded avatar separate so upload/delete controls retain their meaning. */
export function resolveAvatarSrc(src: string | null | undefined, identity?: string | null): string {
  return src?.trim() || defaultAvatarUrl(identity);
}
