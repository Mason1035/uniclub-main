import { lazy, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { validContentParams } from '../lib/routeState';

const NotFound = lazy(() => import('../pages/NotFound'));

export default function ContentRoute({ children }: { children: ReactNode }) {
  const params = useParams();
  // Invalid links should never start a request with a malformed database ID.
  return validContentParams(params) ? children : <NotFound />;
}
