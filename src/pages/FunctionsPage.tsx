import { Link } from 'react-router-dom';
import { ArrowUpRight, Archive, Wallet } from 'lucide-react';
import PageHeading from '../components/PageHeading';
import PageShell from '../components/PageShell';
import ContentCard from '../components/ContentCard';
import Illustration from '../components/Illustration';

export default function FunctionsPage() {
  return <PageShell className="functions-page editorial-titles">
    <PageHeading tone="editorial" title="功能" description="材料提交与班级事务，在这里办理。"/>
    <div className="feature-grid">
      <ContentCard className="feature-card" aria-labelledby="materials-title">
        <Illustration kind="resource" size="large"/>
        <div data-pet-avoid><h2 id="materials-title">上传量化文件</h2><p>按收集期提交 ZIP 材料，查看提交结果，截止前可以重新提交。</p></div>
        <Link className="ed-button" to="/quantification"><Archive aria-hidden="true" size={18}/>进入材料提交<ArrowUpRight aria-hidden="true" size={18}/></Link>
      </ContentCard>
      <ContentCard className="feature-card" aria-labelledby="class-fees-title">
        <Illustration kind="fees" size="large"/>
        <div data-pet-avoid><h2 id="class-fees-title">交班费</h2><p>查看班费付款二维码，完成付款后提交支付成功截图，由管理员确认到账。</p></div>
        <Link className="ed-button" to="/fees"><Wallet aria-hidden="true" size={18}/>进入班费缴纳<ArrowUpRight aria-hidden="true" size={18}/></Link>
      </ContentCard>
    </div>
  </PageShell>;
}
