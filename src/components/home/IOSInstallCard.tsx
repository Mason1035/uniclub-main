import { useEffect, useRef, useState } from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { ArrowRight, Share, SquarePlus, X } from 'lucide-react';
import { Sheet, SheetClose, SheetDescription, SheetPortal, SheetTitle, SheetTrigger } from '../ui/sheet';
import { useIOSInstallState } from '../../hooks/useIOSInstallState';
import './ios-install.css';

const APP_ICON = '/branding/classhub-apple-touch-v2.png';

function IOSInstallGuide() {
  const close = useRef<HTMLButtonElement>(null);
  return <SheetPortal>
    <SheetPrimitive.Overlay className="ios-install-backdrop"/>
    <SheetPrimitive.Content className="ios-install-guide" onOpenAutoFocus={event => {
      event.preventDefault();
      close.current?.focus({ preventScroll: true });
    }}>
      <SheetClose ref={close} className="ios-install-close" aria-label="关闭添加到主屏幕引导">
        <X size={20} strokeWidth={1.7} aria-hidden="true"/>
      </SheetClose>
      <img className="ios-install-guide__icon" src={APP_ICON} width={64} height={64} alt=""/>
      <SheetTitle className="ios-install-guide__title">把 ClassHub 放到主屏幕</SheetTitle>
      <SheetDescription className="ios-install-guide__description">像 App 一样快速打开，获得更好的体验。</SheetDescription>
      <ol className="ios-install-steps" aria-label="在 Safari 中添加到主屏幕的三个步骤">
        <li>
          <div className="ios-install-step__icon"><Share size={32} strokeWidth={1.6} aria-hidden="true"/></div>
          <span className="ios-install-step__number" aria-hidden="true">1</span>
          <p>点击分享按钮</p>
        </li>
        <li>
          <div className="ios-install-step__icon"><SquarePlus size={32} strokeWidth={1.6} aria-hidden="true"/></div>
          <span className="ios-install-step__number" aria-hidden="true">2</span>
          <p>选择<br/>「添加到主屏幕」</p>
        </li>
        <li>
          <div className="ios-install-step__icon"><img src={APP_ICON} width={48} height={48} alt=""/></div>
          <span className="ios-install-step__number" aria-hidden="true">3</span>
          <p>点击右上角<br/>「添加」</p>
        </li>
      </ol>
      <p className="ios-install-guide__hint">分享按钮在 Safari 工具栏；部分版本请先打开「更多」。这是操作指引，需在 Safari 中完成添加。</p>
      <SheetClose className="ios-install-done">我知道了</SheetClose>
    </SheetPrimitive.Content>
  </SheetPortal>;
}

export default function IOSInstallCard() {
  const eligible = useIOSInstallState();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!eligible) setOpen(false); }, [eligible]);
  // Return no DOM or grid item on desktop, Android, iPad or Home Screen mode.
  if (!eligible) return null;
  return <Sheet open={open} onOpenChange={setOpen}>
    <section className="ios-install-card" aria-labelledby="ios-install-card-title">
      <img className="ios-install-card__icon" src={APP_ICON} width={56} height={56} alt="" loading="lazy" decoding="async"/>
      <div className="ios-install-card__copy">
        <h2 id="ios-install-card-title">添加应用到 iPhone？</h2>
        <p>把 ClassHub 放到主屏幕，像 App 一样快速打开。</p>
      </div>
      <SheetTrigger className="ios-install-card__action">是<ArrowRight size={18} aria-hidden="true"/></SheetTrigger>
    </section>
    <IOSInstallGuide/>
  </Sheet>;
}
