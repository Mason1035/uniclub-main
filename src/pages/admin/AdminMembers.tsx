/**
 * 班级成员 - read-only member directory + admin role toggle.
 * Never renders password hashes, tokens or secrets (the API does not return them).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { errorMessage, getUsers, setUserAdmin, type AdminUser, type Paged } from './adminApi';
import { AdminButton, Badge, DataTable, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, Panel, SelectInput, Td, TextInput, Th, Tr } from './components';
import { formatDate } from './formatting';

const PAGE_SIZE = 20;

const AdminMembers: React.FC = () => {
  const [data, setData] = useState<Paged<AdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(
        await getUsers({
          page,
          limit: PAGE_SIZE,
          search: query || undefined,
          role: role === 'all' ? undefined : role,
        })
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, query, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggleAdmin = async (user: AdminUser) => {
    setBusyId(user.id);
    setActionError('');
    try {
      await setUserAdmin(user.id, !user.isAdmin);
      await load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <PageHeader
        title="班级成员"
        subtitle="平台注册用户与管理员权限管理"
        actions={
          <AdminButton variant="secondary" onClick={() => void load()} loading={loading}>
            刷新
          </AdminButton>
        }
      />

      <Panel padded={false}>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQuery(search.trim());
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索姓名、邮箱或成员编号"
              className="pl-9"
            />
          </form>
          <div className="w-full sm:w-44">
            <SelectInput
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: '全部角色' },
                { value: 'admin', label: '仅管理员' },
                { value: 'member', label: '仅普通成员' },
              ]}
            />
          </div>
        </div>

        {actionError && (
          <p className="border-b border-border bg-destructive/10 px-5 py-2 text-xs text-destructive">{actionError}</p>
        )}

        {loading && !data ? (
          <LoadingState label="正在加载成员…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="没有匹配的成员" description="试试调整搜索关键词或角色筛选。" />
        ) : (
          <>
            <DataTable
              head={
                <>
                  <Th>姓名</Th>
                  <Th>邮箱</Th>
                  <Th>成员编号</Th>
                  <Th>角色</Th>
                  <Th>验证</Th>
                  <Th>最后活跃</Th>
                  <Th className="text-right">操作</Th>
                </>
              }
            >
              {data.items.map((user) => (
                <Tr key={user.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {(user.name || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </Td>
                  <Td className="text-muted-foreground">{user.email}</Td>
                  <Td>
                    <code className="font-mono text-xs text-muted-foreground">{user.uniqueId}</code>
                  </Td>
                  <Td>{user.isAdmin ? <Badge tone="success">管理员</Badge> : <Badge>普通成员</Badge>}</Td>
                  <Td>
                    {user.isVerified ? <Badge tone="info">已验证</Badge> : <Badge tone="warning">未验证</Badge>}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(user.lastActive, true)}
                  </Td>
                  <Td className="text-right">
                    <AdminButton
                      variant={user.isAdmin ? 'ghost' : 'secondary'}
                      loading={busyId === user.id}
                      onClick={() => void handleToggleAdmin(user)}
                    >
                      {user.isAdmin ? '取消管理员' : '设为管理员'}
                    </AdminButton>
                  </Td>
                </Tr>
              ))}
            </DataTable>
            <Pagination
              page={data.pagination.page}
              pages={data.pagination.pages}
              total={data.pagination.total}
              onChange={setPage}
            />
          </>
        )}
      </Panel>
    </>
  );
};

export default AdminMembers;
