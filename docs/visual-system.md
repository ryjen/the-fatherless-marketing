# Public visual system

This visual system is a public presentation layer. Mood guidance may reflect approved positioning, but styling must never encode, explain, or expose private plot, symbolic, editorial, or canon architecture.

## Foundations

The original volume is the shared default layer in `src/styles/base.v1.css`. Prequel and sequel styles are small inherited overrides:

- original — historical, institutional, sacred, and human; warm near-black surfaces, parchment text, restrained gold accents;
- prequel — elemental, prehistoric, ember, stone, water, and survival; warmer earth surfaces and ember accents;
- sequel — technological, networked, luminous, and plural; deep blue-black surfaces and cyan-green light accents.

The themes change atmosphere, not interaction patterns. Navigation, typography scale, spacing, controls, focus treatment, reading measure, and responsive behavior remain shared.

## Typography

Use resilient system stacks only until a public font license and performance case are approved.

- display/editorial: Georgia with Times fallback;
- navigation, controls, labels, metadata: system sans-serif stack;
- body copy: minimum 1rem with 1.65 line height;
- headings use `clamp()` rather than viewport-only sizing;
- prose measure targets 70 characters.

No page may require a custom font to remain readable or preserve layout.

## Palette and contrast

Theme tokens are declared as CSS custom properties. Normal text and interactive foreground/background combinations must meet WCAG AA. Hero copy is never placed directly on uncontrolled imagery: `.hero__panel` provides a high-opacity bounded surface with a solid-color fallback before enhancement.

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
