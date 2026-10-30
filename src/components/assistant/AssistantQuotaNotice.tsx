import type { AssistantQuota } from '../../lib/memberAssistant';

export default function AssistantQuotaNotice({ quota }: { quota?: AssistantQuota | null }) {
  if (!quota) return null;
  return <div className="assistant-quota" data-blocked={quota.blocked} role="status">
    <p><span>24 小时额度</span><strong>已用 {quota.usedTokens.toLocaleString()} / {quota.limit.toLocaleString()}</strong><span>剩余 {quota.remainingTokens.toLocaleString()} tokens</span></p>
  </div>;
}
