import { Modal } from '../../pages/admin/components';
import FeeImage from './FeeImage';
import type { FeeSubmission } from '../../types/fees';

export default function FeeProofDialog({ submission, sessionKey, onClose }: {
  submission: FeeSubmission | null; sessionKey: string; onClose: () => void;
}) {
  return <Modal open={Boolean(submission)} title="支付成功截图" description={submission?.user?.name ? `${submission.user.name}的缴费凭证` : '查看已提交的缴费凭证。'} onClose={onClose} width="max-w-3xl fee-image-dialog">
    {submission && <FeeImage path={`/api/fees/submissions/${encodeURIComponent(submission.id)}/proof`} version={submission.updatedAt} sessionKey={sessionKey} alt="支付成功截图"/>}
  </Modal>;
}
