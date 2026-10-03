import { isAxiosError } from 'axios';

export const apiFailure = (error: unknown, fallback: string) => {
  if (isAxiosError<{ error?: string; message?: string }>(error)) {
    return {
      status: error.response?.status,
      message: error.response?.data?.error || error.response?.data?.message || error.message || fallback,
    };
  }
  return { status: undefined, message: error instanceof Error ? error.message : fallback };
};
