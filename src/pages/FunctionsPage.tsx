import { Link } from 'react-router-dom';
import { ArrowUpRight, Archive, Wallet } from 'lucide-react';
import PageHeading from '../components/PageHeading';
import '../styles/quantification.css';

export default function FunctionsPage() {
  return <div className="quant-page"><PageHeading title="功能" description="材料提交与班级事务，在这里办理。"/><div className="function-directory">
    <section className="function-entry"><span className="function-number" aria-hidden="true">01</span><div><p className="eyebrow">材料收集</p><h2>上传量化文件</h2><p>按收集期提交 ZIP 材料，查看提交结果，截止前可以重新提交。</p><Link className="ed-button" to="/quantification"><Archive aria-hidden="true" size={18}/>进入材料提交<ArrowUpRight aria-hidden="true" size={18}/></Link></div></section>
    <section className="function-entry" aria-labelledby="class-fees-title"><span className="function-number" aria-hidden="true">02</span><div><p className="eyebrow">班级事务</p><h2 id="class-fees-title">交班费</h2><p>查看班费付款二维码，完成付款后提交支付成功截图，由管理员确认到账。</p><Link className="ed-button" to="/fees"><Wallet aria-hidden="true" size={18}/>进入班费缴纳<ArrowUpRight aria-hidden="true" size={18}/></Link></div></section>
  </div></div>;
}
