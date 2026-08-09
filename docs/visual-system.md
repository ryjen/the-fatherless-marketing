# Public visual system

This visual system is a public presentation layer. Mood guidance may reflect approved positioning, but styling must never encode, explain, or expose private plot, symbolic, editorial, or canon architecture.

## Foundations

The shared structural layer lives in `src/styles/base.v1.css`. Prequel and sequel remain inherited variants, while the original volume uses the shared structure as its primary theme.

- original — nocturnal, institutional, human, and politically tense; graphite and blue-black surfaces, cold stone text, oxidized teal accents, and restrained muted-wine atmospheric notes;
- prequel — elemental, prehistoric, ember, stone, water, and survival; warmer earth surfaces and ember accents;
- sequel — technological, networked, luminous, and plural; deep blue-black surfaces and cyan-green light accents.

The original must not default to sepia, parchment, brown-gold historical styling, devotional imagery, or familiar Biblical-poster composition. Its public visual tone should read as a contemporary prestige political drama photographed inside an ancient world rather than as religious illustration.

The themes change atmosphere, not interaction patterns. Navigation, typography scale, spacing, controls, focus treatment, reading measure, and responsive behavior remain shared.

## Typography

Use resilient system stacks only until a public font license and performance case are approved.

- original display/editorial headings may use the system sans stack to create a more contemporary, institutional voice;
- long-form prose remains readable through a resilient serif stack;
- navigation, controls, labels, and metadata use the system sans-serif stack;
- body copy: minimum 1rem with 1.65 line height;
- headings use `clamp()` rather than viewport-only sizing;
- prose measure targets 70 characters.

No page may require a custom font to remain readable or preserve layout.

## Palette and contrast

Theme tokens are declared as CSS custom properties. Normal text and interactive foreground/background combinations must meet WCAG AA. Hero copy is never placed directly on uncontrolled imagery: `.hero__panel` provides a high-opacity bounded surface with a solid-color fallback before enhancement.

The original palette should preserve separation from both neighboring eras:

- avoid the prequel's ember/earth dominance;
- avoid the sequel's bright cyan/neon language;
- use oxidized teal as a restrained material color rather than a luminous technology cue;
- use muted wine only as secondary tension, never as a large red field;
- keep the primary impression graphite, cold stone, and controlled darkness.

Translucency and `color-mix()` are enhancements only. The first declared background remains readable when those features are unavailable.

## Components

Shared primitives include:

- masthead and six-destination primary navigation;
- skip link;
- hero with bounded content surface;
- editorial section and asymmetric-ready grid;
- panels for short reader groupings;
- buttons and quiet actions;
- quotation treatment;
- theme marker;
- footer.

Cards may support navigation but must not become the only information structure.

## Accessibility baseline

- semantic `header`, `nav`, `main`, `section`, `article`, and `footer` landmarks;
- one primary heading per page;
- skip link targets `#main`;
- visible `:focus-visible` outline with theme-safe contrast;
- interactive targets are at least approximately 44 CSS pixels high;
- mobile navigation wraps into readable two- or three-column rows with no ellipsis truncation;
- no content depends on hover, animation, imagery, custom fonts, JavaScript, backdrop filters, or `color-mix()`;
- `prefers-reduced-motion: reduce` disables meaningful transition/animation duration and smooth scrolling;
- forced-colors mode restores explicit borders;
- print mode removes decorative backgrounds.

## Responsive behavior

The layout is content-first and fluid. Representative smoke widths are 375×812 and 1440×1000. Tests require no horizontal document overflow, readable navigation labels, visible hero text, focus visibility, and theme contrast at those widths.

## Imagery

Approved raster imagery should be processed with `scripts/generate-responsive-media.mjs` after its rights/provenance and metadata review is complete.

For the original volume, prefer imagery that feels observational and socially embedded rather than iconic or devotional:

- environmental scenes, civic architecture, thresholds, public space, groups, and asymmetric portraits;
- human subjects integrated into their surroundings rather than isolated as sacred icons;
- cool, controlled lighting and materially plausible stone, metal, fabric, water, and atmosphere;
- restrained celestial or environmental unease rather than divine beams, halos, stars, or overt religious shorthand;
- no sepia wash, faux parchment, gold-dominant grading, Renaissance devotional poses, or generic Biblical cover art.

Production markup should use `<picture>` with:

1. AVIF `srcset`;
2. WebP `srcset`;
3. an appropriate original/fallback image;
4. intrinsic `width` and `height`;
5. a `sizes` expression matching layout intent;
6. `loading="lazy"` for below-the-fold images;
7. eager/high-priority loading only for a measured primary visual.

Generated derivatives remain governed public artifacts and require manifest entries before moving under `src/`.

## Motion

Motion is optional enhancement, never a comprehension dependency. Prefer small opacity/transform transitions only when they remain calm and respect reduced-motion preferences. Avoid autoplay, parallax, continuously moving backgrounds, or motion that competes with reading.

## Cache integrity

Public stylesheets use explicit versioned filenames such as `base.v1.css`. Any byte-changing stylesheet release must increment the filename version before deployment when stale CDN/browser caches could mix incompatible HTML and CSS. HTML refers only to versioned public stylesheet paths.

## Performance budgets

`performance-budget.json` defines enforceable static budgets. The current baseline limits:

- individual HTML: 24 KiB;
- total shared/theme CSS: 32 KiB;
- initial page requests represented in markup: 12;
- external third-party requests: zero;
- render-blocking scripts: zero.

These are ceilings, not targets. Browser smoke is supplementary; pages must work fully as static HTML/CSS.
