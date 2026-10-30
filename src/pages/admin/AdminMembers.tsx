import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { assignableRoles, hasPermission, ROLE_LABELS, USER_ROLES, roleOf, type UserRole } from '../../lib/roles';
import { useAdminSession } from './adminSession';
import { addRosterEntry, errorMessage, getMembers, setUserRole, type ManagedMember, type MemberDirectoryPage } from './adminApi';
import { AdminButton, Badge, DataTable, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, Panel, SelectInput, Td, TextInput, Th, Tr } from './components';
import MemberRosterActions from './MemberRosterActions';
import { formatDate } from './formatting';

const PAGE_SIZE = 20;

export default function AdminMembers() {
  const actor = useAdminSession();
  const canAssign = hasPermission(actor, 'roles:manage');
  const canMaintain = hasPermission(actor, 'roster:manage');
  const [data, setData] = useState<MemberDirectoryPage | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [role, setRole] = useState('all'), [membership, setMembership] = useState('all');
  const [page, setPage] = useState(1);
  const [draftRoles, setDraftRoles] = useState<Record<string, UserRole>>({});
  const [busyId, setBusyId] = useState(''), [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true); setError('');
    try {
      const result = await getMembers({ page, limit: PAGE_SIZE, search: query || undefined,
        role: role === 'all' ? undefined : role, membership: membership === 'all' ? undefined : membership });
      if (request === requestId.current) setData(result);
    } catch (failure) { if (request === requestId.current) setError(errorMessage(failure)); }
    finally { if (request === requestId.current) setLoading(false); }
  }, [page, query, role, membership]);
  const invalidateRequests = useCallback(() => { ++requestId.current; }, []);
  useEffect(() => { void load(); return invalidateRequests; }, [load, invalidateRequests]);
  useEffect(() => { setDraftRoles({}); }, [page, query, role, membership]);

  const changeRole = async (member: ManagedMember) => {
    const nextRole = draftRoles[member.id] ?? roleOf(member);
    if (busyId || !actor || !member.accountId || !assignableRoles(actor, member).includes(nextRole) || nextRole === roleOf(member)) return;
    setBusyId(member.id); setActionError('');
    try {
      await setUserRole(member.accountId, nextRole);
      setDraftRoles(current => { const next = { ...current }; delete next[member.id]; return next; });
      await load();
    } catch (failure) { setActionError(errorMessage(failure)); }
    finally { setBusyId(''); }
  };
  const provision = async (member: ManagedMember) => {
    if (!canMaintain || busyId || member.registered || !member.rosterId) return;
    setBusyId(member.id); setActionError('');
    try {
      await addRosterEntry({ uniqueId: member.uniqueId, name: member.rosterName || member.name, email: member.rosterEmail });
      await load();
    } catch (failure) { setActionError(errorMessage(failure)); }
    finally { setBusyId(''); }
  };
  const summary = data?.summary;

  return <>
    <PageHeader title="班级成员"
      subtitle={canMaintain ? '统一管理班级名单、成员账号与身份；新账号初始密码为学号，已有账号保留原密码'
        : canAssign ? '统一查看成员与账号状态；老师可任命或撤销班委' : '统一查看成员、身份与账号状态'}
      actions={<><AdminButton variant="secondary" onClick={() => void load()} loading={loading}>刷新</AdminButton>
        {canMaintain && <MemberRosterActions onChanged={load} deleting={deleting} onDeleteClose={() => setDeleting(null)}/>}</>}/>
    {summary && <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['成员账号', summary.accounts, `名单内已开通 ${summary.registeredRoster} 人`],
        ['班级名单', summary.roster, '按学号维护的在班成员'],
        ['待开通账号', summary.pending, '已在名单中，尚无登录账号'],
        ['名单外账号', summary.outside, '账号保留，可继续查看身份'],
      ].map(([label, value, hint]) => <div key={label} className="glass-material glass-material--workspace p-5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>)}
    </div>}
    <Panel padded={false}>
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 xl:flex-row xl:items-center">
        <form className="relative flex-1" onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <TextInput aria-label="搜索班级成员" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder="搜索姓名 / 学号或编号 / 联系邮箱" className="pl-9"/>
        </form>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SelectInput aria-label="筛选成员身份" value={role} onChange={event => { setRole(event.target.value); setPage(1); }}
            options={[{ value: 'all', label: '全部身份' }, ...USER_ROLES.map(value => ({ value, label: ROLE_LABELS[value] }))]}/>
          <SelectInput aria-label="筛选名单状态" value={membership} onChange={event => { setMembership(event.target.value); setPage(1); }}
            options={[{ value: 'all', label: '全部名单状态' }, { value: 'enrolled', label: '班级名单内' }, { value: 'outside', label: '名单外账号' }, { value: 'pending', label: '待开通账号' }]}/>
        </div>
      </div>
      {actionError && <p role="alert" className="border-b border-border bg-destructive/10 px-5 py-3 text-sm text-destructive">{actionError}</p>}
      {loading && !data ? <LoadingState label="正在加载班级成员…"/> : error ? <ErrorState message={error} onRetry={() => void load()}/>
        : !data?.items.length ? <EmptyState title="没有匹配的成员" description="可调整关键词、身份或名单状态筛选；管理员也可通过上方按钮添加或批量导入成员。"/>
        : <><DataTable head={<><Th>姓名</Th><Th>学号 / 编号</Th><Th>联系邮箱</Th><Th>身份</Th><Th>名单与账号</Th><Th>最后活跃</Th><Th className="text-right">操作</Th></>}>
          {data.items.map(member => {
            const options = actor && member.accountId ? assignableRoles(actor, member) : [];
            return <Tr key={member.id}>
              <Td><span className="font-medium">{member.name}</span>{member.rosterName && member.rosterName !== member.name && <span className="mt-1 block text-xs text-muted-foreground">名单姓名：{member.rosterName}</span>}</Td>
              <Td><code className="font-mono text-xs text-muted-foreground">{member.uniqueId}</code></Td>
              <Td className="text-muted-foreground">{member.email || member.rosterEmail || '—'}</Td>
              <Td><Badge tone={roleOf(member) === 'admin' ? 'success' : 'neutral'}>{ROLE_LABELS[roleOf(member)]}</Badge></Td>
              <Td><div className="flex flex-col items-start gap-1.5"><Badge tone={!member.registered ? 'warning' : member.inRoster ? 'success' : 'neutral'}>{!member.registered ? '名单内 · 待开通' : member.inRoster ? '名单内 · 账号已创建' : '名单外账号'}</Badge>
                {member.registered && <span className="text-xs text-muted-foreground">{member.isVerified ? '已验证' : '未验证'}</span>}</div></Td>
              <Td className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(member.lastActive, true)}</Td>
              <Td><div className="flex min-w-48 flex-wrap items-center justify-end gap-2">
                {options.length > 0 && <><SelectInput className="w-28" aria-label={`设置${member.name}的身份`} value={draftRoles[member.id] ?? roleOf(member)} disabled={Boolean(busyId)}
                  onChange={event => setDraftRoles(current => ({ ...current, [member.id]: event.target.value as UserRole }))}
                  options={options.map(value => ({ value, label: ROLE_LABELS[value] }))}/>
                  <AdminButton variant="secondary" loading={busyId === member.id} disabled={Boolean(busyId) || !draftRoles[member.id] || draftRoles[member.id] === roleOf(member)} onClick={() => void changeRole(member)}>保存身份</AdminButton></>}
                {canMaintain && !member.registered && <AdminButton variant="secondary" loading={busyId === member.id} disabled={Boolean(busyId)} onClick={() => void provision(member)}>开通账号</AdminButton>}
                {canMaintain && member.rosterId && <AdminButton variant="danger-outline" disabled={Boolean(busyId)} onClick={() => setDeleting({ id: member.rosterId!, name: member.rosterName || member.name })}><Trash2 className="h-3.5 w-3.5"/>移出名单</AdminButton>}
                {!options.length && !(canMaintain && member.rosterId) && <span className="text-xs text-muted-foreground">{actor?.id === member.accountId ? '当前账号' : '只读'}</span>}
              </div></Td>
            </Tr>;
          })}
        </DataTable><Pagination page={data.pagination.page} pages={data.pagination.pages} total={data.pagination.total} onChange={setPage}/></>}
    </Panel>
  </>;
}
