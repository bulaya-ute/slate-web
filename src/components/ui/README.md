# Slate UI kit

The design-system primitives for slate-web. Every screen — this task's
Connect/Login/Setup flow and every screen after it — should compose
these rather than reaching for raw `<button>`/`<input>`/color literals.
If a screen needs something this kit doesn't cover, add it here first.

## Design tokens

Tokens live in `src/theme.css` as CSS custom properties (`--color-bg`,
`--color-accent`, `--radius-md`, …) and are re-exposed to Tailwind via
`@theme inline` in `src/index.css`, so both approaches work and stay in
sync:

```tsx
// Tailwind utility (preferred inside components)
<div className="bg-surface text-text border border-border rounded-md" />

// Raw CSS variable (for one-off inline styles / non-Tailwind contexts)
<div style={{ background: 'var(--color-surface)' }} />
```

Never hard-code a hex value or a `bg-gray-800`-style Tailwind palette
class in application code — use the token utilities (`bg-bg`,
`bg-surface`, `bg-surface-hover`, `text-text`, `text-text-muted`,
`text-text-faint`, `border-border`, `text-accent`, `text-danger`,
`text-success`, …) so the light/dark themes stay correct everywhere.

Theme resolution: `prefers-color-scheme` is the default; an explicit
override sets `data-theme="light"|"dark"` on `<html>` (see
`src/stores/theme.ts`), which always wins over the media query.

## Components

| Component | Notes |
|---|---|
| `Button` | `variant`: primary / secondary / ghost / danger. `size`: sm / md. `loading` shows an inline spinner and disables the button. |
| `Input` | Labeled text field with `error` (red, sets `aria-invalid`) and `hint` slots. Forward-refs the `<input>`. |
| `Modal` | Centered dialog, portaled to `document.body`. Closes on Escape/backdrop click, restores focus to the trigger on close. |
| `useFocusTrap` | Hook backing `Modal`'s (and `CommandPalette`'s) focus handling: captures the pre-open trigger, keeps Tab/Shift+Tab cycling within a container while open, and restores focus to the trigger on close. Reuse this for any new portaled `aria-modal="true"` overlay rather than hand-rolling capture/restore/trap. |
| `Toast` / `toast.*` / `ToastViewport` | Call `toast.info/success/danger(title, description?)` from anywhere (no provider/context needed) — backed by a small Zustand store. Mount `<ToastViewport />` once near the app root. Auto-dismisses after 5s. |
| `Skeleton` | Pulsing placeholder block; pass `className` for size (`"h-4 w-32"`, etc). Compose several for list/card skeletons. |
| `Spinner` | Indeterminate spinner, `size`: sm / md / lg. Always pass a meaningful `label` for screen readers. |
| `Tooltip` | Hover- **and** focus-triggered label, for icon-only controls. |

## Conventions

- **Motion**: transitions use `duration-150`/`duration-180` (150–200 ms)
  with `ease-out` — matches the design spec's polish bar. Respect
  `prefers-reduced-motion`: `theme.css` collapses the duration tokens to
  ~0 under that media query, and animation-based components should
  prefer `transition-*` utilities (which read the token) over
  hand-rolled `@keyframes` where possible.
- **Focus**: every interactive element must show a visible focus ring
  on keyboard focus (`focus-visible:outline-[var(--color-focus-ring)]`).
  Don't suppress `:focus-visible` outlines.
- **Radius**: flat-ish plates, not pills — `rounded-sm` (4px) for
  tags/checkboxes, `rounded-md` (6px) for inputs/buttons, `rounded-lg`
  (10px) for cards/modals.
- **Empty/loading/error states**: every list or async view should have
  all three — a `Skeleton`-based loading state, a real empty state with
  guidance (not just blank space), and an error state with a way to
  retry. See `src/routes/Connect.tsx` for a worked example of the
  loading/error state machine.
