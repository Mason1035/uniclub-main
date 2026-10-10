import { gsap } from './gsap';
import { Flip } from 'gsap/Flip';

// Only list routes import this module; register before their capture handlers run.
gsap.registerPlugin(Flip);

export { Flip };
