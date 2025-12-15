<h1 align="center">Theme File Structure</h1>

<p align="center">
  <strong>Complete list of files needed for a PlanShake theme</strong>
</p>

<p align="center">
  <a href="https://drive.google.com/file/d/1-tSVYT5SM1xlMWCNVRHFED1rzwZvzr0R/view?usp=sharing">📦 Download Default Theme</a> •
  <a href="./THEME_GUIDE.md">Full Guide</a>
</p>

---

## Required Files

| File | Description |
|------|-------------|
| `main.css` | Entry point, imports all CSS files |
| `_variables.css` | CSS custom properties (colors, spacing) |
| `_base.css` | Typography, scrollbars, resets |
| `_components.css` | Buttons, inputs, modals, cards |
| `_layout.css` | Header, navigation, sidebar |
| `_pages.css` | Page-specific styles |
| `_responsive.css` | Mobile and tablet styles |
| `_theme-dark.css` | Dark mode overrides |
| `_contextmenu.css` | Right-click menu styles |

---

## Optional Files

| File | Description |
|------|-------------|
| `_splash.css` | Splash screen styling |

---

## Icons Folder

Place PNG icons in the `icons/` subfolder:

```
icons/
├── Addborder.png
├── Bold.png
├── Bringtofront.png
├── BrushSettingsPaint.png
├── BrushSettingsbtn.png
├── BrushSettingserase.png
├── Calender.png
├── Copy.png
├── Cursor.png
├── Duplicate.png
├── Gantt.png
├── Layers.png
├── Pan.png
├── Pen.png
├── Settings.png
├── Stickynote.png
├── Strikethrough.png
├── addshadow.png
├── alligencenter.png
├── alligenjustify.png
├── alligenleft.png
├── alligenright.png
├── brightness.png
├── bulletlist.png
├── checklit.png
├── clear.png
├── clearformating.png
├── eraser.png
├── eye.png
├── eyeclosed.png
├── fittoaspectratio.png
├── fliphorizontal.png
├── flipvertical.png
├── highlightcolor.png
├── insertoimage.png
├── italic.png
├── lefttorightft.png
├── lineheight.png
├── locked.png
├── movedown.png
├── moveup.png
├── numberedlist.png
├── paste.png
├── redo.png
├── replaceimage.png
├── righttoleft.png
├── save.png
├── sendtoback.png
├── textcolor.png
├── trash.png
├── underline.png
├── undo.png
└── unlocked.png
```

---

## SVG Icons (Advanced)

For SVG icons, create `SVGPath/icons.json`:

```json
{
    "forceUseSvg": true,
    "Bold": "<svg>...</svg>",
    "Save": "<svg>...</svg>"
}
```

---

## Complete Folder Structure

```
YourThemeName/
├── main.css
├── _variables.css
├── _base.css
├── _components.css
├── _layout.css
├── _pages.css
├── _responsive.css
├── _theme-dark.css
├── _contextmenu.css
├── _splash.css          (optional)
├── _effects.css         (optional)
├── icons/
│   ├── Bold.png
│   ├── Save.png
│   └── ... (50+ icons)
└── SVGPath/             (optional)
    └── icons.json
```

---

## File Import Order

The order in `main.css` is critical:

```css
/* 1. Variables first - defines all custom properties */
@import '_variables.css';

/* 2. Base styles */
@import '_base.css';

/* 3. Component styles */
@import '_components.css';

/* 4. Layout styles */
@import '_layout.css';

/* 5. Page-specific styles */
@import '_pages.css';

/* 6. Responsive styles */
@import '_responsive.css';

/* 7. Dark theme MUST be last (overrides everything) */
@import '_theme-dark.css';
@import '_contextmenu.css';
```

---

## Minimum Required for Theme to Load

At minimum, your theme needs:
1. One `.css` file (e.g., `main.css`)
2. A folder name

The theme system will load any CSS files it finds. For full functionality, include all standard files.
