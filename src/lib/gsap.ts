import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

// Shared chrome and the homepage only need GSAP core and its React lifecycle.
gsap.registerPlugin(useGSAP);

export { gsap, useGSAP };
