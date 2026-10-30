import { Check, Send } from 'lucide-react';
import type { FeedbackDraft, FeedbackReceipt } from '../../lib/memberAssistant';

export default function FeedbackDraftForm({ draft, onChange, onSubmit, busy, receipt, onNew }: {
  draft: FeedbackDraft; onChange: (draft: FeedbackDraft) => void; onSubmit: () => void; busy: boolean; receipt: FeedbackReceipt | null; onNew: () => void;
}) {
  if (receipt) return <section className="assistant-feedback-receipt" role="status"><Check aria-hidden="true"/><h4>反馈已提交给管理员</h4><p>感谢你帮助 ClassHub 变得更好。你确认的摘要已进入后台反馈收件箱。</p><small>反馈编号：{receipt.id}</small><button type="button" className="assistant-action" onClick={onNew}>提交另一条反馈</button></section>;
  return <form className="assistant-feedback-draft" onSubmit={event => { event.preventDefault(); if (!busy && draft.title.trim() && draft.description.trim()) onSubmit(); }}>
    <div className="assistant-feedback-draft__heading"><h4>确认这份反馈摘要</h4><p>只有下面的内容会提交给管理员，聊天原文不会一并提交。</p></div>
    <label htmlFor="assistant-feedback-title">反馈标题 <span>必填</span></label><input id="assistant-feedback-title" value={draft.title} onChange={event => onChange({ ...draft, title: event.target.value })} required maxLength={120} disabled={busy} placeholder="用一句话描述问题或建议"/>
    <label htmlFor="assistant-feedback-description">问题或建议 <span>必填</span></label><textarea id="assistant-feedback-description" value={draft.description} onChange={event => onChange({ ...draft, description: event.target.value })} required maxLength={3000} disabled={busy} rows={4} placeholder="发生了什么？在什么情况下可以遇到？"/>
    <label htmlFor="assistant-feedback-expected">你期待的效果 <span>选填</span></label><textarea id="assistant-feedback-expected" value={draft.expected} onChange={event => onChange({ ...draft, expected: event.target.value })} maxLength={1500} disabled={busy} rows={2} placeholder="希望怎样调整会更好用？"/>
    <label htmlFor="assistant-feedback-page">相关页面 <span>选填</span></label><input id="assistant-feedback-page" value={draft.page} onChange={event => onChange({ ...draft, page: event.target.value })} maxLength={300} disabled={busy} placeholder="例如 /resources"/>
    <p className="assistant-footnote">请勿填写密码、验证码或其他人的私人资料。提交不消耗 AI 额度。</p>
    <button type="submit" className="assistant-primary" disabled={busy || !draft.title.trim() || !draft.description.trim()}><Send aria-hidden="true"/>{busy ? '正在提交…' : '确认提交给管理员'}</button>
  </form>;
}
