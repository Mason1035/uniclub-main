import api from './axios';
import type { FeeSettings, FeeSubmission, FeeSubmissionPage, FeeStatus } from '../types/fees';

// Clearing the shared JSON Content-Type lets the browser add the multipart
// boundary. The existing axios interceptor supplies the ClassHub login JWT.
const multipartOptions = { headers: { 'Content-Type': undefined }, timeout: 60000 };

export const feesApi = {
  async settings(): Promise<FeeSettings> {
    return (await api.get('/api/fees/settings')).data.settings;
  },
  async mine(): Promise<FeeSubmission | null> {
    return (await api.get('/api/fees/me')).data.submission;
  },
  async submit(remark: string, proof: File | null, update: boolean): Promise<FeeSubmission> {
    const form = new FormData();
    form.append('remark', remark);
    if (proof) form.append('proof', proof);
    const response = update
      ? await api.patch('/api/fees/submissions/me', form, multipartOptions)
      : await api.post('/api/fees/submissions', form, multipartOptions);
    return response.data.submission;
  },
  async saveQr(paymentQr: File): Promise<FeeSettings> {
    const form = new FormData();
    form.append('paymentQr', paymentQr);
    return (await api.put('/api/admin/fees/payment-qr', form, multipartOptions)).data.settings;
  },
  async list(page: number, status: FeeStatus | ''): Promise<FeeSubmissionPage> {
    return (await api.get('/api/admin/fees/submissions', { params: { page, limit: 20, status } })).data;
  },
  async confirm(id: string): Promise<FeeSubmission> {
    return (await api.post(`/api/admin/fees/submissions/${encodeURIComponent(id)}/confirm`)).data.submission;
  },
  async image(path: string, signal: AbortSignal): Promise<Blob> {
    const { data } = await api.get<Blob>(path, { responseType: 'blob', signal, timeout: 30000 });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(data.type)) throw new Error('Invalid image response');
    return data;
  },
};
