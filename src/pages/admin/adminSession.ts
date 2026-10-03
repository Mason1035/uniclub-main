import { createContext, useContext } from 'react';
import type { SessionUser } from './adminApi';

export const AdminSessionContext = createContext<SessionUser | null>(null);
export const useAdminSession = () => useContext(AdminSessionContext);

