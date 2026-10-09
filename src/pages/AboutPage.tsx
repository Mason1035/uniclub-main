import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import PageHeading from '../components/PageHeading';
import './privacy.css';

const PROJECT_URL = 'https://github.com/Mason1035/uniclub-main';

/** Public product information only; never requests or renders member records. */
export default function AboutPage() {
  return <PageShell className="reading-page privacy-page">
    <PageHeading title="关于 ClassHub" description="把班级消息、学习资料与日常事务，放在同一个地方。"/>
    <div className="reading-body">
      <section>
        <h2>ClassHub 是什么？</h2>
        <p>ClassHub 是面向四川师范大学 2025 级软件工程 3 班的班级信息平台。它把通知、新闻、活动、资源与成员交流集中起来，方便同学查找信息、参与活动和处理班级事务。</p>
        <p>首页、项目介绍和隐私说明可以直接浏览。班级具体内容和操作需要成员登录；管理后台仅向经过身份验证的管理员开放。</p>
      </section>
      <section>
        <h2>可以用它做什么？</h2>
        <ul>
          <li><strong>查公告与读新闻：</strong>查看班级通知和新闻，围绕当前新闻向 AI 提问，帮助理解正文与背景。</li>
          <li><strong>参与活动与保存回忆：</strong>查看活动安排、参与方式和往期活动记录。</li>
          <li><strong>共享学习资源：</strong>查找班级共享的资料、文件和资源链接。</li>
          <li><strong>交流与查找：</strong>发布班级动态、参与讨论，通过站内搜索查找有权访问的内容。</li>
          <li><strong>办理班级事务：</strong>按收集期提交量化材料，提交班费支付凭证，以及从有效班级成员中随机点名。</li>
          <li><strong>管理与 AI 辅助：</strong>管理员管理班级内容和事务，使用 AI 助手整理发布草稿、生成每日新闻。</li>
        </ul>
        <p>AI 回答与生成内容需要核实。实际可用内容取决于班级已发布的信息、账号权限和相关服务状态。</p>
      </section>
      <section>
        <h2>适合什么场景？</h2>
        <p>同学可以集中查看班级消息、查找学习资料、分享日常和提交材料；班级管理员可以维护通知、活动、资源与事务记录。ClassHub 当前服务于本班级，这些班级功能需要登录使用。</p>
      </section>
      <section>
        <h2>如何开始使用？</h2>
        <p>先浏览首页，再使用班级管理员开通的账号登录。登录后，从顶部导航进入公告、新闻、活动、资源、班级动态或功能页面。账号或访问权限有问题时，请联系班级管理员。</p>
        <p>“功能”页面提供材料提交、班费缴纳与随机点名入口。AI 新闻问答位于新闻详情页，管理类 AI 功能位于管理员后台。</p>
        <Link className="text-link inline-flex min-h-11 items-center" to="/auth">登录 ClassHub →</Link>
      </section>
      <section>
        <h2>关于开发者</h2>

        <p>
          项目公开代码仓库由 GitHub: Mason1035 等账号维护，
          参与构建、运维的成员包括{' '}

          <a
              href="mqqapi://card/show_pslcard?src_type=internal&version=1&uin=1942526314&card_type=person&source=qrcode"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link no-underline"
          >
            何宇轩
          </a>
          、{' '}

          <a
              href="mqqapi://card/show_pslcard?src_type=internal&version=1&uin=3057143042&card_type=person&source=qrcode"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link no-underline"
          >
            李青原
          </a>
          、{' '}

          <a
              href="mqqapi://card/show_pslcard?src_type=internal&version=1&uin=1405937768&card_type=person&source=qrcode"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link no-underline"
          >
            张鹏飞
          </a>
          。

          项目代码与使用文档可以在仓库中查看；
          仓库信息不代表学校官方组织身份。
          该网站已申请软件著作权并完成 ICP 备案。
        </p>

        <a
            className="text-link inline-flex min-h-11 items-center"
            href={PROJECT_URL}
            target="_blank"
            rel="noopener noreferrer"
        >
          查看项目仓库与文档 →
        </a>
      </section>
      <section>
        <h2>内容与隐私</h2>
        <p>本介绍只说明产品用途，不展示成员个人资料、内部公告、缴费记录或其他班级私有数据。登录、浏览器存储与第三方服务的具体说明，请查看<Link className="text-link" to="/privacy">隐私与网站存储</Link>。</p>
      </section>
      <Link className="text-link inline-flex min-h-11 items-center" to="/">返回公开首页 →</Link>
    </div>
  </PageShell>;
}
