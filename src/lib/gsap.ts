import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { useGSAP } from "@gsap/react";

// Register once; components can import the animation tools from this module.
gsap.registerPlugin(ScrollTrigger, useGSAP, Flip);

export { gsap, ScrollTrigger, useGSAP, Flip };
