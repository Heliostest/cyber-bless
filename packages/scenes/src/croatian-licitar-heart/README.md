# 彩心相赠 · Croatian licitar heart

`croatian-licitar-heart` is an original, contemporary gift-making homage to northern Croatian licitar craft. It belongs to the broad `croatian-folk` tradition card (grade C, sensitivity 中), uses the courtyard environment, and supports the WISH flow. It does not reproduce a named craftsperson's decoration.

## Product brief

A bright red dough ornament is the central object: a closed, thick, rounded-bevel heart with cream piped edges, three invented floral motifs, green sprigs and a tiny pale inset referring to a mirror. A cloth ribbon joins its body and hangs from a wooden display peg. The left workbench holds the undecorated heart, a cream icing bag and a small icing bowl. A quiet, open wooden gift stand occupies the right side. The palette is licitar red `#ce293c`, cream icing `#ffedc9`, leaf green `#6e9780`, muted blue `#85a7b3` and oak `#c29e6b`; host typography and step controls are retained. The signature is the heart's rounded edible-craft thickness and surface-attached piping, rather than a flat pictogram.

Exactly three checkpoints:

1. **给红心添上糖霜** — grip the real icing bag and drag to the real red heart. The original icing appears, then the bag returns to its cloth rest.
2. **把彩心挂上木钉** — drag the decorated heart body to the cream end of the stand peg. The entire heart settles with its ribbon's inner ceiling touching the shaft's top.
3. **轻点彩心静看** — tap the actual heart to finish quietly, or explicitly submit a nonempty wish of up to 40 characters. Quiet completion removes the unsubmitted draft. Returning mode creates no writer and finishes by quiet tap.

The hint copy calls this a craft homage. The final line is “一颗彩心，留下一份相赠的心意。（当代手作致敬练习结束）”. Native buttons invoke the same checkpoint transitions for keyboard access. The action button does not imply that an unwritten or unsubmitted wish has been saved.

## Cultural context and research

The local source `content/traditions/croatian-folk.md` was read and its JPG viewed. The photo shows the large outdoor worship space at Marija Bistrica, with a congregation, church buildings and wooded hills. That card discusses Croatian Catholic pilgrimage and public festivities. This small gift-craft scene is a deliberate adjacent contemporary interpretation, not a reconstruction of the photographed Mass, an actual pilgrimage, the Eucharist, a priestly blessing, or a claim of protective efficacy.

Primary references consulted on 2026-10-13:

- [Croatian Ministry of Culture and Media: Gingerbread craft from Northern Croatia](https://min-kulture.gov.hr/kulturna-bastina/nematerijalna-kulturna-bastina/nematerijalna-dobra-upisana-na-unesco-ov-reprezentativni-popis-nematerijalne-kulturne-bastine-covjecanstva/gingerbread-craft-from-northern-croatia-eng/6291): supports moulded, baked, dried, painted dough; individual artisan decoration; hearts, small mirrors, messages; family transmission and community festivities. Only broad materials and object categories inform this work.
- [Krapina-Zagorje County Tourist Board: Wooden toys and licitars](https://visitzagorje.hr/en/wooden-toys-licitari/): supports bright red ornaments, white sugar decoration, small mirrors, gift-giving, and an educational licitar craft collection in Marija Bistrica. The account establishes a craft connection to the town without equating it with a religious ritual.
- [UNESCO: Gingerbread craft from northern Croatia, 00356](https://ich.unesco.org/en/RL/gingerbread-craft-from-northern-croatia-00356): attempted directly; a human-verification challenge prevented reading. The challenge was respected. The primary Ministry and official regional tourism references above supply the readable evidence.

The icing arrangement, gift stand, rounded geometry and interaction sequence are original design choices. The pale inset is opaque and has no live reflection. This scene is not a food recipe or an authoritative account of all licitar styles.

## Input, anchors and lifecycle

- Whole-scene nearest opaque intersections determine pickup, release and tap. External opaque objects block interaction. Drop tests exclude only the held object's own subtree; there are no invisible target colliders.
- At least 8 px of owned-pointer movement is required for each drag. Quiet tapping must stay below 12 px. Ribbon-only touches, empty space, wrong objects, wrong drops and multi-pointer gestures do not advance.
- Cancellation, lost capture, blur and host pause restore unfinished drags. Accepted animation freezes on pause/blur. Reduced motion settles immediately. Silent restore supports checkpoints 0/1/2/3, and completion/disposal are idempotent.
- `licitar-icing-grip`, local `[0, 0, 0]`: visible bag pickup.
- `licitar-heart-body`, local `[0.20, -0.10, 0.158]`: red front surface used by decoration destination, body pickup and quiet tap. The mesh origin is at heart-local y = 0.55.
- `licitar-stand-peg-cap`, local `[0, 0, 0]`: visible peg destination.
- Moving groups: `licitar-icing-cone`, `licitar-heart`; revealed geometry group: `licitar-original-icing`.

## Verification

Run `npm run test -w @wbr/scenes -- src/croatian-licitar-heart/scene.test.ts`.

The tests replace GPU rendering only. Real Three.js geometry, matrices, raycasts, interaction cues, pointer ownership and the shared wish form remain active. They cover full object flow; explicit/empty/overlength/reentrant wish submission; unsaved quiet drafts; returning mode; wrong or blocked starts/drops; travel and tap thresholds; cancellation and owner/multitouch recovery; paused motion; silent restore and native action fallback; 320/390/1280 projected first-hit anchors; real heart thickness/bevel; support and loop/peg contact; every icing piece's surface contact; and single resource/listener/shadow/DOM cleanup. Integration build, full suite and browser/mobile visual review are handled by the parent task.
