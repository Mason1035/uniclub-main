import PageShell from '../components/PageShell';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '../context/userContextState';
import { useTheme } from '../context/themeContextState';
import { Switch } from '../components/ui/switch';
import PageHeading from '../components/PageHeading';
import ContentState from '../components/ContentState';
import ProfilePictureUpload from '../components/ProfilePictureUpload';
import AvatarManagementModal from '../components/AvatarManagementModal';
import PetSettings from '../features/pet/components/PetSettings';
import { usePet } from '../features/pet/PetContext';
import type { ClassHubPetConfigStore } from '../features/pet/pet-config';
import ChangePasswordDialog from '../features/settings/ChangePasswordDialog';
import { accountError, saveEmail, saveProfile } from '../features/settings/account-api';
import { browserNotificationState, enableBrowserNotifications } from '../features/settings/browser-notifications';
import type { NotificationPreferences } from '../features/settings/types';
import definition from '../../shared/account-settings.json';
import '../features/settings/settings.css';
const SECTIONS = [['profile-settings', '个人资料'], ['security-settings', '账户与安全'], ['notification-settings', '通知设置'], ['appearance-settings', '外观'], ['pet-settings', '桌宠设置'], ['account-actions', '账户操作']];
const NOTIFICATIONS: [keyof NotificationPreferences, string, string][] = [
  ['announcements', '新公告通知', '在通知中心显示近期班级公告。'],
  ['activities', '活动提醒', '接收与你的活动有关的站内消息。'],
  ['fees', '班费相关通知', '保留班费消息偏好，供后续提醒使用。'],
  ['materials', '材料提交相关通知', '接收与你的共享资源有关的站内消息；提交提醒将陆续接入。'],
  ['news', '新闻更新通知', '接收新闻相关消息，包括文章评论提醒。'],
];
function Section({ id, number, title, children }: { id: string; number: string; title: string; children: ReactNode }) {
  return <section id={id} className="account-section" aria-labelledby={`${id}-title`}><div className="account-section-heading"><span className="account-section-number" aria-hidden="true">{number}</span><h2 id={`${id}-title`}>{title}</h2></div>{children}</section>;
}
function AccountSettings({ store }: { store: ClassHubPetConfigStore }) {
  const { account, notifications, available, status, error: preferencesError } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { setUser, logout } = useUser(); const { isDarkMode, toggleDarkMode } = useTheme(); const { hash } = useLocation();
  const [displayName, setDisplayName] = useState(''), [bio, setBio] = useState(''), [email, setEmail] = useState('');
  const [profilePending, setProfilePending] = useState(false), [emailPending, setEmailPending] = useState(false);
  const [profileMessage, setProfileMessage] = useState(''), [profileError, setProfileError] = useState('');
  const [emailMessage, setEmailMessage] = useState(''), [emailError, setEmailError] = useState('');
  const [avatarOpen, setAvatarOpen] = useState(false), [passwordOpen, setPasswordOpen] = useState(false);
  const [permission, setPermission] = useState(browserNotificationState), [permissionPending, setPermissionPending] = useState(false), [permissionMessage, setPermissionMessage] = useState('');
  const profileLock = useRef(false), emailLock = useRef(false);
  useEffect(() => { setDisplayName(account?.profile.displayName || ''); setBio(account?.profile.bio || ''); }, [account?.profile.displayName, account?.profile.bio]);
  useEffect(() => { setEmail(account?.security.email || ''); }, [account?.security.email]);
  useEffect(() => { const update = () => setPermission(browserNotificationState()); window.addEventListener('focus', update); return () => window.removeEventListener('focus', update); }, []);
  useEffect(() => { if (hash && hash !== '#pet-settings') document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }); }, [hash, available]);
  const submitProfile = async (event: FormEvent) => {
    event.preventDefault(); if (profileLock.current) return; setProfileError(''); setProfileMessage('');
    if (displayName.trim().length > 30 || bio.length > 200) { setProfileError('显示名称最多 30 字符，个人简介最多 200 字符。'); return; }
    profileLock.current = true; setProfilePending(true);
    try { const result = await saveProfile(displayName, bio); store.setProfile(result.profile); setUser(previous => ({ ...previous, displayName: result.profile.displayName, profile: { ...previous.profile, bio: result.profile.bio } })); setProfileMessage('个人资料已保存。'); }
    catch (failure) { setProfileError(accountError(failure, '个人资料暂时无法保存，请重试。')); }
    finally { profileLock.current = false; setProfilePending(false); }
  };
  const submitEmail = async (event: FormEvent) => {
    event.preventDefault(); if (emailLock.current) return; setEmailError(''); setEmailMessage('');
    if (email.trim() && !new RegExp(definition.emailPattern).test(email.trim())) { setEmailError('请输入有效的邮箱地址。'); return; }
    emailLock.current = true; setEmailPending(true);
    try { const result = await saveEmail(email); store.setSecurity(result.security); setUser(previous => ({ ...previous, email: result.security.email || '' })); setEmailMessage(result.security.email ? '邮箱已保存。当前未实现邮件验证。' : '邮箱已移除。'); }
    catch (failure) { setEmailError(accountError(failure, '邮箱暂时无法保存，请重试。')); }
    finally { emailLock.current = false; setEmailPending(false); }
  };
  const toggleBrowser = async (enabled: boolean) => {
    if (permissionPending) return;
    if (!enabled) { store.updateNotifications({ browser: false }); setPermissionMessage('桌面通知已关闭。'); return; }
    setPermissionPending(true); setPermissionMessage('');
    try {
      const next = await enableBrowserNotifications(); setPermission(next); store.updateNotifications({ browser: next === 'granted' });
      setPermissionMessage(next === 'granted' ? '此浏览器已授权，偏好已启用。' : next === 'denied' ? '浏览器已拒绝通知，请在浏览器的网站权限中更改。' : next === 'unsupported' ? '当前浏览器不支持桌面通知。' : '未授予权限，桌面通知保持关闭。');
    } finally { setPermissionPending(false); }
  };
  if (!available || !account) return <ContentState loading={status === 'loading'} error={status === 'error' || (available && !account) ? new Error(preferencesError || '设置暂时不可用。') : null} onRetry={store.retry}/>;
  const timestamp = account.security.lastLoginAt && !Number.isNaN(Date.parse(account.security.lastLoginAt)) ? new Date(account.security.lastLoginAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '暂无登录记录';
  return <>
    <nav className="account-settings-nav" aria-label="设置目录">{SECTIONS.map(([id, label], index) => <Link key={id} data-pet-avoid to={`#${id}`}><span className="account-section-number">0{index + 1}</span>{label}</Link>)}</nav>
    <Section id="profile-settings" number="01" title="个人资料">
      <div className="account-avatar"><ProfilePictureUpload size="xl" showUploadButton={false}/><div><p className="font-semibold">头像</p><p className="text-sm text-muted-foreground mt-1">JPEG、PNG 或 WebP，原图不超过 5 MB。</p><button type="button" className="text-link min-h-11 text-sm" onClick={() => setAvatarOpen(true)}>更换头像</button></div></div>
      <dl className="account-identity"><div><dt>真实姓名</dt><dd data-testid="real-name">{account.profile.name}</dd></div><div><dt>学号</dt><dd>{account.profile.uniqueId}</dd></div></dl>
      <p className="text-sm text-muted-foreground mb-5">真实姓名来自班级账户信息；如需更正，请联系管理员。显示名称用于日常界面，不改变业务身份。</p>
      <form onSubmit={event => void submitProfile(event)}>
        <div className="form-field"><label htmlFor="settings-display-name">显示名称</label><input id="settings-display-name" value={displayName} placeholder={account.profile.name} maxLength={30} disabled={profilePending} onChange={e => setDisplayName(e.target.value)}/><p className="text-xs text-muted-foreground">最多 30 字符，留空时使用真实姓名。</p></div>
        <div className="form-field"><label htmlFor="settings-bio">个人简介</label><textarea id="settings-bio" rows={3} maxLength={200} value={bio} disabled={profilePending} onChange={e => setBio(e.target.value)}/><p className="text-xs text-muted-foreground">{bio.length}/200</p></div>
        <div className="account-form-footer"><button className="ed-button" disabled={profilePending}>{profilePending ? '正在保存…' : '保存资料'}</button><p role={profileError ? 'alert' : 'status'} className={profileError ? 'text-destructive' : 'text-muted-foreground'}>{profileError || profileMessage}</p></div>
      </form>
    </Section>
    <Section id="security-settings" number="02" title="账户与安全">
      <div className="account-email-state"><span className="font-semibold">邮箱</span><span className="status-label">{account.security.email ? account.security.emailVerified ? '已验证' : '未验证' : '未设置邮箱'}</span></div>
      <form onSubmit={event => void submitEmail(event)}><div className="form-field"><label htmlFor="settings-email">联系邮箱</label><input id="settings-email" type="email" autoComplete="email" maxLength={254} value={email} disabled={emailPending} onChange={e => setEmail(e.target.value)} placeholder="未设置邮箱"/><p className="text-xs text-muted-foreground">仅自己和有权限的管理员可见。当前未实现邮件验证，邮箱不作为登录凭据。</p></div><div className="account-form-footer"><button className="ed-button secondary" disabled={emailPending}>{emailPending ? '正在保存…' : '保存邮箱'}</button><p role={emailError ? 'alert' : 'status'} className={emailError ? 'text-destructive' : 'text-muted-foreground'}>{emailError || emailMessage}</p></div></form>
      <div className="account-security-item mt-6"><h3 className="font-semibold">密码</h3><p className="text-sm text-muted-foreground my-3">建议使用安全且唯一的密码。修改后所有设备需重新登录。</p><button type="button" className="ed-button secondary" onClick={() => setPasswordOpen(true)}>修改密码</button></div>
      <div className="account-security-item"><h3 className="font-semibold">上次登录</h3><p className="text-sm mt-2"><time dateTime={account.security.lastLoginAt || undefined}>{timestamp}</time></p></div>
    </Section>
    <Section id="notification-settings" number="03" title="通知设置">
      {NOTIFICATIONS.map(([key, label, description]) => <div className="account-notification-row" key={key}><div><label htmlFor={`notify-${key}`}>{label}</label><p>{description}</p></div><Switch id={`notify-${key}`} checked={notifications[key]} onCheckedChange={value => store.updateNotifications({ [key]: value })}/></div>)}
      <div className="account-notification-row"><div><label htmlFor="notify-browser">浏览器桌面通知</label><p>{permission === 'unsupported' ? '当前浏览器不支持桌面通知。' : permission === 'denied' ? '浏览器已拒绝通知，请在网站权限中更改。' : notifications.browser && permission !== 'granted' ? '此设备尚未授权；点击开关申请权限。' : '开启时才申请此浏览器的通知权限。'}</p></div><Switch id="notify-browser" checked={notifications.browser && permission === 'granted'} disabled={permission === 'unsupported' || permissionPending} onCheckedChange={value => void toggleBrowser(value)}/></div>
      <p role="status" className="text-sm text-muted-foreground mt-3">{permissionMessage}</p>
      <p role={preferencesError ? 'alert' : 'status'} className={`text-sm mt-3 ${preferencesError ? 'text-destructive' : 'text-muted-foreground'}`}>{preferencesError || (status === 'saving' ? '正在保存偏好…' : '偏好已同步到账号。')}{preferencesError && <button type="button" className="text-link min-h-11 ml-3" onClick={store.retry}>重试保存</button>}</p>
      <Link to="/notifications" className="text-link inline-flex items-center min-h-11 mt-2">打开通知中心 →</Link>
    </Section>
    <Section id="appearance-settings" number="04" title="外观"><div className="account-notification-row"><div><label htmlFor="theme-toggle">深色模式</label><p>切换浅色或深色界面，选择更舒服的阅读方式。</p></div><Switch id="theme-toggle" checked={isDarkMode} onCheckedChange={toggleDarkMode}/></div></Section>
    <PetSettings sectionNumber="05"/>
    <Section id="account-actions" number="06" title="账户操作"><p className="text-sm text-muted-foreground mb-4">退出此浏览器的当前账号，个人资料和偏好将保留。</p><button type="button" className="ed-button secondary" onClick={logout}>退出当前账号</button><div className="mt-4"><Link to="/saved-posts" className="text-link inline-flex min-h-11 items-center">我的收藏 →</Link></div></Section>
    <AvatarManagementModal isOpen={avatarOpen} onClose={() => setAvatarOpen(false)} onSaved={profile => { store.setProfile(profile); setProfileMessage('头像已更新。'); }}/>
    <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} store={store}/>
  </>;
}
export default function SettingsPage({ onBack }: { onBack?: () => void }) {
  const { store } = usePet();
  return <PageShell className="settings-workspace">{onBack && <button className="back-link" onClick={onBack}>返回个人资料</button>}<PageHeading title="个人设置" description="让这个班级空间，更符合你的使用习惯。"/>{store ? <AccountSettings key={store.userId} store={store}/> : <ContentState loading/>}</PageShell>;
}
