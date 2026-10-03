/**
 * 数据概览 - ClassHub admin dashboard.
 * Counters come from GET /api/admin/stats (admin-only, real database counts).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, Newspaper, ShieldCheck, Users } from 'lucide-react';
import { errorMessage, getStats, type AdminStats } from './adminApi';
import { AdminButton, ErrorState, LoadingState, PageHeader, Panel, StatCard } from './components';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStats(await getStats());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="数据概览"
        subtitle="ClassHub 平台整体运行情况"
        actions={
          <AdminButton variant="secondary" onClick={() => void load()} loading={loading}>
            刷新数据
          </AdminButton>
        }
      />

      {loading && !stats ? (
        <LoadingState label="正在加载统计数据…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        stats && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<Users className="h-5 w-5" />}
                label="用户数量"
                value={stats.users}
                hint={`其中管理员 ${stats.breakdown?.admins ?? 0} 人`}
              />
              <StatCard
                icon={<CalendarDays className="h-5 w-5" />}
                label="活动数量"
                value={stats.events}
                hint="包含草稿与已发布"
              />
              <StatCard
                icon={<Newspaper className="h-5 w-5" />}
                label="新闻数量"
                value={stats.news}
                hint={`待审 ${stats.breakdown?.pendingNews ?? 0} 篇`}
              />
              <StatCard
                icon={<BookOpen className="h-5 w-5" />}
                label="资源数量"
                value={stats.resources}
                hint={`待审 ${stats.breakdown?.pendingResources ?? 0} 个`}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="快捷操作">
                <div className="flex flex-wrap gap-2">
                  <Link to="/admin/events">
                    <AdminButton variant="secondary">管理活动</AdminButton>
                  </Link>
                  <Link to="/admin/news">
                    <AdminButton variant="secondary">管理新闻</AdminButton>
                  </Link>
                  <Link to="/admin/resources">
                    <AdminButton variant="secondary">管理资源</AdminButton>
                  </Link>
                  <Link to="/admin/members">
                    <AdminButton variant="secondary">查看成员</AdminButton>
                  </Link>
                </div>
              </Panel>

              <Panel title="待处理事项">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center justify-between">
                    <span>待审核资源</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {stats.breakdown?.pendingResources ?? 0}
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>待审核新闻</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {stats.breakdown?.pendingNews ?? 0}
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>管理员账号</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {stats.breakdown?.admins ?? 0}
                    </span>
                  </li>
                </ul>
              </Panel>

              <Panel title="系统状态">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    已通过管理员身份校验
                  </div>
                  <p className="text-xs text-muted-foreground">
                    数据更新时间：{new Date(stats.generatedAt).toLocaleString('zh-CN')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    班级内容和成员管理仅向管理员开放。
                  </p>
                </div>
              </Panel>
            </div>
          </div>
        )
      )}
    </>
  );
};

export default AdminDashboard;
