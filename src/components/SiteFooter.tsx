import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';

const PROJECT_URL = 'https://github.com/Mason1035/uniclub-main';

export default function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-container footer-inner">
      <div className="footer-identity">
        <Link className="footer-logo" to="/" aria-label="ClassHub home">
          <img src="/branding/classhub-icon-192-v2.png" width={28} height={28} alt="" loading="lazy" decoding="async" />
        </Link>
        <p className="footer-credit"><span>2026 ClassHub</span>{' '}<span>四川师范大学·2025级·软件工程3班</span></p>
      </div>
      <nav className="footer-links" aria-label="Footer navigation" lang="en">
        <Link to="/privacy">Privacy</Link>
        <Link to="/privacy#cookies">Cookies</Link>
        <a href={`${PROJECT_URL}#readme`} target="_blank" rel="noopener noreferrer">Docs</a>
        <a href={PROJECT_URL} target="_blank" rel="noopener noreferrer"><Github size={14} strokeWidth={1.7} aria-hidden="true" />Source code</a>
      </nav>
    </div>
  </footer>;
}
