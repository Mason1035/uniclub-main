import { Link } from 'react-router-dom';
export default function NotFound() {return <div className="reading-page py-12"><p className="font-mono text-primary mb-4">404</p><h1 className="text-4xl font-black mb-5">这个页面暂时找不到</h1><p className="text-muted-foreground mb-6">链接可能已变更，请从首页或搜索找到需要的内容。</p><Link className="ed-button" to="/">返回首页</Link></div>;}
