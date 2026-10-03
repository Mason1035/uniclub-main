export default function RisoArtwork() {
  return (
    <svg className="riso-art" viewBox="0 0 360 330" aria-hidden="true">
      <path className="rule" d="M18 14h324v300H18z" fill="none"/>
      <g data-riso-layer="yellow">
        <path className="ink-yellow" d="M68 57h201v211H68z" transform="rotate(-8 169 163)"/>
      </g>
      <g data-riso-layer="cyan">
        <path className="ink-cyan" d="M97 40h194v216H97z" transform="rotate(6 194 148)"/>
      </g>
      <g data-riso-layer="paper">
        <path className="paper" d="M102 63h146l35 38v179H102z"/>
      </g>
      <g data-riso-layer="magenta">
        <path className="ink-magenta" d="M248 63v38h35z"/>
        <path className="ink-cyan" d="M123 117h124v9H123zm0 25h104v9H123zm0 25h117v9H123z"/>
        <path className="ink-magenta" d="M120 200h106v42H120z" opacity=".9"/>
        <path className="ink-yellow" d="M165 217h95v39h-95z" opacity=".9"/>
      </g>
      <path className="rule" d="M27 32h18m-9-9v18m270 255h18m-9-9v18" fill="none" strokeWidth="1"/>
    </svg>
  );
}
