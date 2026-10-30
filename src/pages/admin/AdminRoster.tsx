import { Navigate, useLocation } from 'react-router-dom';

export default function AdminRoster() {
  const { search, hash } = useLocation();
  return <Navigate to={`/admin/members${search}${hash}`} replace/>;
}
