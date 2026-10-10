import type { QueryClient } from '@tanstack/react-query';

const engagementTypes: Record<string, string> = {
  news: 'News', event: 'Event', resource: 'Resource', social: 'SocialPost',
};

export function invalidateCommentCounters(client: QueryClient, contentType: string, contentId: string): void {
  const engagementType = engagementTypes[contentType];
  if (!engagementType || !contentId) return;
  void client.invalidateQueries({ queryKey: ['stats', engagementType, contentId] });
  void client.invalidateQueries({ queryKey: ['comment-count', contentType, contentId] });
}
