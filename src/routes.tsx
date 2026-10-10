import { Suspense, useLayoutEffect, type ReactNode } from 'react';
import { useRoutes } from 'react-router-dom';
import ContentState from './components/ContentState';
import { appRouteConfig } from './routeConfig';
import { ROUTE_READY } from './lib/preloader';

function InitialRouteReady({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-classhub-route-ready', '');
    window.dispatchEvent(new Event(ROUTE_READY));
  }, []);
  return <>{children}</>;
}

export default function AppRoutes() {
  const routes = useRoutes(appRouteConfig);
  return <Suspense fallback={<div className="py-8"><ContentState loading /></div>}><InitialRouteReady>{routes}</InitialRouteReady></Suspense>;
}
