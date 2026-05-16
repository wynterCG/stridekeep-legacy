# Audio attributions

All sound effects below are from Kenney's CC0 "Interface Sounds" pack:
https://kenney.nl/assets/interface-sounds

License: Creative Commons Zero (CC0) — public domain, no attribution
required. Credit retained here as a courtesy because the pack is
high-quality, widely used in indie games, and worth supporting:
https://support.kenney.nl / https://patreon.com/kenney

| Local filename | Kenney source clip | Bytes |
|---|---|---|
| `case_open_starter.wav` | `click_002.wav` | 1,102 |
| `case_open_quality.wav` | `confirmation_001.wav` | 26,062 |
| `case_open_fine.wav` | `bong_001.wav` | 11,726 |
| `tile_place.wav` | `tick_002.wav` | 2,126 |
| `ceremony_celebrate.wav` | `confirmation_004.wav` | 44,238 |
| `error_buzz.wav` | `error_005.wav` | 45,774 |

All clips: PCM 16-bit mono 44.1 kHz. Total bundle delta: ~131 KB.

## Background music

`musicBG.mp3` — composed by Daniel Inverno (the project author).
Looping ambient track played at ~35 % volume while the app is
foregrounded. Lifecycle (start / pause / resume) is wired in
`App.tsx`; the player can disable it in Settings → Sound →
"Background music".

If you want to swap any clip for a different tone (e.g. a richer
fanfare for `ceremony_celebrate`), the full Kenney pack lives at the
raw GitHub mirror:
https://github.com/Calinou/kenney-interface-sounds/tree/master/addons/kenney_interface_sounds

Drop a new `.wav` into this folder with the matching name and the
sounds module picks it up on the next Metro reload.
