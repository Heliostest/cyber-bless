# Windswept meadow

The broad ground colour patches, seeded layout and local mesh wrapper are project
code in `packages/scene-runtime/src/stylized-meadow.ts`. Blade bending and
root-to-tip lighting are adapted from the MIT-licensed
[boona13/threejs-grass-water-shaders](https://github.com/boona13/threejs-grass-water-shaders)
at commit `97fb7ea3135362dbb1ba80cdfa8fb27ec8d0b159`.
The original copyright and permission notice is retained in
`LICENSE.boona13.txt`, distributed with both Web and Expo DOM assets.

The adaptation uses a small seeded field, two curved blades per tuft, simple
coherent wind, shared sun shadows, Three colour management and atmospheric fog.
The source's terrain sampling, push field, growth animation and large field
wrapper are not included. Ground patches are generated locally into a 256×256
texture; the app makes no request to the reference project.

The current scene's existing render loop drives the wind clock. A scoped motion
binding from `mountScene` carries pause, visibility and reduced-motion settings
to its decorative environment. There is no second animation loop. Vegetation
stays outside the authored interaction region, paths, water and timber decks.

Also evaluated:
[Steve245270533/three-stylized](https://github.com/Steve245270533/three-stylized),
which provides a more general configurable meadow facade under MIT. The smaller
adaptation fits this app's already-authored flat scene layouts.
