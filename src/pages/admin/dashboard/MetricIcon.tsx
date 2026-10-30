import { useId } from 'react';
export default function MetricIcon({ kind }: { kind: 'users' | 'events' | 'news' | 'resources' }) {
  const id = useId().replace(/:/g, '');
  const palette = { users: ['#e5fff0','#72d79a','#39aa6c'], events: ['#fff5bd','#ffda53','#e6a824'], news: ['#d6eaff','#75b3ff','#4284e6'], resources: ['#ffe2e0','#ff9394','#ee606a'] }[kind];
  const fill = `url(#${id}-front)`, light = `url(#${id}-light)`;
  return <svg className="ch-metric__icon" viewBox="0 0 144 144" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-front`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={palette[0]}/><stop offset=".4" stopColor={palette[1]}/><stop offset="1" stopColor={palette[2]}/></linearGradient>
      <linearGradient id={`${id}-light`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor={palette[0]}/></linearGradient>
      <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="1" dy="8" stdDeviation="5" floodColor={palette[2]} floodOpacity=".25"/></filter>
    </defs>
    <ellipse cx="74" cy="124" rx="47" ry="7" fill={palette[2]} opacity=".1"/>
    <g className="ch-metric__object" filter={`url(#${id}-shadow)`}>
      {kind === 'users' && <>
        <g fill={light}><path d="M17 97C17 69 51 68 51 97V112C40 117 25 117 17 112Z"/><circle cx="34" cy="61" r="15"/><path d="M96 97C96 69 130 68 130 97V112C119 117 104 117 96 112Z"/><circle cx="113" cy="61" r="15"/></g>
        <path d="M43 104C43 65 102 65 102 104V121C84 130 60 130 43 121Z" fill={fill}/><circle cx="73" cy="47" r="24" fill={fill}/>
        <path d="M57 39C61 28 76 25 84 31" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".5"/>
      </>}
      {kind === 'events' && <g transform="rotate(10 72 72)">
        <rect x="35" y="37" width="87" height="91" rx="15" fill={palette[2]}/><rect x="28" y="29" width="87" height="94" rx="14" fill={fill}/>
        <rect x="33" y="50" width="76" height="66" rx="10" fill={light}/><rect x="44" y="18" width="12" height="30" rx="6" fill={fill}/><rect x="86" y="18" width="12" height="30" rx="6" fill={fill}/>
        {[0,1,2].flatMap(row=>[0,1,2].map(col=><rect key={`${row}-${col}`} x={45+col*21} y={64+row*17} width="11" height="11" rx="3" fill={fill}/>))}
        <path d="M39 36H101" stroke="#fff" strokeWidth="2" opacity=".4"/>
      </g>}
      {kind === 'news' && <g transform="rotate(10 72 72)">
        <rect x="48" y="24" width="70" height="104" rx="14" fill={palette[2]}/><rect x="40" y="19" width="70" height="104" rx="14" fill={fill}/><rect x="29" y="27" width="70" height="96" rx="13" fill={fill}/>
        <path d="M40 35H86" stroke="#fff" opacity=".5" strokeWidth="3" strokeLinecap="round"/>
        <rect x="43" y="47" width="43" height="14" rx="4" fill={palette[2]}/><rect x="43" y="72" width="43" height="7" rx="3" fill={palette[2]}/><rect x="43" y="87" width="32" height="7" rx="3" fill={palette[2]}/><rect x="43" y="102" width="36" height="6" rx="3" fill={palette[0]} opacity=".8"/>
      </g>}
      {kind === 'resources' && <g transform="rotate(7 72 72)">
        <path d="M22 46Q22 36 33 36H57L68 45H119Q128 45 128 56V111Q128 123 117 123H34Q22 123 22 111Z" fill={palette[2]}/>
        <rect x="46" y="21" width="63" height="86" rx="8" fill={light}/><path d="M56 38H94M56 52H94" stroke={palette[1]} strokeWidth="5" strokeLinecap="round"/>
        <rect x="55" y="40" width="61" height="72" rx="7" fill={light}/><path d="M66 53H103" stroke={palette[1]} strokeWidth="5" strokeLinecap="round"/>
        <path d="M20 71Q18 59 30 59H59L69 70H121Q131 70 128 82L119 119Q118 127 107 127H36Q25 126 24 116Z" fill={fill}/><path d="M29 66H54" stroke="#fff" strokeWidth="3" opacity=".6" strokeLinecap="round"/>
      </g>}
    </g>
  </svg>;
}
