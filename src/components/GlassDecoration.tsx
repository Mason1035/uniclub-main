/** Shared original Snell lens, Fresnel lip and bounded reflection layers. */
export default function GlassDecoration({ lensId, optics = true }: { lensId: string; optics?: boolean }) {
  return <>
      {optics && <svg className="home-card__lens-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id={lensId} className="home-card__lens-filter" x="0" y="0" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage x="0" y="0" preserveAspectRatio="none" result="lens"/>
            <feComponentTransfer in="lens" result="normals">
              <feFuncR type="linear" slope={255 / 256}/>
              <feFuncG type="linear" slope={255 / 256}/>
            </feComponentTransfer>
            <feDisplacementMap in="SourceGraphic" in2="normals" scale="0" xChannelSelector="R" yChannelSelector="G" result="red-sample"/>
            <feColorMatrix in="red-sample" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
            <feDisplacementMap in="SourceGraphic" in2="normals" scale="0" xChannelSelector="R" yChannelSelector="G" result="green-sample"/>
            <feColorMatrix in="green-sample" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
            <feDisplacementMap in="SourceGraphic" in2="normals" scale="0" xChannelSelector="R" yChannelSelector="G" result="blue-sample"/>
            <feColorMatrix in="blue-sample" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
            <feBlend in="red" in2="green" mode="screen" result="red-green"/>
            <feBlend in="red-green" in2="blue" mode="screen"/>
            <feGaussianBlur stdDeviation=".25"/>
          </filter>
          <filter id={`${lensId}-motion`} className="home-card__lens-motion-filter" x="0" y="0" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage x="0" y="0" preserveAspectRatio="none" result="lens"/>
            <feComponentTransfer in="lens" result="normals">
              <feFuncR type="linear" slope={255 / 256}/>
              <feFuncG type="linear" slope={255 / 256}/>
            </feComponentTransfer>
            <feDisplacementMap in="SourceGraphic" in2="normals" scale="0" xChannelSelector="R" yChannelSelector="G"/>
            <feGaussianBlur stdDeviation=".25"/>
          </filter>
        </defs>
      </svg>}
      <span className="glass-decoration home-card__glass-fresnel" aria-hidden="true"/>
      <span className="glass-decoration home-card__glass-surface" aria-hidden="true"><span className="glass-decoration home-card__glass-sheen"/></span>
      <span className="glass-decoration home-card__glass" aria-hidden="true"><span className="glass-decoration home-card__glass-light"/></span>
  </>;
}
