# ClassHub desktop pet attribution

The pet engine, action keyframes, physics, configuration-store pattern, skin
definitions and synthesized sounds are adapted from **dsh-niulai-pet v0.4.13**
by whitefirer, Copyright (c) 2026 whitefirer, under the MIT License.

The complete MIT notice is preserved in the adjacent `LICENSE` file and ships
with ClassHub's public assets. Core adapted modules also retain source notices.
Source: https://github.com/whitefirer/dsh-niulai-pet, from the user-provided
`dsh-niulai-pet-master` distribution.

Included original artwork, identified by the upstream README as hand drawn and
freely reusable:

- `assets/panda/skins/default/panda.png`, `assets/panda/skins/default/panda_blink.png`
- `assets/whale/skins/default/whale.png`, `assets/whale/skins/default/whale_blink.png`, `assets/whale/skins/default/whale_spout.png`

## Additional user-supplied pets

At the user's request, `new-pets.zip` supplies the following static skins and
associated PNG/WebP/MP3 files, copied without modification:

- `niulai/`: 牛来 · 萌化、原皮、小黄; two shared voice samples.
- `nailong/`: 奶龙; blink, shout, animated WebP and laugh sample.
- `xiaonailong/`: 小奶龙; blink, four interaction frames and voice sample.
- `cat/`: 赛博猫; sleeping/standing WebP and meow sample.
- `dagou/`: 大狗; idle/shout WebP and call sample.

These paths are relative to this public asset directory. The ZIP contained no
separate LICENSE, README or ownership declaration. The MIT license for the
engine code does not by itself establish rights to third-party character designs
or recordings. No additional license is asserted for these user-supplied assets;
their applicable artwork/audio rights must be established before redistribution.
The panda and whale duplicates in the ZIP were not imported again.

Browser presentation changes size, transparency and hue only. Panda/whale voices
use the upstream synthesized Web Audio algorithms. The other characters use the
six user-supplied MP3 samples, played only on interaction and released on stop,
skin change or unmount. Skin and timeline definitions follow upstream `packs.ts`.

No DSH host runtime, plugin settings, task/session APIs, microphone recognition,
WASM/KWS models, voice templates, reply samples, IndexedDB pack importer or store
is included. Adding these bundled skins does not enable runtime ZIP imports.
