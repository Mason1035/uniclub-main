import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PageShell from '../components/PageShell';
import PageHeading from '../components/PageHeading';
import './privacy.css';

export default function PrivacyPage() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#cookies') document.getElementById('cookies')?.scrollIntoView({ block: 'start' });
  }, [hash]);
  return <PageShell className="reading-page privacy-page">
    <PageHeading title="隐私与网站存储" description="了解 ClassHub 保存什么，以及哪些用途由你选择。"/>
    <div className="reading-body">
      <section><h2>关于 ClassHub</h2><p>ClassHub 是软件工程班级信息平台，用于班级通知、活动、资料与日常分享。首页和本说明可直接浏览；成员页面与操作需要登录，后台还需要管理员权限。</p></section>
      <section id="cookies"><h2>账号与必要存储</h2><p>登录后，浏览器保存登录令牌和基本账号资料，用来识别当前账号、发送经过认证的请求。退出登录会清除这些会话信息。服务器按现有规则校验令牌有效期和访问权限。</p><p>当前网站主要使用 localStorage 和 sessionStorage，而不是登录 Cookie。你的存储选择本身也保存在浏览器，不含密码或 API Key。必要存储始终启用；它不会授权可选统计。</p></section>
      <section><h2>你可以选择的用途</h2><ul>
        <li><strong>偏好：</strong>在浏览器中记住头像缓存、列表筛选与视图、返回页面的位置、当前账号的桌宠位置。关闭后仍可操作这些功能，但不把这些偏好写入浏览器持久存储。账号中的个人设置继续按原有功能保存。</li>
        <li><strong>资源使用统计：</strong>允许资源打开、预览与下载操作提交统计记录。现有统计关联登录账号，记录资源与操作时间，用于汇总次数；它不是匿名统计。关闭后仍可访问资源，也不会新增这些统计请求。</li>
      </ul><p>当前应用没有接入 Google Analytics、广告或营销追踪 SDK。选择“仅必要”会关闭上述两类可选用途，并清除已有的可选浏览器缓存；不会删除账号或已有的服务器业务记录。</p></section>
      <section><h2>第三方服务与内容</h2><p>成员使用文件上传与下载时可能连接腾讯云 COS；内容图片和 YouTube 缩略图可能来自外部地址；管理员主动使用 AI 功能时，输入会发送给所配置的 AI 服务。这些服务会接收完成请求所需的数据，外部站点有自己的隐私规则。网站字体由本站提供。</p></section>
      <section><h2>保存与调整</h2><p>localStorage 通常保留到你清除本站数据，sessionStorage 在对应浏览器会话结束后清除。桌面端可随时通过左下角“Cookie 设置”重新选择；移动端没有此浮层，可选偏好和统计在没有同意记录时保持关闭。</p><p>服务器中的账号、已发布内容和业务记录按现有功能保存。本轮未新增聊天历史或其他数据收集。需要处理账号、内容或已有记录，请通过班级管理员联系网站维护者。</p></section>
      <Link className="text-link inline-flex min-h-11 items-center" to="/">返回公开首页 →</Link>
    </div>
  </PageShell>;
}
