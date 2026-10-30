/** ClassHub's thin-lens approximation, independently implemented from geometric optics.
 * Snell/Fresnel reference: https://pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission
 * This traces the curved entry surface and a finite slab, not Apple's native material. */
export function traceGlassRay(slope: number, thickness: number, ior = 1.5) {
  const cosIncident = 1 / Math.hypot(1, slope);
  const sinIncident = slope * cosIncident;
  const sinTransmitted = sinIncident / ior;
  const cosTransmitted = Math.sqrt(1 - sinTransmitted ** 2);
  const sinBend = sinIncident * cosTransmitted - cosIncident * sinTransmitted;
  const cosBend = cosIncident * cosTransmitted + sinIncident * sinTransmitted;
  const rs = (cosIncident - ior * cosTransmitted) / (cosIncident + ior * cosTransmitted);
  const rp = (ior * cosIncident - cosTransmitted) / (ior * cosIncident + cosTransmitted);
  return {
    // feDisplacementMap samples input(p + offset): a convex lip samples inward.
    offset: -thickness * sinBend / cosBend,
    reflection: (rs ** 2 + rp ** 2) / 2,
    cosIncident,
  };
}

export function sampleGlassEdge(x: number, y: number, width: number, height: number, radius: number, continuous: boolean) {
  const px = x - width / 2;
  const py = y - height / 2;
  const qx = Math.abs(px) - (width / 2 - radius);
  const qy = Math.abs(py) - (height / 2 - radius);
  if (qx > 0 && qy > 0) {
    const length = continuous ? Math.pow(qx ** 4 + qy ** 4, .25) : Math.hypot(qx, qy);
    const gx = continuous ? (qx / length) ** 3 : qx / length;
    const gy = continuous ? (qy / length) ** 3 : qy / length;
    const gradient = Math.hypot(gx, gy);
    return { depth: (radius - length) / gradient, nx: Math.sign(px) * gx / gradient, ny: Math.sign(py) * gy / gradient };
  }
  return {
    depth: radius - Math.max(qx, qy),
    nx: qx > qy ? Math.sign(px) : 0,
    ny: qx > qy ? 0 : Math.sign(py),
  };
}

export function glassMapSize(width: number, height: number) {
  const resolution = Math.min(1, 1024 / width, 512 / height, Math.sqrt(262144 / (width * height)));
  return { width: Math.max(1, Math.floor(width * resolution)), height: Math.max(1, Math.floor(height * resolution)) };
}

/** Geometry is rasterized once per size; expensive optics live in a 256-sample LUT. */
export function createGlassField(width: number, height: number, radius: number, continuous: boolean) {
  const mapSize = glassMapSize(width, height);
  const r = Math.min(radius, width / 2, height / 2);
  const bezel = Math.min(28, r * .7, height * .13);
  const thickness = 38;
  const ior = 1.5;
  const f0 = ((ior - 1) / (ior + 1)) ** 2;
  const bend = new Float32Array(256);
  const reflection = new Float32Array(256);
  let maximum = 0;
  for (let i = 1; i < 256; i++) {
    const t = i / 255;
    const u = 1 - t;
    // A convex quarter-ellipse cross-section: steep lip, smoothly flat interior.
    const heightProfile = Math.sqrt(1 - u ** 2);
    const slope = .9 * u / Math.max(heightProfile, .0001);
    const ray = traceGlassRay(slope, thickness, ior);
    const edgeFade = Math.min(1, t * bezel / 1.25);
    // The grazing surface is reflective rather than an infinitely strong lens.
    bend[i] = ray.offset * (1 - ray.reflection) * edgeFade;
    reflection[i] = Math.max(0, (ray.reflection - f0) / (1 - f0));
    maximum = Math.max(maximum, Math.abs(bend[i]));
  }
  // Leave quantization headroom; neutral byte 128 is made exactly .5 in the SVG.
  const range = maximum * 1.04;
  const displacement = new Uint8ClampedArray(mapSize.width * mapSize.height * 4);
  const fresnel = new Uint8ClampedArray(displacement.length);
  for (let y = 0; y < mapSize.height; y++) {
    for (let x = 0; x < mapSize.width; x++) {
      const edge = sampleGlassEdge((x + .5) / mapSize.width * width, (y + .5) / mapSize.height * height, width, height, r, continuous);
      const i = (y * mapSize.width + x) * 4;
      let offset = 0;
      let reflectivity = 0;
      if (edge.depth > 0 && edge.depth < bezel) {
        const lookup = edge.depth / bezel * 255;
        const lo = Math.floor(lookup);
        const mix = lookup - lo;
        offset = bend[lo] + (bend[lo + 1] - bend[lo]) * mix;
        const f = reflection[lo] + (reflection[lo + 1] - reflection[lo]) * mix;
        // A subdued environment above-left, with a dimmer opposite reflection.
        const environment = .38 + .62 * Math.abs(edge.nx * -.6 + edge.ny * -.8);
        reflectivity = f * environment * Math.min(1, edge.depth);
      }
      displacement[i] = 128 + 128 * edge.nx * offset / range;
      displacement[i + 1] = 128 + 128 * edge.ny * offset / range;
      displacement[i + 2] = 128;
      displacement[i + 3] = 255;
      fresnel[i] = fresnel[i + 1] = fresnel[i + 2] = 255;
      fresnel[i + 3] = reflectivity * 255;
    }
  }
  return { ...mapSize, displacement, fresnel, scale: range * 2, bezel, maximum };
}
