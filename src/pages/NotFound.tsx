import { useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useGlobalSearch } from '../context/searchContextState';
import astronaut from '../assets/404-astronaut.webp';
import './not-found.css';

export default function NotFound() {
  const openSearch = useGlobalSearch();

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousPage = root.getAttribute('data-classhub-page');
    root.setAttribute('data-classhub-page', 'not-found');
    return () => {
      if (previousPage) root.setAttribute('data-classhub-page', previousPage);
      else root.removeAttribute('data-classhub-page');
    };
  }, []);

  return <section className="not-found-page" aria-labelledby="not-found-title">
    <div className="not-found-copy">
      <div className="not-found-number" aria-hidden="true">
        <span>4</span>
        <span className="not-found-zero">0<i /><i /></span>
        <span>4</span>
        <b className="not-found-spark not-found-spark--one">✦</b>
        <b className="not-found-spark not-found-spark--two">✦</b>
        <b className="not-found-spark not-found-spark--three">·</b>
      </div>
      <h1 id="not-found-title" aria-label="404 — Page Not Found">Page Not Found</h1>
      <p className="not-found-description">
        <span>抱歉，你访问的页面不存在。</span>
        可能是链接错误、页面已被删除，<wbr />或者它正在去更远的地方探索了。
      </p>
      <div className="not-found-actions">
        <Button asChild className="not-found-button not-found-button--home">
          <Link to="/"><Home aria-hidden="true" />返回首页</Link>
        </Button>
        <Button variant="outline" className="not-found-button not-found-button--search" onClick={openSearch}>
          <Search aria-hidden="true" />搜索内容
        </Button>
      </div>
    </div>

    <div className="not-found-studio" aria-hidden="true">
      <div className="not-found-code">
        <div className="not-found-code-title"><span className="not-found-file-dot" />404.js</div>
        <pre><code><span className="not-found-keyword">const</span> <span className="not-found-variable">page</span> = null;{'\n\n'}
          <span className="not-found-keyword">if</span> (!page) {'{'}{'\n'}
          {'  '}<span className="not-found-keyword">throw</span> new Error({'\n'}
          {'    '}<span className="not-found-string">'Page not found'</span>{'\n'}
          {'  '});{'\n'}
          {'}'}
        </code></pre>
      </div>
      <img className="not-found-astronaut" src={astronaut} width="640" height="542" alt="" />
      <div className="not-found-terminal">
        <p>// Next step?</p>
        <ul>
          <li>&gt; <span>Back to home</span></li>
          <li>&gt; Search</li>
          <li>&gt; Explore</li>
          <li>&gt; Keep learning...</li>
        </ul>
      </div>
    </div>
  </section>;
}
