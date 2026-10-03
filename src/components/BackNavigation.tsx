import { useNavigate,useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { createNavigationState } from '../utils/navigationUtils';
interface BackNavigationProps {referrer?:string;contentType?:string;fallbackReferrer?:string;className?:string;sticky?:boolean;showBorder?:boolean;onClick?:()=>void;}
export default function BackNavigation({referrer,contentType,fallbackReferrer,className='',onClick}:BackNavigationProps) {
  const navigate=useNavigate();const location=useLocation();const state=createNavigationState(referrer,contentType,fallbackReferrer);
  return <button className={`back-link ${className}`} onClick={()=>{if(onClick)onClick();else if(location.key!=='default'&&Number(window.history.state?.idx)>0)navigate(-1);else navigate(state.referrer);}}><ArrowLeft size={18}/>{state.breadcrumb}</button>;
}
export function InlineBackNavigation(props:BackNavigationProps&{size?:'sm'|'md'|'lg'}) {return <BackNavigation {...props}/>;}
