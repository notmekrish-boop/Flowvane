# Flowvane interface system

## Mode

Operate. The interface helps student project teams and small teams coordinate work.

## Visual direction

Use the user's supplied references as the direction: a compact, app-like shell; a card-based project dashboard with clear columns; and a high-contrast black workspace with warm yellow/amber highlights in dark mode. Keep the product's existing content and controls. Do not copy the reference product's branding, names, sample data, or assets.

## Color

- Dark ground: true black `#050505` for the app canvas.
- Dark surfaces: near-black `#101010` and `#171717`, separated with quiet charcoal borders.
- Primary accent: warm amber `#FFB13B`; use brighter yellow `#FFD166` for focus, highlights, and selected navigation.
- Light ground: warm neutral `#F4F4F1`; cards white with fine neutral borders.
- Text: near-white in dark mode, charcoal in light mode; supporting text must remain readable.
- Keep status colors reserved for status: green for complete, red for overdue/error, blue only where product data requires it.

## Layout

- Keep a narrow left navigation rail with an expanded and collapsed state. Collapsed mode retains pixel icons, tooltips, and accessible names. Persist the user's choice.
- Keep the top bar for global search, create actions, notifications, and profile controls.
- Dashboard uses a compact, responsive three-column card composition: personal tasks, project overview and activity, and a right rail for upcoming work or team activity. Stack these columns on narrow screens.
- Use consistent card edges, modest corner radii, and compact spacing. Avoid excessive nested panels.

## Icons

- Use a consistent local pixel-art SVG icon set with crisp edges, simple silhouettes, and current-color inheritance.
- Do not use Lucide icons or mix outline icon families.
- Keep icons legible at navigation and control sizes; pair icon-only controls with labels or accessible names.

## Interaction and accessibility

- Keep theme switching between light and dark and persist the selected theme.
- Make sidebar collapse state persistent and keyboard accessible.
- Provide visible focus states, readable contrast, reduced-motion support, and touch-sized controls.
- Do not use motion to hide content or communicate state by color alone.
