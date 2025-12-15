<h1 align="center">CSS Variables Reference</h1>

<p align="center">
  <strong>Complete list of all CSS custom properties used in PlanShake themes</strong>
</p>

<p align="center">
  <a href="./THEME_GUIDE.md">Full Guide</a> •
  <a href="./THEME_QUICKSTART.md">Quick Start</a> •
  <a href="./THEME_FILE_STRUCTURE.md">ile Structure</a>
</p>

---

## Glass/Material Effects

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `--mat-glass-base` | `rgba(255, 255, 255, 0.65)` | Base glass/translucent material |
| `--mat-glass-heavy` | `rgba(255, 255, 255, 0.75)` | Heavier/more opaque glass |
| `--mat-glass-recessed` | `rgba(0, 0, 0, 0.03)` | Inset/recessed areas |
| `--glass-blur` | `blur(40px) saturate(180%)` | Backdrop blur effect |
| `--glass-border` | `1px solid rgba(255,255,255,0.45)` | Glass element borders |
| `--glass-shadow` | Complex shadow | Glass element shadows |

---

## Text Colors

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `--text-primary` | `#1D1D1F` | Main body text |
| `--text-secondary` | `#6e6e73` | Muted/secondary text |
| `--text-tertiary` | `#aeaeb2` | Placeholder/disabled text |
| `--text-main` | `var(--text-primary)` | Alias for primary text |
| `--text-muted` | `var(--text-secondary)` | Alias for secondary text |

---

## Accent Colors

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `--accent-blue` | `#8181ff` | Primary accent color |
| `--accent-purple` | `#AF52DE` | Purple accent |
| `--accent-green` | `#34C759` | Success/green accent |
| `--accent-orange` | `#FF9500` | Warning/orange accent |
| `--accent-red` | `#FF3B30` | Danger/red accent |
| `--accent-dark` | `#1c1c1e` | Dark accent |

---

## Primary Action Colors

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `--primary` | `var(--accent-blue)` | Primary button color |
| `--primary-hover` | `#6b6bdd` | Primary button hover |
| `--primary-light` | `rgba(129,129,255,0.15)` | Light primary background |
| `--danger` | `var(--accent-red)` | Danger action color |
| `--success` | `var(--accent-green)` | Success action color |

---

## Background Colors

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `--bg-body` | `#eef0f2` | Page background |
| `--bg-surface` | `var(--mat-glass-base)` | Card/panel surfaces |
| `--bg-surface-hover` | `rgba(255,255,255,0.85)` | Hovered surfaces |
| `--bg-inset` | `rgba(255,255,255,0.5)` | Inset areas |

---

## Border Styling

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `--border` | `rgba(255,255,255,0.6)` | Default border color |
| `--border-hover` | `rgba(255,255,255,0.9)` | Hovered border color |

---

## Border Radius

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `--radius-panel` | `24px` | Panels, modals, cards |
| `--radius-button` | `999px` | Buttons (fully rounded) |
| `--radius-input` | `999px` | Input fields |
| `--radius-sm` | `12px` | Small elements |
| `--radius-md` | `20px` | Medium elements |
| `--radius-lg` | `32px` | Large elements |

---

## Shadows

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.04)...` | Small shadow |
| `--shadow-md` | `0 12px 24px rgba(0,0,0,0.06)...` | Medium shadow |
| `--effect-shadow-float` | Complex | Floating element shadow |
| `--effect-shadow-deep` | Complex | Deep/dramatic shadow |
| `--effect-rim-light` | Complex | Inner rim lighting |

---

## Animation

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `--spring-bounce` | `cubic-bezier(0.34,1.56,0.64,1)` | Bouncy animation |
| `--spring-smooth` | `cubic-bezier(0.25,0.8,0.25,1)` | Smooth animation |
| `--trans-fast` | `0.2s ease` | Fast transition |
| `--trans-med` | `0.4s cubic-bezier(...)` | Medium transition |

---

## Layout

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `--header-height` | `68px` | Top header height |

---

## Z-Index Scale

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `--z-dropdown` | `100` | Dropdown menus |
| `--z-sticky` | `200` | Sticky elements |
| `--z-fixed` | `500` | Fixed positioned |
| `--z-nav` | `1000` | Navigation |
| `--z-header` | `1100` | Page header |
| `--z-modal` | `2000` | Modal dialogs |
| `--z-tooltip` | `3000` | Tooltips |
| `--z-cursor` | `9999` | Custom cursors |

---

## Dark Mode Overrides

In `_theme-dark.css`, override any variable for dark mode:

```css
[data-theme="dark"] {
    --bg-body: #0d0d1a;
    --text-primary: #f0f0f5;
    --text-secondary: #a0a0b0;
    --mat-glass-base: rgba(30, 30, 50, 0.85);
    /* ... more overrides */
}
```

---

## Example: Minimal Color Change

To create a warm-toned theme, change just these variables:

```css
:root {
    --accent-blue: #E07A5F;        /* Terracotta */
    --primary: #E07A5F;
    --primary-hover: #C86B52;
    --bg-body: #FDF6EC;            /* Warm white */
    --text-primary: #3D405B;       /* Slate blue-gray */
}
```

---

## Example: Neo-Brutalist Style

For a bold, angular look:

```css
:root {
    --glass-blur: none;
    --glass-border: 3px solid #000000;
    --radius-panel: 0px;
    --radius-button: 0px;
    --shadow-sm: 2px 2px 0px #000000;
    --shadow-md: 4px 4px 0px #000000;
}
```
