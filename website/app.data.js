const DATA_KEY = "trelloLiteData";
const THEME_KEY = "trelloLiteTheme";
const DATA_SAVED_EVENT = "trelloLite:dataSaved";
const TAG_COLOR_PALETTE = [
  "#EB5A46",
  "#FF9F1A",
  "#F2D600",
  "#61BD4F",
  "#00C2E0",
  "#0079BF",
  "#C377E0"
];

function loadData() {
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) return { projects: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { projects: [] };
  }
}

function saveData(data) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
  lastSaveTimestamp = Date.now();
  if (typeof window !== "undefined") {
    const payload =
      typeof CustomEvent === "function"
        ? new CustomEvent(DATA_SAVED_EVENT, {
            detail: { timestamp: lastSaveTimestamp }
          })
        : new Event(DATA_SAVED_EVENT);
    window.dispatchEvent(payload);
  }
}

function generateId(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 10);
}

function hexToRgba(hex, alpha = 0.2) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  let normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map(ch => ch + ch)
      .join("");
  }
  const bigint = parseInt(normalized, 16);
  if (Number.isNaN(bigint)) {
    return `rgba(0,0,0,${alpha})`;
  }
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const ICON_POOL = ["★", "⚡", "🎯", "🚀", "🧭", "✨"];



function normalizeTags(tags = []) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag, idx) => {
      const fallbackColor =
        TAG_COLOR_PALETTE[idx % TAG_COLOR_PALETTE.length];
      if (typeof tag === "string") {
        const text = tag.trim();
        if (!text) return null;
        return { text, color: fallbackColor };
      }
      if (!tag || !tag.text) return null;
      return {
        text: tag.text.trim(),
        color: tag.color || fallbackColor
      };
    })
    .filter(tag => tag && tag.text.length > 0);
}

function assignColorsToTags(tagNames, existingTags = []) {
  const normalizedExisting = normalizeTags(existingTags);
  const colorMap = new Map(
    normalizedExisting.map(tag => [tag.text.toLowerCase(), tag.color])
  );
  let paletteIndex = 0;
  return tagNames.map(name => {
    const text = name.trim();
    const lower = text.toLowerCase();
    let color = colorMap.get(lower);
    if (!color) {
      color = TAG_COLOR_PALETTE[paletteIndex % TAG_COLOR_PALETTE.length];
      paletteIndex += 1;
    }
    return { text, color };
  });
}

function createTagElement(tag) {
  const el = document.createElement("span");
  el.className = "project-tag";
  el.textContent = tag.text;
  el.style.backgroundColor = hexToRgba(tag.color, 0.2);
  el.style.color = tag.color || "var(--accent)";
  return el;
}

// ======================
// Theme
// ======================

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  const sel = document.getElementById("themeSelect");
  if (sel) sel.value = theme;
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "trello";
  applyTheme(saved);
  const sel = document.getElementById("themeSelect");
  if (sel) {
    sel.addEventListener("change", e => applyTheme(e.target.value));
  }
}

// ======================
// URL helper
// ======================

function getQueryParam(name) {
  const p = new URLSearchParams(window.location.search);
  return p.get(name);
}
