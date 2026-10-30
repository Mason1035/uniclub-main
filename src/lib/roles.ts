export const USER_ROLES = ['student', 'committee', 'teacher', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];
export type Permission = 'backend' | 'content:manage' | 'roles:manage' | 'system:manage' | 'roster:manage';
export interface RoleIdentity { role?: UserRole; permissions?: Permission[]; isAdmin?: boolean; }
export const ROLE_LABELS: Record<UserRole, string> = { student: '学生', committee: '班委', teacher: '老师', admin: '管理员' };
const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  student: [], committee: ['backend', 'content:manage'], teacher: ['backend', 'content:manage', 'roles:manage'],
  admin: ['backend', 'content:manage', 'roles:manage', 'system:manage', 'roster:manage'],
};
export function roleOf(identity?: RoleIdentity | null): UserRole {
  return USER_ROLES.includes(identity?.role) ? identity.role : identity?.isAdmin === true ? 'admin' : 'student';
}
/** Only server-verified identities should be passed to authorization controls. */
export function normalizeAccess(identity?: RoleIdentity | null) {
  const role = roleOf(identity);
  const allowed = ROLE_PERMISSIONS[role];
  return { role, permissions: Array.isArray(identity?.permissions) ? allowed.filter(permission => identity.permissions.includes(permission)) : [...allowed], isAdmin: role === 'admin' };
}
export function hasPermission(identity: RoleIdentity | null | undefined, permission: Permission): boolean {
  return normalizeAccess(identity).permissions.includes(permission);
}
export function assignableRoles(actor: RoleIdentity & { id?: string }, target: RoleIdentity & { id?: string }): UserRole[] {
  if (!hasPermission(actor, 'roles:manage')) return [];
  if (roleOf(actor) === 'admin') return actor.id && actor.id === target.id ? [] : [...USER_ROLES];
  if (roleOf(actor) === 'teacher' && ['student', 'committee'].includes(roleOf(target))) return ['student', 'committee'];
  return [];
}
/** The same capability map protects deep links and filters the console navigation. */
export function backendPermissionFor(pathname: string): Permission {
  if (/^\/admin\/(?:ai|feedback)(?:\/|$)/.test(pathname)) return 'system:manage';
  // The legacy roster URL redirects to the unified directory; write controls
  // remain gated separately by roster:manage.
  if (/^\/admin\/roster(?:\/|$)/.test(pathname)) return 'backend';
  if (pathname === '/admin' || pathname === '/admin/' || /^\/admin\/members(?:\/|$)/.test(pathname)) return 'backend';
  return 'content:manage';
}
