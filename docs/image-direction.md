# Story-driven public image direction

This document defines the production image briefs for the public trilogy site. It is a **presentation specification**, not a canon document. The public repository must not reproduce private manuscript text, hidden symbolic mechanics, source paths, editorial notes, or scene-level spoilers.

The visual goal is cinematic environmental storytelling: people exist inside systems, landscapes, crowds, and infrastructure rather than appearing as sacred icons or isolated promotional portraits.

## Shared cinematic grammar

All four hero assets should feel like frames from one prestige dramatic trilogy photographed across radically different eras.

Shared rules:

- landscape-first composition with human scale visible but not iconized;
- asymmetric framing and strong environmental geometry;
- controlled darkness with readable local contrast rather than a brown/black wash;
- one clear source of visual tension per image;
- physically plausible materials, atmosphere, scale, and lighting;
- room for responsive cropping without removing the image's narrative subject;
- no baked-in typography, logos, zodiac glyphs, religious symbols, or UI text;
- no halo-like backlighting, divine rays, cruciform framing, saint poses, Madonna-and-child composition, or Biblical-poster staging;
- no generic fantasy, caveman-museum, cyberpunk, superhero, or devotional-cover language;
- no image should be necessary to understand the page copy.

Recommended source master: at least **2400 × 1350 (16:9)**. Preserve a safe central 70% for responsive crops. Generate 480/960/1440 AVIF and WebP derivatives through `scripts/generate-responsive-media.mjs` only after rights/provenance approval.

## Homepage — the trilogy across three ages

**Asset key:** `trilogy-overview-hero`

### Narrative job

Introduce the trilogy as three changing forms of the same struggle over power and legitimacy without explaining the hidden architecture. It should feel like one visual sentence rather than a collage of three book covers.

### Composition

A wide, cinematic landscape whose visual language changes gradually from left to right:

1. exposed ice, dark water, distant migration and a small carried flame;
2. cold monumental civic stone, a public threshold and compressed human crowd geometry;
3. partially dark modern/future civic infrastructure with many small independent signal/light sources.

The transitions should be atmospheric and architectural, not separated by hard panels. No single person dominates the frame. Water, paths, thresholds, or horizon lines can provide continuity across eras.

### Palette

- left: polar blue, charcoal, glacial white, restrained sky-fire red;
- centre: graphite, cold stone, blue-black, oxidized teal, muted wine tension;
- right: indigo-black, deep network blue, restrained cyan/violet points.

### Avoid

Triptych poster layout, religious iconography, a central saviour silhouette, literal fish/ram/Aquarius glyphs, timeline labels, glowing portals, fantasy montage effects, or a single bright beam connecting the ages.

### Public-safe alt intent

`Three eras transition from an icy migration landscape, through monumental civic architecture, to a dark networked city.`

## Prequel — *Age of Embers*

**Asset key:** `age-of-embers-hero`

### Narrative job

Show that survival is dominated by cold, migration, guarded resources, and a changing sky. Fire matters because it is small and vulnerable, not because the image is a ritual scene.

### Composition

A vast late-Pleistocene glacial valley near polar twilight. A small group of migrating humans crosses wind-cut snow and dark meltwater while distant animals move away from the valley. The sun sits unnaturally low near the horizon. Red auroral sky-fire develops high above, reflected faintly in black water. One person carries a small protected ember/flame near the group; it must remain subordinate to the landscape.

People should be too distant for definitive character casting. Clothing and tools should feel materially plausible, worn, practical, and non-costume-like.

### Palette

Polar-night navy, glacial blue, cold grey-white, black water, red aurora. Ember orange only as a tiny secondary cue.

### Avoid

Heroic caveman close-up, fur-bikini stereotype, shaman circle, dominant campfire, cave painting collage, brown stone-age grading, fantasy mammoth charge, ram-horn costume, literal fish symbolism, or supernatural god imagery.

### Public-safe alt intent

`A small migrating group crosses a glacial valley beneath a low sun and red aurora, carrying a protected ember through the cold.`

## Original — *The Fatherless*

**Asset key:** `fatherless-original-hero`

### Narrative job

Make the Republic itself visually powerful: civilization, law, wealth, hierarchy, and public order can look impressive while human vulnerability is compressed inside them. The image should read as political drama, not religious epic.

### Composition

A cold monumental civic threshold in a Rome-like republic at blue-hour or controlled overcast light. Massive stone stairs, columns, arches, bronze/iron details, banners or civic fabric without readable emblems, and a disciplined crowd create geometric authority. A small vulnerable family or pair is partially separated from the crowd at an edge/threshold—not centred, posed, or illuminated as sacred figures. Officials, guards, elites, workers, and enslaved people may share the public space through differing posture, access, or elevation rather than explicit spectacle.

The camera should feel observational: slightly elevated or oblique, like witnessing an institution functioning. Human faces need not be identifiable enough to lock public character casting.

### Palette

Graphite, cold limestone, blue-black shadow, desaturated fabric, oxidized teal material accents, restrained muted-wine tension. Natural skin tones should remain visible and not be sepia-shifted.

### Avoid

Jesus-like central male figure, halo/sunburst, mother-and-child devotional pose, crucifix silhouettes, candles/crowns/olive branches, gold wash, parchment texture, Roman tourist postcard, gladiator-poster action, triumphal emperor portrait, or generic Biblical-film composition.

### Public-safe alt intent

`People gather beneath massive civic architecture while a small vulnerable group stands at the edge of the Republic's ordered public space.`

## Sequel — *Neurion*

**Asset key:** `neurion-hero`

### Narrative job

Show a civilization whose infrastructure is failing unevenly while many human and synthetic centres of agency continue acting. The visual centre is plurality, not a glowing artificial supermind.

### Composition

A future civic transit/data/public-services district during partial power loss after a solar/infrastructure disturbance. Some structures are dark, some emergency systems remain active, and many independent signal sources are scattered through the frame. Humans and clearly non-human synthetic persons share the space: helping, waiting, observing, repairing, disagreeing, or moving independently. No one entity occupies the visual centre.

Network/distributed-intelligence ideas may appear through repeated light nodes, reflections, routing patterns, moving groups, or layered civic infrastructure—not floating code. The sky can carry restrained residual solar disturbance without becoming a cosmic portal.

### Palette

Near-black indigo, deep network blue, controlled cyan, restrained violet variation, limited warning rose/red. Keep skin, concrete, glass, metal, textiles, and machine surfaces materially plausible.

### Avoid

Glowing robot face, chrome humanoid hero, Matrix code rain, neon cyberpunk alley, holographic deity, giant central AI orb, blue hologram saviour, one luminous figure controlling a crowd, generic server-rack stock art, or sterile SaaS-gradient futurism.

### Public-safe alt intent

`Humans and synthetic persons move through a partially dark future civic district lit by many independent signals during an infrastructure disruption.`

## Asset approval checklist

Before any image enters deployable `src/`:

1. record source/provenance and rights classification;
2. record whether the source is commissioned, generated, licensed stock, or public domain;
3. confirm no private source material or private metadata is embedded in the asset record;
4. review the source visually for story fit, unwanted religious shorthand, stereotypes, accidental text/logos, and spoiler risk;
5. strip unnecessary embedded metadata and retain only justified public metadata;
6. approve public-safe alt text based on what is actually visible;
7. generate responsive AVIF/WebP derivatives with intrinsic dimensions;
8. add every deployable source/derivative to the public manifest as required by publication policy;
9. use `<picture>` markup and a bounded text panel so readability does not depend on the image;
10. verify 375 px and 1440 px crops, 200% text zoom, reduced motion, no-image behavior, and performance budgets.

## Review standard

Reject an otherwise attractive asset if it makes the story look like a devotional retelling, a sepia historical epic, generic prehistoric fantasy, or generic cyberpunk. The image must communicate the **kind of power each era lives inside** before it communicates a genre label.
