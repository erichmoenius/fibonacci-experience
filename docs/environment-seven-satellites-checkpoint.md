# Environment seven-satellite GREEN checkpoint

This checkpoint consolidates the seven photographic gallery layouts and their
adaptive refinements, independent version-2 presets, physical layout sliders,
gallery-only optical wheel zoom and approved HOME values.

| Gallery | Layout | Picture Size | Gap | Radius offset |
| --- | --- | ---: | ---: | ---: |
| Cities | Spherical mosaic | 102 | 12 | 0 |
| Countries | Six-sided cube | 93 | -4 | 0 |
| Water | Immersive sphere | 150 | -50 | 5 |
| Animals | Adaptive 2.5-turn spiral | 150 | -22 | 1.8 |
| Events | Adaptive five-section timeline | 150 | -22 | 1.1 |
| Ethnicity | Adaptive Fibonacci constellation | 150 | 9 | -3.3 |
| Plants | Adaptive botanical phyllotaxis | 150 | 2 | -3.3 |

All galleries retain 75 panel objects. HOME is used without an explicit user
preset and by Reset. An existing saved preset retains first-entry restoration
and explicit Load. Re-entry retains the current session. Reset never deletes a
saved preset. Version-1 absolute radii migrate in memory only when unambiguous;
invalid/unsupported records are retained. Optical zoom is temporary and restores
the exact entry FOV when leaving or handing over camera ownership.

## Current acceptance checks

Run from the repository root with the dependencies in package-lock.json:

```
npm ci
node experiments/earth-m12-characterization.mjs
node experiments/earth-m10b-characterization.mjs
npm run build
git diff --check
```

The consolidated check exercises all seven approved HOMEs, Save/Load/Reset and
isolation, refresh reconstruction, basic frame safety/adaptive geometry,
constellation topology, chronology, 21 entry/return cycles, optical restoration
and resource disposal. It uses real gallery modules with inert textures and
controlled DOM/camera doubles; it makes no media requests or license/CORS claims.
The existing tracked E41 and M02 characterization updates remain available but
are not part of this focused acceptance run. Superseded uncommitted milestone
experiments remain outside this checkpoint, preserved in the owner's worktree.

## Runtime dependencies and scope

The established media.thefridolin.com hosting remains an external runtime
prerequisite. Existing collection manifests and loader logic are retained.
Five required local previews and their existing provenance manifest are included
under public/gallery-previews. Originals and archives are not copied or changed.
No media licenses, attribution, archive checks or CORS verification are repeated.

The committed app/theme entry points are sufficient for gallery activation.
CameraDirector, FreeFlight, SphericalTravellerFlight and satellite orbits are
unchanged. Unrelated sky, solar, planetary, documentation and reference work is
excluded. No production deployment accompanies this Git checkpoint.
