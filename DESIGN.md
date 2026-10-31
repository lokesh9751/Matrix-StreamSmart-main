---
name: StreamSmart UI
colors:
  surface: '#fdf7ff'
  surface-dim: '#ded5f5'
  surface-bright: '#fdf7ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f1ff'
  surface-container: '#f2ebff'
  surface-container-high: '#ede4ff'
  surface-container-highest: '#e7defe'
  on-surface: '#1d182f'
  on-surface-variant: '#484551'
  inverse-surface: '#322d45'
  inverse-on-surface: '#f5eeff'
  outline: '#797582'
  outline-variant: '#c9c4d2'
  surface-tint: '#6151a5'
  primary: '#57479b'
  on-primary: '#ffffff'
  primary-container: '#7060b5'
  on-primary-container: '#f3edff'
  inverse-primary: '#cbbeff'
  secondary: '#9f3963'
  on-secondary: '#ffffff'
  secondary-container: '#fd85b1'
  on-secondary-container: '#771844'
  tertiary: '#55479c'
  on-tertiary: '#ffffff'
  tertiary-container: '#6e60b7'
  on-tertiary-container: '#f2ecff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e6deff'
  primary-fixed-dim: '#cbbeff'
  on-primary-fixed: '#1d0160'
  on-primary-fixed-variant: '#49398c'
  secondary-fixed: '#ffd9e3'
  secondary-fixed-dim: '#ffb0c9'
  on-secondary-fixed: '#3e001e'
  on-secondary-fixed-variant: '#81214b'
  tertiary-fixed: '#e6deff'
  tertiary-fixed-dim: '#c9beff'
  on-tertiary-fixed: '#1b0162'
  on-tertiary-fixed-variant: '#47398e'
  background: '#fdf7ff'
  on-background: '#1d182f'
  surface-variant: '#e7defe'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.6875rem
    fontWeight: '700'
    lineHeight: 0.875rem
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  margin: 1.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

Metadata
name
StreamSmart UI
Brand & Style
This design system delivers a tactile, high-clarity telemetry experience for real-time video streaming infrastructure and CDN performance monitoring. The aesthetic merges soft rounded geometry, ambient luminosity, and an executive dashboard architecture that renders dense network metrics approachable and frictionless.

The emotional tone balances analytical precision with inviting warmth. The interface avoids aggressive industrial palettes in favor of a soothing dual-tone purple and radiant pink structure, framed within an elevated desktop canvas that communicates modular composure and modern software craftsmanship.

Colors
The system uses a calibrated palette of rich purples, radiant pink accents, and cool foundational grays:

Primary Violet (#7060B5): The navigational backbone, primary active states, and dominant visual anchor.
Deep Purple (#514398): Used for navigational contrast, active rail pills, and grounded interface accents.
Light Purple (#9182CD): Mid-tier surface tints, secondary interactive toggles, and graph gradient transitions.
Vibrant Pink (#F47DA9): Alert beacons, peak telemetry curves, metric callouts, and primary conversion triggers.
Soft Pink (#F9A5C1): Subtle graph fills, badge backdrops, and auxiliary data streams.
Canvas Base (#EDE4FF): The framing desk surface against which the elevated app viewport rests.
Surface Pure (#FFFFFF): Interior card surfaces, elevated control panels, and content modules.
Surface Off-White (#F7F8FC): Secondary metric wells, data table striping, and embedded container surfaces.
Primary Text (#514B65): High-contrast, warm slate-violet for critical headers and metric readouts.
Secondary Text (#918BA3): Softened violet-gray for category labels, time stamps, and axis annotations.
Typography
The design system uses Plus Jakarta Sans across all typographic hierarchies. Its geometric construction, generous counter-spaces, and humanist curves maintain legibility in dense real-time charts while aligning with the rounded UI envelope.

Large telemetry indicators and peak bandwidth stats use tight letter tracking (-0.02em) to remain compact and impactful.
Micro-labels, telemetry units (e.g., kbps, ms, fps), and status indicators use uppercase styling with open letter tracking (0.04em) to ensure legibility at a glance.
Layout & Spacing
The application architecture utilizes an anchored three-column executive cockpit layout:

Outer Frame: The app exists within a primary shell set against the canvas background (#EDE4FF), creating a framed desktop application feeling.
Left Navigation Rail (80px - 96px fixed): Immersed in full primary purple (#7060B5), holding branding, core section icons, and profile anchors. Active icons are nestled within deep purple (#514398) rounded pill indicators.
Central Dashboard Panel (Flexible / 60% viewport): Dedicated to critical telemetry, streaming performance graphs, health monitors, and node clusters.
Right Contextual Activity Panel (340px - 380px fixed): Houses live viewer distribution maps, real-time alert logs, incident streams, and edge node latency lists.
On smaller viewports (<1024px), the right activity panel converts to an overlay drawer, and the central dashboard stacks metric cards vertically into a single column.

Elevation & Depth
Depth is established through soft ambient layering rather than harsh directional drops:

App Shell Canvas: Floats over the #EDE4FF desk using a wide, diffused shadow: 0 24px 48px -12px rgba(81, 75, 101, 0.22).
Dashboard Cards: Pure white (#FFFFFF) surfaces sit against the dashboard canvas with a subtle colored aura: 0 8px 24px -4px rgba(112, 96, 181, 0.08).
Frosted Badges & Overlays: Status chips use backdrop blur filters (backdrop-filter: blur(8px)) paired with semi-transparent tint fills (rgba(244, 125, 169, 0.12) or rgba(112, 96, 181, 0.12)).
Chart Visualizations: Glowing data streams feature soft Gaussian blur underlays that match the stroke color (#F47DA9 and #7060B5) to evoke active optical signaling.
Shapes
The interface embraces a friendly yet structured geometry:

App Viewport Enclosure: Configured with a prominent rounded radius (28px - 32px), creating a floating hardware-console silhouette.
Metric Cards & Content Blocks: Uniform 1rem (16px) corner radius, preserving fluid internal alignment.
Interactive Controls & Status Badges: Full pill borders (9999px) on buttons, filter chips, network toggles, and notification counters to contrast with rectilinear metric modules.
Components
Buttons
Primary: Solid Pink (#F47DA9) with white typography for primary calls to action. Rounded to a continuous pill (9999px), with horizontal padding of 1.25rem and vertical padding of 0.625rem. Subtle glow shadow on hover (0 4px 12px rgba(244, 125, 169, 0.35)).
Secondary: Light violet translucent fill (rgba(112, 96, 181, 0.12)) with Primary Purple (#7060B5) label text.
Icon Actions: Circular or pill containers inside the navigation rail, utilizing Deep Purple (#514398) fills for selected states.
Chips & Frosted Badges
Pill-shaped indicators (padding: 0.25rem 0.75rem) using translucent fills.
CDN Live / Healthy: Soft purple base with an illuminated dot.
Buffering / Warning: Light pink backdrop (#F9A5C1 at 25% opacity) with Pink (#F47DA9) text.
Telemetry Cards
Flat pure white (#FFFFFF) surfaces featuring a metric value (display-lg), metric delta tag (pill badge), and an embedded glowing mini-sparkline.
Borderless by default, using the standard ambient card shadow.
Input Fields & Search Bars
Recessed pill shapes with soft off-white background (#F7F8FC) and no stroke, transitioning to a soft purple glow outline on focus (box-shadow: 0 0 0 2px #9182CD). Placeholder text styled in Secondary Text (#918BA3).
Activity & Map Panels
Embedded in the right column with subtle divider separators (#ECEEF6).
Interactive map uses monochromatic cool-gray tiles with glowing primary pink pin clusters for regional CDN nodes.