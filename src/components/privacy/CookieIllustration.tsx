import { useId } from 'react';

/** ClassHub original artwork, using the same soft shapes as the homepage illustrations. */
export default function CookieIllustration() {
  const id = `cookie-${useId().replace(/:/g, '')}`;

  return (
    <svg className="cookie-consent__illustration" width="132" height="116" viewBox="0 0 160 140" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-paper`} x1="81" y1="25" x2="130" y2="109" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DDE7FF" /><stop offset=".55" stopColor="#A2BDFE" /><stop offset="1" stopColor="#849CEB" />
        </linearGradient>
        <linearGradient id={`${id}-biscuit`} x1="30" y1="43" x2="89" y2="107" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFDFB1" /><stop offset=".5" stopColor="#F8C98F" /><stop offset="1" stopColor="#E5AD76" />
        </linearGradient>
        <linearGradient id={`${id}-seal`} x1="92" y1="77" x2="120" y2="109" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9FBAFF" /><stop offset=".6" stopColor="#6899ED" /><stop offset="1" stopColor="#447BCC" />
        </linearGradient>
        <filter id={`${id}-shadow`}><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <ellipse cx="82" cy="126" rx="50" ry="5" fill="#6E7BC1" opacity=".13" filter={`url(#${id}-shadow)`} />
      <path d="M88 20 133 34Q138 36 136 43L118 109Q116 115 110 113L68 101Q62 99 64 92L81 26Q83 19 88 20Z" fill={`url(#${id}-paper)`} />
      <path d="m91 30 31 10M88 41l23 7" stroke="#EFF4FF" strokeWidth="4" strokeLinecap="round" opacity=".8" />
      <path d="m126 53-5 19-10-9-12 3 6-20" fill="#9098E3" opacity=".65" />
      <path d="M95 83C93 107 71 120 48 112 25 104 15 83 24 61 30 47 41 39 54 40 56 49 63 53 71 50 73 60 81 65 90 62 94 68 97 75 95 83Z" fill="#CE9566" />
      <path d="M91 78C90 101 69 115 47 107 26 100 18 80 26 60 32 47 42 39 54 40 56 49 63 53 71 50 73 60 80 65 90 62 93 67 94 73 91 78Z" fill={`url(#${id}-biscuit)`} />
      <path d="M31 70Q32 55 46 48" stroke="#FFF0D3" strokeWidth="4" strokeLinecap="round" opacity=".8" />
      <path d="m42 64 6-2 4 6-4 5-6-3ZM64 81l6-5 6 5-2 7-7 1ZM38 87l5-4 6 3-2 6-6 1Z" fill="#A47E67" />
      <circle cx="61" cy="60" r="2" fill="#B29171" /><circle cx="56" cy="97" r="2" fill="#B29171" />
      <circle cx="82" cy="71" r="2" fill="#B29171" /><circle cx="29" cy="78" r="1.8" fill="#B29171" />
      <circle cx="108" cy="95" r="20" fill={`url(#${id}-seal)`} />
      <path d="M95 86Q98 79 107 79" stroke="#D8E8FF" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <path d="m100 95 5 5 11-12" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m142 78-4 3m1-12 3 2" stroke="#C3B4EF" strokeWidth="3" strokeLinecap="round" />
      <circle cx="38" cy="27" r="4" fill="#F5C8C8" /><circle cx="54" cy="21" r="2" fill="#B2C7FA" />
    </svg>
  );
}
