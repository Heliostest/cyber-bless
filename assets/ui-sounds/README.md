# Local UI feedback

Eight derived clips from **Kenney Interface Sounds 1.0**, created/distributed by
[Kenney](https://kenney.nl/assets/interface-sounds), released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The package's
original `License.txt` is preserved byte for byte and copied into both hosts.
CC0 permits modification and commercial distribution; attribution is optional.

The authoring input is the already downloaded official package at
`artifacts/ui-sounds/kenney-interface/`, with original archive SHA-256
`f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232`.
The original package license was read in full. Download and first-party license
review details are recorded in
[the source research](../../docs/research/2026-11-03-ui-sound-sources.md).
`manifest.json` records each input filename/hash/size and every derived WAV's
hash, duration, sample rate, signal peak, RMS, and maximum sample step.

| Product cue | Original file under `Audio/` | Output duration | Peak | RMS |
| --- | --- | ---: | ---: | ---: |
| navigate | pluck_001.ogg | 99.54 ms | 0.03201 | 0.00469 |
| back | pluck_002.ogg | 140.04 ms | 0.03201 | 0.00492 |
| select | select_001.ogg | 60.00 ms | 0.03201 | 0.00441 |
| open | open_001.ogg | 147.79 ms | 0.03201 | 0.00746 |
| close | close_001.ogg | 147.79 ms | 0.03201 | 0.00779 |
| toggleOn | toggle_001.ogg | 136.46 ms | 0.03201 | 0.00618 |
| toggleOff | toggle_002.ogg | 136.46 ms | 0.03201 | 0.00841 |
| notice | question_002.ogg | 220.00 ms | 0.02798 | 0.01197 |

The eight WAVs total **52,580 bytes**. All are mono, 24 kHz, signed 16-bit PCM.
The source clips are decoded and downmixed with Web Audio, lowpass filtered at
3,600 Hz (Q 0.65), softened with a 4 ms attack and 12 ms release, peak normalized,
then quantized. Both file edges are exact silence. Back and notice are cropped;
select is padded to 60 ms. Other files keep the browser-decoded duration, which
can differ slightly from Ogg container granule duration. A one-frame rounding
difference can occur when converting seconds to sample frames.

Rebuild from the repository root with the existing Playwright dependency and
installed Microsoft Edge:

```powershell
node assets/ui-sounds/build.mjs
# An unpacked original package can also be supplied explicitly:
node assets/ui-sounds/build.mjs D:/path/to/kenney-interface
```

The builder uses the browser decoder and `OfflineAudioContext`; it does not
install conversion tools. These are application feedback sounds and carry no
religious, cultural, or traditional music attribution. Existing synthesized
`saved`, `collect`, and `complete` cues are retained separately.

Signal and packaging verification does not establish perceived cuteness,
softness, phone speaker balance, or hardware silent-switch behavior. No
subjective listening or physical-device validation is claimed here.
