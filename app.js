/* =========================================================
   拾页 · reading archive
   A small, self-contained reading tracker.
   ========================================================= */

(() => {
  "use strict";

  /* ---------- Constants ---------- */

  const STORAGE_KEY = "shiye.reader.v1";
  const TRANSLATION_STORAGE_KEY = "shiye.reader.translation.v1";
  const APP_VERSION = 2;
  const DEMO_CLEANUP_VERSION = 2;
  const YEAR = new Date().getFullYear();
  const TODAY = startOfDay(new Date());
  const TODAY_KEY = dateKey(TODAY);
  const VIEWS = ["overview", "shelf", "categories", "translate", "achievements"];
  const MAX_TRANSLATION_CHARS = 8000;
  const MAX_TRANSLATION_UNITS = 60;
  const MONTH_NAMES = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
  const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];
  const NUMBER_FORMAT = new Intl.NumberFormat("zh-CN");
  const SERIF_FONT = '"Songti SC", "STSong", "Source Han Serif SC", "Noto Serif CJK SC", "SimSun", serif';

  const STATUS_META = {
    reading: { label: "在读", className: "is-reading" },
    read: { label: "已读", className: "is-read" },
    want: { label: "想读", className: "" },
  };

  const COVER_THEMES = [
    { id: "forest", name: "苔绿" },
    { id: "clay", name: "陶土" },
    { id: "ink", name: "墨黑" },
    { id: "sand", name: "沙金" },
    { id: "sky", name: "雾蓝" },
    { id: "plum", name: "梅紫" },
  ];

  const CATEGORY_PALETTE = [
    { color: "#66785c", soft: "#e8eee3" },
    { color: "#b2775b", soft: "#f5e7df" },
    { color: "#526776", soft: "#e8eef1" },
    { color: "#a18450", soft: "#f3ecdd" },
    { color: "#876b7c", soft: "#f1e9ed" },
    { color: "#5b7b7f", soft: "#e6eff0" },
    { color: "#7c7460", soft: "#eeebe1" },
    { color: "#8f5f58", soft: "#f3e6e3" },
  ];

  const LEVELS = [
    { name: "初读者", min: 0 },
    { name: "书页旅人", min: 5 },
    { name: "藏书家", min: 10 },
    { name: "阅读家", min: 20 },
    { name: "书房主人", min: 40 },
  ];

  const SOURCE_LANGUAGES = [
    { id: "en", label: "英语", short: "EN" },
    { id: "ja", label: "日语", short: "JA" },
    { id: "fr", label: "法语", short: "FR" },
    { id: "de", label: "德语", short: "DE" },
    { id: "es", label: "西班牙语", short: "ES" },
    { id: "ko", label: "韩语", short: "KO" },
    { id: "auto", label: "自动检测", short: "AUTO" },
  ];

  const TARGET_LANGUAGES = [
    { id: "zh-CN", label: "简体中文", short: "中文" },
    { id: "zh-TW", label: "繁體中文", short: "繁中" },
    { id: "en", label: "英语", short: "EN" },
    { id: "ja", label: "日本語", short: "JA" },
  ];

  const PART_OF_SPEECH_ZH = {
    noun: "名词",
    verb: "动词",
    adjective: "形容词",
    adverb: "副词",
    pronoun: "代词",
    preposition: "介词",
    conjunction: "连词",
    interjection: "感叹词",
    determiner: "限定词",
    exclamation: "感叹词",
  };

  const ICON_PATHS = {
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    books: '<path d="M4 19.5V4.8A1.8 1.8 0 0 1 5.8 3h12.4A1.8 1.8 0 0 1 20 4.8v14.7"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M8 7h8M8 10.5h5"/>',
    layers: '<path d="m12 3 8.5 4.6L12 12.2 3.5 7.6 12 3Z"/><path d="m4.4 11.4 7.6 4.1 7.6-4.1"/><path d="m4.4 15.5 7.6 4.1 7.6-4.1"/>',
    trophy: '<path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a3 3 0 0 0 3 3.2M16 6h3a3 3 0 0 1-3 3.2"/><path d="M12 12.5V16M9 20h6M10 20v-2.2h4V20"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    upload: '<path d="M12 16V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 14.5v3A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-3"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.1 4.1"/>',
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "arrow-up-right": '<path d="M7 17 17 7M8 7h9v9"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    sliders: '<path d="M4 7h8M16 7h4M4 17h4M12 17h8"/><circle cx="14" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    book: '<path d="M4.5 5.8A2.3 2.3 0 0 1 6.8 3.5H19v16.2H7a2.5 2.5 0 0 0-2.5 2.5V5.8Z"/><path d="M4.5 19.3A2.5 2.5 0 0 1 7 16.8h12M8 7.4h7M8 10.5h4"/>',
    "book-open": '<path d="M4.5 6.1c2.7-.9 5.2-.3 7.5 1.4v11c-2.3-1.7-4.8-2.3-7.5-1.4V6.1Z"/><path d="M19.5 6.1c-2.7-.9-5.2-.3-7.5 1.4v11c2.3-1.7 4.8-2.3 7.5-1.4V6.1Z"/>',
    pages: '<path d="M7 3.5h7l4 4v13H7v-17Z"/><path d="M14 3.5v4.2h4M10 12h5M10 15.5h5"/>',
    flame: '<path d="M12.2 21c-3.7 0-6.4-2.5-6.4-6.1 0-2.5 1.5-4.6 3.1-6.1.2 2 1.1 3.1 2.2 3.7.3-3.3 2.1-6.1 4.7-8.1.1 3.1 1.2 4.6 2.4 6.1 1 1.3 1.5 2.6 1.5 4.2 0 3.8-2.8 6.3-7.5 6.3Z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none"/>',
    check: '<path d="m5 12.5 4.2 4.2L19 6.9"/>',
    edit: '<path d="m14.5 5.2 1.8-1.8a1.8 1.8 0 0 1 2.5 0l1.8 1.8a1.8 1.8 0 0 1 0 2.5l-1.8 1.8"/><path d="m14.5 5.2-9.7 9.7L3.5 20l5.1-1.3 9.7-9.7"/>',
    trash: '<path d="M4.5 7h15M9 7V4.5h6V7M6.5 7l.7 12.5h9.6L17.5 7M10 10.5v5.5M14 10.5v5.5"/>',
    download: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 17v3h15v-3"/>',
    refresh: '<path d="M20 8.5A8.5 8.5 0 1 0 19.2 16"/><path d="M20 3.5v5h-5"/>',
    languages: '<path d="M3.5 5.5h8M7.5 3.5v2M5.5 5.5c.5 3.3 2.2 5.9 5 7.6M11 5.5c-.5 3.2-2 5.8-4.4 7.8"/><path d="m13.3 20.5 3.4-8.5 3.4 8.5M14.5 17.5h4.4"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
    volume: '<path d="M4 9h4l5-4v14l-5-4H4V9Z"/><path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10"/>',
    leaf: '<path d="M19.5 4.5C11 4.3 5 7.6 5 13.1c0 2.9 2.1 5 5 5 5.6 0 9.3-6.3 9.5-13.6Z"/><path d="M4 20c2-5.3 5.5-8.8 10.2-11.4"/>',
    sprout: '<path d="M12 21v-7.2"/><path d="M12 14.2c-4.6.1-7.3-2.4-7.1-6.8 4.5-.2 7.2 2.4 7.1 6.8Z"/><path d="M12 11.1c.2-4.6 2.9-7.1 7.2-6.7.1 4.3-2.6 6.9-7.2 6.7Z"/>',
    compass: '<circle cx="12" cy="12" r="8.6"/><path d="m15.8 8.2-2.2 5.4-5.4 2.2 2.2-5.4 5.4-2.2Z"/>',
    heart: '<path d="M20.2 8.8c0 5.7-8.2 10-8.2 10s-8.2-4.3-8.2-10a4.4 4.4 0 0 1 8.2-2.3 4.4 4.4 0 0 1 8.2 2.3Z"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="m7.5 15 3.3-4.1 3 2.2 4.7-6.1"/>',
    pen: '<path d="m14.4 5.3 1.7-1.7a1.9 1.9 0 0 1 2.7 0l1.6 1.6a1.9 1.9 0 0 1 0 2.7l-1.7 1.7"/><path d="m14.4 5.3-9.1 9.1-1.3 5.2 5.2-1.3 9.1-9.1M4 20h16"/>',
    atom: '<circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="9" ry="3.8"/><ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)"/>',
    bookmark: '<path d="M6.5 4h11v16.5L12 16.7l-5.5 3.8V4Z"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    star: '<path d="m12 3.4 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.4Z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17"/><path d="M8 13h.1M12 13h.1M16 13h.1M8 16.5h.1M12 16.5h.1"/>',
    quote: '<path d="M9.2 5.5C6.1 6.7 4.3 9.2 4.3 12.4c0 3.4 1.8 5.6 4.4 5.6 2.1 0 3.6-1.5 3.6-3.6 0-2-1.4-3.4-3.3-3.4-.4 0-.8.1-1 .2.4-1.6 1.7-3.1 3.6-3.9l-2.4-1.8Z"/><path d="M18.8 5.5c-3.1 1.2-4.9 3.7-4.9 6.9 0 3.4 1.8 5.6 4.4 5.6 2.1 0 3.6-1.5 3.6-3.6 0-2-1.4-3.4-3.3-3.4-.4 0-.8.1-1 .2.4-1.6 1.7-3.1 3.6-3.9l-2.4-1.8Z"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 10.5v6M12 7.5h.1"/>',
    sparkles: '<path d="m12 3 1.5 4.3L18 9l-4.5 1.7L12 15l-1.5-4.3L6 9l4.5-1.7L12 3Z"/><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>',
    user: '<circle cx="12" cy="8.2" r="3.8"/><path d="M4.8 20.2c.6-4 3.6-6.2 7.2-6.2s6.6 2.2 7.2 6.2"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.2 2"/>',
  };

  /* ---------- Tiny utilities ---------- */

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function startOfDay(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function addDays(date, amount) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  function parseDay(key) {
    if (!key || typeof key !== "string") return null;
    const parts = key.slice(0, 10).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function offsetDay(offset) {
    return dateKey(addDays(TODAY, -offset));
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return entities[character];
    });
  }

  function formatNumber(value) {
    return NUMBER_FORMAT.format(Math.round(Number(value) || 0));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function uid(prefix = "id") {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function tint(hex, alpha) {
    const clean = String(hex || "").replace("#", "");
    if (clean.length !== 6) return `rgba(65, 89, 71, ${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function icon(name, className = "") {
    const body = ICON_PATHS[name] || ICON_PATHS.book;
    return `<span class="icon ${className}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${body}</svg></span>`;
  }

  function svgMarkup(name) {
    const body = ICON_PATHS[name] || ICON_PATHS.book;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  function hydrateIcons(root = document) {
    root.querySelectorAll("[data-icon]").forEach((element) => {
      element.innerHTML = svgMarkup(element.dataset.icon);
    });
  }

  function greetingForHour(hour) {
    if (hour < 5) return "夜深了";
    if (hour < 11) return "早上好";
    if (hour < 13) return "中午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  }

  function formatFullDate(key) {
    const day = parseDay(key);
    if (!day) return "日期未知";
    return `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日`;
  }

  function formatMonthDay(key) {
    const day = parseDay(key);
    if (!day) return "";
    return `${day.getMonth() + 1}月${day.getDate()}日`;
  }

  function relativeDay(key) {
    const day = parseDay(key);
    if (!day) return "最近";
    const diff = Math.round((TODAY - startOfDay(day)) / 86400000);
    if (diff <= 0) return "今天";
    if (diff === 1) return "昨天";
    if (diff < 7) return `${diff} 天前`;
    if (diff < 30) return `${Math.max(1, Math.round(diff / 7))} 周前`;
    return formatMonthDay(key);
  }

  function daysBetween(start, end) {
    const a = parseDay(start);
    const b = parseDay(end);
    if (!a || !b) return 0;
    return Math.max(0, Math.round((startOfDay(b) - startOfDay(a)) / 86400000));
  }

  /* ---------- Motifs & covers ---------- */

  const MOTIFS = {
    forest: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true">
      <circle cx="68" cy="34" r="22" opacity=".9"/>
      <circle cx="68" cy="34" r="13" opacity=".55"/>
      <path d="M8 83h84" opacity=".55"/>
      <path d="M54 83c0-20 12-31 31-32" opacity=".45"/>
    </svg>`,
    clay: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.15" aria-hidden="true">
      <path d="M23 86V47c0-14 12-25 27-25s27 11 27 25v39" opacity=".8"/>
      <path d="M35 86V49c0-8 7-14 15-14s15 6 15 14v37" opacity=".5"/>
      <path d="M8 86h84" opacity=".35"/>
    </svg>`,
    ink: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
      <path d="M16 30h68M16 39h54M16 48h68M16 57h42M16 66h60M16 75h30" opacity=".65"/>
      <circle cx="77" cy="70" r="6" fill="currentColor" opacity=".45" stroke="none"/>
    </svg>`,
    sand: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true">
      <circle cx="64" cy="43" r="25" fill="currentColor" opacity=".2" stroke="none"/>
      <circle cx="64" cy="43" r="25" opacity=".7"/>
      <path d="M12 84h78M20 91h62" opacity=".45"/>
      <path d="M25 63c9-7 17-7 26 0s17 7 26 0" opacity=".55"/>
    </svg>`,
    sky: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true">
      <path d="M8 38c12-10 24-10 36 0s24 10 36 0 24-10 36 0" opacity=".6"/>
      <path d="M0 56c12-10 24-10 36 0s24 10 36 0 24-10 36 0" opacity=".4"/>
      <path d="M8 74c12-10 24-10 36 0s24 10 36 0 24-10 36 0" opacity=".26"/>
      <circle cx="72" cy="24" r="7" opacity=".8"/>
    </svg>`,
    plum: `<svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
      <circle cx="22" cy="29" r="2" opacity=".5"/><circle cx="42" cy="29" r="2" opacity=".35"/><circle cx="62" cy="29" r="2" opacity=".2"/>
      <circle cx="22" cy="49" r="2" opacity=".35"/><circle cx="42" cy="49" r="2" opacity=".2"/><circle cx="62" cy="49" r="2" opacity=".12"/>
      <circle cx="22" cy="69" r="2" opacity=".2"/><circle cx="42" cy="69" r="2" opacity=".12"/><circle cx="62" cy="69" r="2" opacity=".08"/>
      <circle cx="80" cy="58" r="18" fill="none" stroke="currentColor" stroke-width="1" opacity=".5"/>
      <circle cx="80" cy="58" r="11" fill="none" stroke="currentColor" stroke-width="1" opacity=".3"/>
    </svg>`,
  };

  function coverMarkup(book, category) {
    const theme = COVER_THEMES.some((entry) => entry.id === book.theme) ? book.theme : "forest";
    const title = book.title || "未命名";
    const author = book.author || "佚名";
    const length = Array.from(title).length;
    const titleClass = length > 11 ? "is-long" : length > 7 ? "is-medium" : "";
    const categoryName = category ? category.name : "未分类";
    return `<div class="book-cover theme-${theme}" role="img" aria-label="《${escapeHTML(title)}》封面">
      <span class="cover-spine" aria-hidden="true"></span>
      <div class="cover-content">
        <div class="cover-kicker"><span>${escapeHTML(categoryName)}</span><span>SHIYE</span></div>
        <div class="cover-title ${titleClass}">${escapeHTML(title)}</div>
        <span class="cover-mini-mark" aria-hidden="true">${escapeHTML(Array.from(title)[0] || "书")}</span>
        <div class="cover-motif" aria-hidden="true">${MOTIFS[theme] || MOTIFS.forest}</div>
        <div class="cover-footer"><span>${escapeHTML(author)}</span><span>READ</span></div>
      </div>
    </div>`;
  }

  /* ---------- Seed data ---------- */

  function createLegacySeedActivity(anchor = new Date()) {
    const end = startOfDay(anchor);
    const activity = {};
    const yearStart = new Date(end.getFullYear(), 0, 1);
    const totalDays = Math.round((end - yearStart) / 86400000) + 1;
    let randomState = end.getFullYear() * 7919 + 37;
    const random = () => {
      randomState = (randomState * 48271) % 2147483647;
      return randomState / 2147483647;
    };

    for (let index = 0; index < totalDays; index += 1) {
      const daysAgo = totalDays - 1 - index;
      let active = random() < 0.43;
      if (daysAgo < 12) active = true;
      if (daysAgo === 12) active = false;
      if (daysAgo >= 55 && daysAgo <= 75) active = true;
      if (!active) continue;

      let minutes = 15 + Math.round(random() * 58);
      let pages = Math.max(3, Math.round(minutes * 0.9));
      if (daysAgo === 0) {
        minutes = 34;
        pages = 26;
      }
      const day = addDays(yearStart, index);
      activity[dateKey(day)] = { minutes, pages };
    }

    activity[dateKey(end)] = { minutes: 34, pages: 26 };
    return activity;
  }

  function seedState() {
    const categories = [
      { id: "literature", name: "文学小说", color: "#66785c", soft: "#e8eee3", icon: "book" },
      { id: "psychology", name: "心理成长", color: "#b2775b", soft: "#f5e7df", icon: "heart" },
      { id: "business", name: "商业思维", color: "#526776", soft: "#e8eef1", icon: "chart" },
      { id: "history", name: "历史人文", color: "#a18450", soft: "#f3ecdd", icon: "compass" },
      { id: "design", name: "设计美学", color: "#876b7c", soft: "#f1e9ed", icon: "pen" },
      { id: "science", name: "科学科技", color: "#5b7b7f", soft: "#e6eff0", icon: "atom" },
    ];

    return {
      version: APP_VERSION,
      profile: { name: "读者", yearlyGoal: 24 },
      categories,
      books: [],
      activity: {},
      seenAchievements: null,
      createdAt: new Date().toISOString(),
      demoCleanupVersion: DEMO_CLEANUP_VERSION,
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.books) || !Array.isArray(raw.categories)) {
      return null;
    }

    const categories = raw.categories
      .filter((category) => category && category.id && category.name)
      .map((category, index) => {
        const fallback = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
        return {
          id: String(category.id),
          name: String(category.name).slice(0, 12),
          color: /^#[0-9a-f]{6}$/i.test(category.color || "") ? category.color : fallback.color,
          soft: /^#[0-9a-f]{6}$/i.test(category.soft || "") ? category.soft : fallback.soft,
          icon: ICON_PATHS[category.icon] ? category.icon : "bookmark",
        };
      });

    if (!categories.length) return null;
    const categoryIds = new Set(categories.map((category) => category.id));

    const books = raw.books
      .filter((book) => book && book.title)
      .map((book, index) => {
        const pages = clamp(Number(book.pages) || 1, 1, 5000);
        const status = ["reading", "read", "want"].includes(book.status) ? book.status : "want";
        const progress = status === "read" ? pages : clamp(Number(book.progress) || 0, 0, pages);
        const ebook = book.ebook && typeof book.ebook === "object"
          ? {
            format: ["epub", "txt"].includes(book.ebook.format) ? book.ebook.format : "epub",
            fileName: String(book.ebook.fileName || "").slice(0, 160),
            chapterCount: clamp(Number(book.ebook.chapterCount) || 1, 1, 2000),
            language: String(book.ebook.language || "").slice(0, 20),
          }
          : null;
        const readingPercent = ebook
          ? (status === "read" ? 100 : clamp(Number(book.readingPercent) || 0, 0, 100))
          : 0;
        return {
          id: String(book.id || `book-restored-${index}`),
          title: String(book.title).slice(0, 80),
          author: String(book.author || "佚名").slice(0, 80),
          categoryId: categoryIds.has(book.categoryId) ? book.categoryId : categories[0].id,
          pages,
          progress,
          status,
          theme: COVER_THEMES.some((entry) => entry.id === book.theme) ? book.theme : "forest",
          rating: clamp(Number(book.rating) || 0, 0, 5),
          addedAt: parseDay(book.addedAt) ? book.addedAt : TODAY_KEY,
          startedAt: parseDay(book.startedAt) ? book.startedAt : null,
          finishedAt: parseDay(book.finishedAt) ? book.finishedAt : null,
          lastReadAt: parseDay(book.lastReadAt) ? book.lastReadAt : null,
          ebook,
          readingPercent,
          readerChapter: ebook ? clamp(Number(book.readerChapter) || 0, 0, Math.max(0, ebook.chapterCount - 1)) : 0,
          readerScroll: ebook ? clamp(Number(book.readerScroll) || 0, 0, 1) : 0,
        };
      });

    const activity = {};
    if (raw.activity && typeof raw.activity === "object") {
      Object.entries(raw.activity).forEach(([key, value]) => {
        if (!parseDay(key) || !value || typeof value !== "object") return;
        activity[key] = {
          minutes: clamp(Number(value.minutes) || 0, 0, 1440),
          pages: clamp(Number(value.pages) || 0, 0, 2000),
        };
      });
    }

    return {
      version: APP_VERSION,
      profile: {
        name: String(raw.profile?.name || "读者").slice(0, 18),
        yearlyGoal: clamp(Number(raw.profile?.yearlyGoal) || 24, 1, 365),
      },
      categories,
      books,
      activity,
      seenAchievements: Array.isArray(raw.seenAchievements) ? raw.seenAchievements.filter((id) => typeof id === "string") : null,
      createdAt: raw.createdAt || new Date().toISOString(),
      demoCleanupVersion: clamp(Number(raw.demoCleanupVersion) || 1, 1, DEMO_CLEANUP_VERSION),
    };
  }

  function isLegacySampleBook(book) {
    if (!book) return false;
    if (/^book-(?:seed|reading|want)-\d+$/.test(book.id)) return true;
    if (book.ebook?.fileName === "walden-sample.epub") return true;
    return book.title === "瓦尔登湖 · 节选";
  }

  function cleanupLegacyDemoState(normalized, raw) {
    const cleanupIds = [];
    const beforeBooks = normalized.books.length;
    normalized.books = normalized.books.filter((book) => {
      if (!isLegacySampleBook(book)) return true;
      if (book.ebook) cleanupIds.push(book.id);
      return false;
    });

    let removedActivity = false;
    const needsDemoActivityCleanup = (Number(raw.demoCleanupVersion) || 1) < DEMO_CLEANUP_VERSION;
    const seedDate = new Date(normalized.createdAt);
    if (needsDemoActivityCleanup && !Number.isNaN(seedDate.getTime())) {
      const seededActivity = createLegacySeedActivity(seedDate);
      Object.keys(normalized.activity).forEach((key) => {
        const seeded = seededActivity[key];
        const current = normalized.activity[key];
        if (seeded && current && current.minutes === seeded.minutes && current.pages === seeded.pages) {
          delete normalized.activity[key];
          removedActivity = true;
        }
      });
    }

    const wasLegacy = (Number(raw.version) || 1) < APP_VERSION;
    const removedDemoContent = beforeBooks !== normalized.books.length || removedActivity;
    const changed = removedDemoContent || wasLegacy || raw.demoCleanupVersion !== DEMO_CLEANUP_VERSION;
    if (wasLegacy || removedDemoContent) {
      normalized.seenAchievements = null;
    }
    if (removedDemoContent) {
      window.__shiyeDemoCleaned = true;
    }
    normalized.demoCleanupVersion = DEMO_CLEANUP_VERSION;
    normalized.version = APP_VERSION;
    if (cleanupIds.length) {
      window.__shiyeCleanupEbookIds = Array.from(new Set([
        ...(Array.isArray(window.__shiyeCleanupEbookIds) ? window.__shiyeCleanupEbookIds : []),
        ...cleanupIds,
      ]));
    }
    if (changed) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        // The in-memory cleanup still applies for this session.
      }
    }
    return normalized;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const normalized = normalizeState(parsed);
        if (normalized) return cleanupLegacyDemoState(normalized, parsed);
      }
    } catch (error) {
      // A file:// preview may not have storage. The app still works in memory.
    }
    return seedState();
  }

  let state = loadState();
  let storageWorks = true;
  let overlayOpen = false;
  let overlayCloseTimer = 0;
  let lastFocusedElement = null;
  let toastTimerSequence = 0;

  const ui = {
    view: VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview",
    shelfStatus: "all",
    shelfCategory: "all",
    query: "",
    sort: "recent",
  };

  function createEmptyTranslationState() {
    return {
      sourceText: "",
      from: "en",
      to: "zh-CN",
      paragraphs: [],
      translations: [],
      detected: "",
      providers: [],
      status: "idle",
      error: "",
      showEditor: true,
      updatedAt: 0,
    };
  }

  function loadTranslationDraft() {
    try {
      const raw = localStorage.getItem(TRANSLATION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.sourceText !== "string") return null;
      const sourceText = parsed.sourceText.slice(0, MAX_TRANSLATION_CHARS);
      if (sourceText.startsWith("I went to the woods because I wished to live deliberately") && sourceText.length < 1200) {
        try {
          localStorage.removeItem(TRANSLATION_STORAGE_KEY);
        } catch {
          // Ignore storage failures.
        }
        return null;
      }
      const from = SOURCE_LANGUAGES.some((language) => language.id === parsed.from) ? parsed.from : "en";
      const to = TARGET_LANGUAGES.some((language) => language.id === parsed.to) ? parsed.to : "zh-CN";
      const paragraphs = Array.isArray(parsed.paragraphs)
        ? parsed.paragraphs.filter((paragraph) => typeof paragraph === "string").slice(0, MAX_TRANSLATION_UNITS)
        : [];
      const translations = Array.isArray(parsed.translations)
        ? parsed.translations
          .slice(0, paragraphs.length)
          .map((translation) => (typeof translation === "string" ? translation : null))
        : [];
      while (translations.length < paragraphs.length) translations.push(null);
      const hasTranslation = paragraphs.length > 0 && translations.some((translation) => translation && translation.trim());
      if (!sourceText && !hasTranslation) return null;
      return {
        sourceText,
        from,
        to,
        paragraphs,
        translations,
        detected: typeof parsed.detected === "string" ? parsed.detected : "",
        providers: Array.isArray(parsed.providers) ? parsed.providers.filter((provider) => typeof provider === "string").slice(0, 4) : [],
        status: hasTranslation ? "done" : "idle",
        error: "",
        showEditor: !hasTranslation,
        updatedAt: Number(parsed.updatedAt) || 0,
      };
    } catch {
      return null;
    }
  }

  const translateState = loadTranslationDraft() || createEmptyTranslationState();
  const dictionaryState = {
    word: "",
    context: "",
    status: "idle",
    result: null,
    error: "",
  };
  let dictionaryRequestId = 0;
  let translateSaveTimer = 0;
  let selectionToolState = null;

  /* ---------- Persistence ---------- */

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageWorks = true;
    } catch (error) {
      storageWorks = false;
    }
  }

  function initializeAchievementHistory() {
    if (Array.isArray(state.seenAchievements)) return;
    state.seenAchievements = getAchievements()
      .filter((achievement) => achievement.unlocked)
      .map((achievement) => achievement.id);
    persist();
  }

  /* ---------- Derived reading data ---------- */

  function getCategoryMap() {
    return new Map(state.categories.map((category) => [category.id, category]));
  }

  function getCategory(categoryId) {
    return state.categories.find((category) => category.id === categoryId) || state.categories[0];
  }

  function getBook(bookId) {
    return state.books.find((book) => book.id === bookId);
  }

  function isEbook(book) {
    return Boolean(book?.ebook);
  }

  function getBookPercent(book) {
    if (!book) return 0;
    if (book.ebook) {
      return book.status === "read" ? 100 : Math.round(clamp(Number(book.readingPercent) || 0, 0, 100));
    }
    return book.pages > 0 ? clamp(Math.round((book.progress / book.pages) * 100), 0, 100) : 0;
  }

  function getBookPagesRead(book) {
    if (!book) return 0;
    if (book.ebook) return Math.round(book.pages * (getBookPercent(book) / 100));
    return book.status === "read" ? book.pages : book.progress;
  }

  function syncEbookProgress(book) {
    if (!book?.ebook) return;
    book.progress = clamp(Math.round(book.pages * (getBookPercent(book) / 100)), 0, book.pages);
  }

  function getReadBooks() {
    return state.books.filter((book) => book.status === "read");
  }

  function getReadingBooks() {
    return state.books
      .filter((book) => book.status === "reading")
      .sort((a, b) => String(b.lastReadAt || "").localeCompare(String(a.lastReadAt || "")));
  }

  function getReadThisYear() {
    return getReadBooks().filter((book) => {
      const day = parseDay(book.finishedAt);
      return day && day.getFullYear() === YEAR;
    });
  }

  function getTotalPagesRead() {
    return state.books.reduce((sum, book) => {
      if (book.status === "read") return sum + book.pages;
      if (book.status === "reading") return sum + getBookPagesRead(book);
      return sum;
    }, 0);
  }

  function getTotalMinutes() {
    return Object.values(state.activity).reduce((sum, entry) => sum + (Number(entry?.minutes) || 0), 0);
  }

  function getCurrentStreak() {
    let cursor = startOfDay(new Date());
    if (!(state.activity[dateKey(cursor)]?.minutes > 0)) {
      cursor = addDays(cursor, -1);
    }
    let streak = 0;
    while (state.activity[dateKey(cursor)]?.minutes > 0) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function getLongestStreak() {
    const keys = Object.keys(state.activity)
      .filter((key) => state.activity[key]?.minutes > 0 && parseDay(key))
      .sort();
    if (!keys.length) return 0;
    const end = startOfDay(new Date());
    let cursor = startOfDay(parseDay(keys[0]));
    let run = 0;
    let longest = 0;
    while (cursor <= end) {
      if (state.activity[dateKey(cursor)]?.minutes > 0) {
        run += 1;
        longest = Math.max(longest, run);
      } else {
        run = 0;
      }
      cursor = addDays(cursor, 1);
    }
    return longest;
  }

  function getMonthActiveDays() {
    const now = new Date();
    let activeDays = 0;
    for (let day = 1; day <= now.getDate(); day += 1) {
      const key = dateKey(new Date(now.getFullYear(), now.getMonth(), day));
      if (state.activity[key]?.minutes > 0) activeDays += 1;
    }
    return activeDays;
  }

  function getLastSevenDays() {
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(TODAY, index - 6);
      const key = dateKey(day);
      return {
        key,
        label: WEEKDAY_SHORT[day.getDay()],
        minutes: state.activity[key]?.minutes || 0,
        isToday: key === TODAY_KEY,
      };
    });
  }

  function getWeekMinutes() {
    return Array.from({ length: 7 }, (_, index) => {
      const key = dateKey(addDays(TODAY, -index));
      return state.activity[key]?.minutes || 0;
    }).reduce((sum, minutes) => sum + minutes, 0);
  }

  function getPreviousWeekMinutes() {
    return Array.from({ length: 7 }, (_, index) => {
      const key = dateKey(addDays(TODAY, -(index + 7)));
      return state.activity[key]?.minutes || 0;
    }).reduce((sum, minutes) => sum + minutes, 0);
  }

  function getUnlockedAchievements() {
    return getAchievements().filter((achievement) => achievement.unlocked);
  }

  function getAchievements() {
    const readBooks = getReadBooks();
    const readCount = readBooks.length;
    const totalPages = getTotalPagesRead();
    const longestStreak = getLongestStreak();
    const readCategories = new Set(readBooks.map((book) => book.categoryId));
    const seen = new Set(Array.isArray(state.seenAchievements) ? state.seenAchievements : []);

    const definitions = [
      {
        id: "first-book",
        title: "初次相遇",
        description: "读完第一本书，故事从这里开始。",
        icon: "sprout",
        current: readCount,
        target: 1,
        unit: "本",
      },
      {
        id: "five-books",
        title: "渐入佳境",
        description: "累计读完 5 本书，阅读开始有了节奏。",
        icon: "book-open",
        current: readCount,
        target: 5,
        unit: "本",
      },
      {
        id: "ten-books",
        title: "十本俱乐部",
        description: "累计读完 10 本书，你已经走得很远。",
        icon: "layers",
        current: readCount,
        target: 10,
        unit: "本",
      },
      {
        id: "twenty-five-books",
        title: "藏书渐丰",
        description: "累计读完 25 本书，把阅读变成生活。",
        icon: "books",
        current: readCount,
        target: 25,
        unit: "本",
      },
      {
        id: "seven-day",
        title: "七日之约",
        description: "连续阅读 7 天，让翻页成为习惯。",
        icon: "flame",
        current: longestStreak,
        target: 7,
        unit: "天",
      },
      {
        id: "thirty-day",
        title: "月度恒心",
        description: "连续阅读 30 天，把时间读成自己的。",
        icon: "calendar",
        current: longestStreak,
        target: 30,
        unit: "天",
      },
      {
        id: "five-genres",
        title: "博览群书",
        description: "在 5 个分类里留下过读完的书。",
        icon: "compass",
        current: readCategories.size,
        target: 5,
        unit: "类",
      },
      {
        id: "ten-thousand-pages",
        title: "一万页旅程",
        description: "累计阅读 10,000 页，路还很长。",
        icon: "pages",
        current: totalPages,
        target: 10000,
        unit: "页",
      },
    ];

    return definitions.map((achievement) => {
      const calculatedUnlocked = achievement.current >= achievement.target;
      const unlocked = calculatedUnlocked || seen.has(achievement.id);
      return {
        ...achievement,
        unlocked,
        progress: unlocked ? 100 : clamp((achievement.current / achievement.target) * 100, 0, 100),
      };
    });
  }

  function getNextAchievement() {
    return getAchievements()
      .filter((achievement) => !achievement.unlocked)
      .sort((a, b) => b.progress - a.progress)[0] || null;
  }

  function getLevel() {
    const readCount = getReadBooks().length;
    let index = 0;
    LEVELS.forEach((level, levelIndex) => {
      if (readCount >= level.min) index = levelIndex;
    });
    const current = LEVELS[index];
    const next = LEVELS[index + 1] || null;
    const progress = next
      ? clamp((readCount - current.min) / (next.min - current.min), 0, 1)
      : 1;
    return {
      index,
      name: current.name,
      readCount,
      next,
      progress,
      remaining: next ? Math.max(0, next.min - readCount) : 0,
    };
  }

  function getCategoryStats() {
    const map = new Map(state.categories.map((category) => [
      category.id,
      {
        ...category,
        count: 0,
        read: 0,
        reading: 0,
        want: 0,
        pages: 0,
      },
    ]));

    state.books.forEach((book) => {
      const entry = map.get(book.categoryId);
      if (!entry) return;
      entry.count += 1;
      entry[book.status] += 1;
      entry.pages += book.status === "read" ? book.pages : book.status === "reading" ? book.progress : 0;
    });

    return Array.from(map.values());
  }

  function addActivity(pages, minutes) {
    const entry = state.activity[TODAY_KEY] || { minutes: 0, pages: 0 };
    entry.pages += Math.max(0, Math.round(pages));
    entry.minutes += Math.max(0, Math.round(minutes));
    state.activity[TODAY_KEY] = entry;
  }

  /* ---------- Goal & streak pieces ---------- */

  function goalCopy() {
    const count = getReadThisYear().length;
    const goal = state.profile.yearlyGoal;
    const rawPercent = goal > 0 ? (count / goal) * 100 : 0;
    const visualPercent = clamp(rawPercent, 0, 100);
    return {
      count,
      goal,
      percent: Math.round(rawPercent),
      visualPercent,
      remaining: Math.max(0, goal - count),
      pages: getTotalPagesRead(),
    };
  }

  function sideGoalMarkup() {
    const { count, goal, visualPercent } = goalCopy();
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - visualPercent / 100);
    return {
      label: `${count} / ${goal} 本`,
      markup: `<svg viewBox="0 0 38 38" aria-hidden="true">
        <circle cx="19" cy="19" r="${radius}" fill="none" stroke="rgba(37,39,33,.09)" stroke-width="2.3"/>
        <circle cx="19" cy="19" r="${radius}" fill="none" stroke="#5f795b" stroke-width="2.3" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"/>
      </svg><strong>${Math.min(100, Math.round(visualPercent))}%</strong>`,
    };
  }

  /* ---------- Render: header & sidebar ---------- */

  function renderHeader() {
    const now = new Date();
    const greeting = greetingForHour(now.getHours());
    const name = state.profile.name || "读者";
    const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 · 星期${WEEKDAY_SHORT[now.getDay()]}`;

    const todayLabel = document.getElementById("today-label");
    if (todayLabel) todayLabel.textContent = dateLabel;

    const greetingText = document.getElementById("greeting-text");
    if (greetingText) greetingText.textContent = `${greeting}，${name}`;

    const profileName = document.getElementById("profile-name");
    if (profileName) profileName.textContent = name;

    const avatar = document.getElementById("profile-avatar");
    if (avatar) avatar.textContent = Array.from(name)[0] || "拾";

    const profileNote = document.getElementById("profile-note");
    if (profileNote) {
      const hours = Math.max(0, Math.round(getTotalMinutes() / 60));
      profileNote.textContent = hours > 0 ? `已阅读 ${hours} 小时` : "阅读刚刚开始";
    }

    const shelfSubtitle = document.getElementById("shelf-subtitle");
    if (shelfSubtitle) {
      const readCount = getReadBooks().length;
      const readingCount = getReadingBooks().length;
      shelfSubtitle.textContent = `${state.books.length} 本书，${readCount} 本已读完${readingCount ? ` · ${readingCount} 本正在读` : ""}。`;
    }

    const sideGoal = sideGoalMarkup();
    const sideGoalRing = document.getElementById("side-goal-ring");
    if (sideGoalRing) sideGoalRing.innerHTML = sideGoal.markup;
    const sideGoalLabel = document.getElementById("side-goal-label");
    if (sideGoalLabel) sideGoalLabel.textContent = sideGoal.label;
  }

  function renderGoalCard() {
    const card = document.getElementById("goal-card");
    if (!card) return;
    const { count, goal, percent, visualPercent, pages } = goalCopy();
    const radius = 86;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - visualPercent / 100);
    const completed = count >= goal;
    const copy = completed
      ? "年度目标已达成，继续读下去。"
      : `再读 ${goal - count} 本，完成今年的阅读约定。`;

    card.innerHTML = `
      <div class="goal-copy">
        <div class="goal-header">
          <span class="eyebrow">${YEAR} · READING GOAL</span>
          <button class="goal-adjust" type="button" data-action="edit-goal">
            ${icon("sliders")} 调整目标
          </button>
        </div>
        <div class="goal-main-copy">
          <p class="goal-kicker">今年，已读完</p>
          <div class="goal-count"><strong>${formatNumber(count)}</strong><span>本</span></div>
          <p class="goal-sub">在 ${formatNumber(pages)} 页里，和 ${formatNumber(count)} 本书相遇。</p>
        </div>
        <div class="goal-progress">
          <div class="goal-progress-labels"><span>年度目标 ${formatNumber(goal)} 本</span><span>${percent}%</span></div>
          <div class="goal-track"><span style="width: ${visualPercent}%"></span></div>
          <p class="goal-hint">${copy}</p>
        </div>
      </div>
      <div class="goal-visual" aria-hidden="true">
        <div class="goal-ring">
          <svg class="ring-svg" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="goalRingGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#b7cba9"/>
                <stop offset="100%" stop-color="#d6c39b"/>
              </linearGradient>
            </defs>
            <circle class="ring-track" cx="100" cy="100" r="${radius}"/>
            <circle class="ring-fill" cx="100" cy="100" r="${radius}" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"/>
          </svg>
          <div class="ring-center">
            <strong>${visualPercent >= 100 ? "100" : Math.round(visualPercent)}</strong>
            <span>PERCENT</span>
            <small>${completed ? "已达成" : "进行中"}</small>
          </div>
        </div>
        <span class="goal-ring-caption">KEEP READING</span>
      </div>`;
  }

  function renderStreakCard() {
    const card = document.getElementById("streak-card");
    if (!card) return;
    const current = getCurrentStreak();
    const longest = getLongestStreak();
    const todayMinutes = state.activity[TODAY_KEY]?.minutes || 0;
    const week = getLastSevenDays();
    const note = current > 0
      ? (todayMinutes > 0 ? `今天已读 ${todayMinutes} 分钟。` : "今天还没有翻开书，读一页就好。")
      : "从今天的一页开始，重新积累。";

    card.innerHTML = `
      <div class="card-top">
        <span class="eyebrow">连续阅读</span>
        <span class="soft-pill">最长 ${longest} 天</span>
      </div>
      <div class="streak-main">
        <strong class="streak-number">${current}</strong><span class="streak-unit">天</span>
      </div>
      <p class="streak-note">${note}</p>
      <div class="week-strip">
        ${week.map((day) => `<span class="week-day${day.minutes > 0 ? " is-read" : ""}${day.isToday ? " is-today" : ""}"><i></i><span>${day.label}</span></span>`).join("")}
      </div>`;
  }

  function renderMilestoneCard() {
    const card = document.getElementById("milestone-card");
    if (!card) return;
    const achievements = getAchievements();
    const unlocked = achievements.filter((achievement) => achievement.unlocked);
    const next = getNextAchievement();
    const item = next || achievements[achievements.length - 1];
    const remaining = next ? Math.max(0, next.target - next.current) : 0;
    const progressValue = next ? Math.round(next.progress) : 100;

    card.innerHTML = `
      <div class="card-top">
        <span class="eyebrow">${next ? "下一枚徽章" : "徽章墙"}</span>
        <button class="text-link" type="button" data-view="achievements">全部 ${icon("arrow-right")}</button>
      </div>
      <div class="milestone-main">
        <span class="badge-orb">${icon(item?.icon || "trophy")}</span>
        <div class="milestone-copy">
          <h3>${next ? escapeHTML(next.title) : "全部点亮"}</h3>
          <p>${next ? escapeHTML(next.description) : "每一枚徽章，都已经属于你。"}</p>
        </div>
      </div>
      <div class="milestone-progress">
        <div class="milestone-progress-row">
          <span>${next ? `还差 ${formatNumber(remaining)} ${next.unit}` : "恭喜完成"}</span>
          <strong>${next ? `${formatNumber(Math.min(next.current, next.target))} / ${formatNumber(next.target)}` : `${unlocked.length} / ${achievements.length}`}</strong>
        </div>
        <div class="mini-track"><span style="width: ${progressValue}%"></span></div>
      </div>`;
  }

  function renderStats() {
    const panel = document.getElementById("stats-panel");
    if (!panel) return;
    const count = getReadThisYear().length;
    const pages = getTotalPagesRead();
    const hours = Math.max(0, Math.round(getTotalMinutes() / 60));
    const unlocked = getUnlockedAchievements().length;
    const stats = [
      { icon: "books", label: "今年已读", value: formatNumber(count), unit: "本", note: `共 ${state.books.length} 本藏书` },
      { icon: "pages", label: "累计页数", value: formatNumber(pages), unit: "页", note: "包含在读进度" },
      { icon: "clock", label: "阅读时长", value: formatNumber(hours), unit: "小时", note: "来自每日记录" },
      { icon: "trophy", label: "阅读徽章", value: formatNumber(unlocked), unit: "枚", note: `共 ${getAchievements().length} 枚可点亮` },
    ];

    panel.innerHTML = stats.map((stat) => `
      <div class="stat">
        <div class="stat-top">${icon(stat.icon)}${stat.label}</div>
        <div class="stat-value">${stat.value}<small>${stat.unit}</small></div>
        <p class="stat-note">${stat.note}</p>
      </div>`).join("");
  }

  /* ---------- Render: overview panels ---------- */

  function renderReadingPanel() {
    const panel = document.getElementById("reading-panel");
    if (!panel) return;
    const readingBooks = getReadingBooks();
    const visibleBooks = readingBooks.slice(0, 3);
    const categoryMap = getCategoryMap();
    const rows = visibleBooks.map((book) => {
      const category = categoryMap.get(book.categoryId) || state.categories[0];
      const percent = getBookPercent(book);
      const detail = book.ebook
        ? `第 ${Math.min(book.ebook.chapterCount, (book.readerChapter || 0) + 1)} / ${book.ebook.chapterCount} 章`
        : `${formatNumber(book.progress)} / ${formatNumber(book.pages)} 页`;
      return `<button class="reading-item" type="button" data-book="${escapeHTML(book.id)}" aria-label="查看《${escapeHTML(book.title)}》">
        <span class="reading-cover">${coverMarkup(book, category)}</span>
        <span class="reading-info">
          <span class="reading-title">${escapeHTML(book.title)}</span>
          <span class="reading-author">${escapeHTML(book.author)} · ${relativeDay(book.lastReadAt)}</span>
          <span class="reading-bar" style="--cat-color:${category.color}"><i style="width:${percent}%"></i></span>
        </span>
        <span class="reading-side"><strong>${percent}%</strong><small>${detail}</small></span>
      </button>`;
    }).join("");

    panel.innerHTML = `
      <div class="panel-head">
        <div>
          <h2>正在阅读</h2>
          <p>从上次停下的地方继续</p>
        </div>
        <button class="text-link" type="button" data-action="view-reading">全部在读 ${icon("arrow-right")}</button>
      </div>
      <div class="reading-list">
        ${rows || `<div class="empty-copy"><span class="empty-icon">${icon("book-open")}</span><p>书架里还没有在读的书。<br>添加一本，或导入你的电子书。</p><div class="empty-actions"><button class="text-link" type="button" data-action="add-book">添加一本书 ${icon("arrow-right")}</button><button class="text-link" type="button" data-action="import-ebook">导入电子书 ${icon("arrow-right")}</button></div></div>`}
      </div>
      <div class="reading-footer">
        <span>${readingBooks.length} 本正在读 · 本周 ${formatNumber(getWeekMinutes())} 分钟</span>
        <button class="text-link" type="button" data-action="view-reading">${readingBooks.length > visibleBooks.length ? `还有 ${readingBooks.length - visibleBooks.length} 本` : "管理书架"} ${icon("arrow-right")}</button>
      </div>`;
  }

  function renderHeatmap() {
    const panel = document.getElementById("heatmap-panel");
    if (!panel) return;
    const currentDay = startOfDay(new Date());
    const end = currentDay;
    const start = addDays(end, -(end.getDay() + 19 * 7));
    const cells = [];

    for (let week = 0; week < 20; week += 1) {
      for (let day = 0; day < 7; day += 1) {
        const date = addDays(start, week * 7 + day);
        const key = dateKey(date);
        const isFuture = date > end;
        const entry = state.activity[key];
        const minutes = entry?.minutes || 0;
        let level = 0;
        if (minutes > 0) level = 1;
        if (minutes > 20) level = 2;
        if (minutes > 40) level = 3;
        if (minutes > 65) level = 4;
        cells.push({
          key,
          future: isFuture,
          level,
          label: isFuture ? "" : `${date.getMonth() + 1}月${date.getDate()}日 · ${minutes ? `${minutes} 分钟` : "没有记录"}`,
        });
      }
    }

    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const weekMinutes = getWeekMinutes();
    const previousWeekMinutes = getPreviousWeekMinutes();
    const delta = weekMinutes - previousWeekMinutes;
    const insight = !weekMinutes && !previousWeekMinutes
      ? "从今天读一页，足迹就会开始生长。"
      : delta > 0
        ? `比上周多读了 ${formatNumber(delta)} 分钟，节奏很好。`
        : delta < 0
          ? "比上周慢一点也没关系，读下去就好。"
          : "和上周一样稳定，保持这个节奏。";
    const todayMinutes = state.activity[TODAY_KEY]?.minutes || 0;

    panel.innerHTML = `
      <div class="panel-head">
        <div>
          <h2>阅读足迹</h2>
          <p>过去 20 周的翻页记录</p>
        </div>
        <span class="soft-pill">本月 ${getMonthActiveDays()} 天</span>
      </div>
      <div class="heatmap-body">
        <div class="heatmap-weekdays" aria-hidden="true">${weekdays.map((day) => `<span>${day}</span>`).join("")}</div>
        <div class="heatmap-scroll">
          <div class="heatmap-grid" role="img" aria-label="最近 20 周的阅读热力图">
            ${cells.map((cell) => `<span class="heat-cell level-${cell.level}${cell.future ? " is-future" : ""}" title="${cell.label}" aria-label="${cell.label}"></span>`).join("")}
          </div>
        </div>
      </div>
      <div class="heatmap-insights">
        <div class="heatmap-stat"><span>本月阅读</span><strong>${getMonthActiveDays()}<small>天</small></strong></div>
        <div class="heatmap-stat"><span>本周投入</span><strong>${formatNumber(weekMinutes)}<small>分钟</small></strong></div>
        <p class="heatmap-note">${insight}</p>
      </div>
      <div class="heatmap-foot">
        <span>今天 <strong>${formatNumber(todayMinutes)} 分钟</strong></span>
        <span class="heat-legend">少 <i></i><i class="level-1"></i><i class="level-2"></i><i class="level-3"></i><i class="level-4"></i> 多</span>
      </div>`;
  }

  function renderCategorySummary() {
    const panel = document.getElementById("category-summary");
    if (!panel) return;
    const stats = getCategoryStats().sort((a, b) => b.count - a.count);
    const total = state.books.length;
    const categoriesWithBooks = stats.filter((category) => category.count > 0).length;
    const max = Math.max(1, ...stats.map((category) => category.count));
    const top = stats.slice(0, 4);

    panel.innerHTML = `
      <div class="panel-head">
        <div>
          <h2>阅读版图</h2>
          <p>书籍在分类里的分布</p>
        </div>
        <button class="text-link" type="button" data-view="categories">查看分类 ${icon("arrow-right")}</button>
      </div>
      <div class="category-bars">
        ${top.map((category) => `<div class="category-bar-row" style="--cat-color:${category.color}">
          <span class="category-bar-name"><i></i><span>${escapeHTML(category.name)}</span></span>
          <span class="category-bar-track"><span style="width:${(category.count / max) * 100}%"></span></span>
          <span class="category-bar-count">${category.count} 本</span>
        </div>`).join("")}
      </div>
      <div class="category-summary-foot">
        <span>${formatNumber(total)} 本书，分布在 ${categoriesWithBooks} 个分类</span>
        <span>${total ? "读得宽，也读得深" : "等待第一本书"}</span>
      </div>`;
  }

  function renderAchievementSummary() {
    const panel = document.getElementById("achievement-summary");
    if (!panel) return;
    const achievements = getAchievements();
    const unlocked = achievements.filter((achievement) => achievement.unlocked);
    const item = unlocked[unlocked.length - 1] || getNextAchievement() || achievements[0];
    const isUnlocked = Boolean(item && item.unlocked);

    panel.innerHTML = `
      <div class="panel-head">
        <div>
          <h2>${isUnlocked ? "最近点亮" : "下一枚徽章"}</h2>
          <p>让坚持留下看得见的回声</p>
        </div>
        <button class="text-link" type="button" data-view="achievements">成就墙 ${icon("arrow-right")}</button>
      </div>
      <div class="achievement-spotlight">
        <span class="badge-orb">${icon(item?.icon || "trophy")}</span>
        <div class="achievement-spotlight-copy">
          <h3>${escapeHTML(item?.title || "等待点亮")}</h3>
          <p>${isUnlocked ? "这枚徽章已经属于你。" : `${formatNumber(item?.current || 0)} / ${formatNumber(item?.target || 0)} ${item?.unit || "本"}`}</p>
        </div>
      </div>
      <div class="badge-dots" aria-hidden="true">
        ${achievements.map((achievement) => `<span class="badge-dot${achievement.unlocked ? " is-on" : ""}"></span>`).join("")}
      </div>
      <div class="achievement-summary-foot">
        <span>已点亮 ${unlocked.length} / ${achievements.length} 枚</span>
        <span>${unlocked.length ? "保持阅读，也保持好奇" : "第一枚就在不远处"}</span>
      </div>`;
  }

  /* ---------- Render: shelf ---------- */

  function getFilteredBooks() {
    const query = ui.query.trim().toLocaleLowerCase("zh-CN");
    const categoryMap = getCategoryMap();
    let books = state.books.slice();

    if (ui.shelfStatus !== "all") {
      books = books.filter((book) => book.status === ui.shelfStatus);
    }
    if (ui.shelfCategory !== "all") {
      books = books.filter((book) => book.categoryId === ui.shelfCategory);
    }
    if (query) {
      books = books.filter((book) => {
        const category = categoryMap.get(book.categoryId);
        return `${book.title} ${book.author} ${category?.name || ""}`.toLocaleLowerCase("zh-CN").includes(query);
      });
    }

    if (ui.sort === "progress") {
      books.sort((a, b) => (b.progress / b.pages) - (a.progress / a.pages));
    } else if (ui.sort === "title") {
      books.sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"));
    } else if (ui.sort === "added") {
      books.sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")));
    } else {
      books.sort((a, b) => {
        const aDate = a.lastReadAt || a.finishedAt || a.addedAt || "";
        const bDate = b.lastReadAt || b.finishedAt || b.addedAt || "";
        return String(bDate).localeCompare(String(aDate));
      });
    }
    return books;
  }

  function renderShelfTabs() {
    const counts = {
      all: state.books.length,
      reading: state.books.filter((book) => book.status === "reading").length,
      read: state.books.filter((book) => book.status === "read").length,
      want: state.books.filter((book) => book.status === "want").length,
    };
    ["all", "reading", "read", "want"].forEach((status) => {
      const count = document.getElementById(`count-${status}`);
      if (count) count.textContent = counts[status];
      const button = document.querySelector(`#status-tabs [data-status="${status}"]`);
      if (button) {
        const active = ui.shelfStatus === status;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      }
    });
  }

  function renderCategoryChips() {
    const container = document.getElementById("category-chips");
    if (!container) return;
    const counts = new Map(state.categories.map((category) => [category.id, 0]));
    state.books.forEach((book) => counts.set(book.categoryId, (counts.get(book.categoryId) || 0) + 1));

    const allChip = `<button class="chip${ui.shelfCategory === "all" ? " is-active" : ""}" type="button" data-filter-category="all" aria-pressed="${ui.shelfCategory === "all"}"><i></i>全部<span>${state.books.length}</span></button>`;
    const categoryChips = state.categories.map((category) => `
      <button class="chip${ui.shelfCategory === category.id ? " is-active" : ""}" type="button" data-filter-category="${escapeHTML(category.id)}" style="--cat-color:${category.color}" aria-pressed="${ui.shelfCategory === category.id}">
        <i></i>${escapeHTML(category.name)}<span>${counts.get(category.id) || 0}</span>
      </button>`).join("");
    container.innerHTML = allChip + categoryChips;
  }

  function renderShelfMeta() {
    const result = document.getElementById("shelf-result");
    const clear = document.getElementById("clear-filters");
    const books = getFilteredBooks();
    const labels = {
      all: "全部",
      reading: "在读",
      read: "已读",
      want: "想读",
    };
    const category = ui.shelfCategory === "all" ? null : getCategory(ui.shelfCategory);
    const filters = [];
    if (ui.shelfStatus !== "all") filters.push(labels[ui.shelfStatus]);
    if (category) filters.push(category.name);
    if (ui.query.trim()) filters.push(`“${ui.query.trim()}”`);

    if (result) {
      result.textContent = filters.length
        ? `找到 ${books.length} 本 · ${filters.join(" · ")}`
        : `共 ${books.length} 本书`;
    }
    if (clear) clear.hidden = !filters.length;
  }

  function renderBookGrid() {
    const grid = document.getElementById("book-grid");
    if (!grid) return;
    const books = getFilteredBooks();
    const categoryMap = getCategoryMap();
    const hasFilters = ui.shelfStatus !== "all" || ui.shelfCategory !== "all" || ui.query.trim().length > 0;

    if (!books.length) {
      grid.innerHTML = `<div class="book-grid-empty">
        <span class="empty-shelf-icon">${icon(hasFilters ? "search" : "books")}</span>
        <h3>${hasFilters ? "没有找到这本书" : "书架还是空的"}</h3>
        <p>${hasFilters ? "换个关键词，或者清除筛选再看看。" : "把第一本书放上书架，阅读档案就开始生长了。"}</p>
        ${hasFilters
          ? '<button class="button button--secondary" type="button" data-action="clear-filters">清除筛选</button>'
          : `<div class="empty-actions"><button class="button button--primary" type="button" data-action="add-book">${icon("plus")}添加第一本书</button><button class="button button--secondary" type="button" data-action="import-ebook">${icon("upload")}导入电子书</button></div>`}
      </div>`;
      return;
    }

    const cards = books.map((book, index) => {
      const category = categoryMap.get(book.categoryId) || state.categories[0];
      const meta = STATUS_META[book.status] || STATUS_META.want;
      const percent = getBookPercent(book);
      const readLabel = book.status === "reading" ? "继续阅读" : book.status === "read" ? "再读一次" : "开始阅读";
      return `<article class="book-card${book.ebook ? " book-card--ebook" : ""}" style="--i:${Math.min(index, 12)}; --cat-color:${category.color}">
        <button class="book-cover-button" type="button" data-book="${escapeHTML(book.id)}" aria-label="查看《${escapeHTML(book.title)}》">
          ${coverMarkup(book, category)}
          ${book.ebook ? `<span class="ebook-format-badge">${escapeHTML(book.ebook.format.toUpperCase())}</span>` : ""}
          <span class="cover-quick">查看详情 ${icon("arrow-up-right")}</span>
        </button>
        <div class="book-card-info">
          <h3 class="book-card-title">${escapeHTML(book.title)}</h3>
          <p class="book-card-author">${escapeHTML(book.author)}</p>
          <div class="book-card-meta">
            <i class="cat-dot"></i>
            <span>${escapeHTML(category.name)}</span>
            <span class="meta-sep">·</span>
            <span class="meta-state ${meta.className}">${meta.label}</span>
            <span class="meta-progress">${book.status === "want" ? "未开始" : `${percent}%`}</span>
          </div>
          <div class="book-progress"><span style="width:${percent}%"></span></div>
          ${book.ebook ? `<button class="book-read-link" type="button" data-reader-open="${escapeHTML(book.id)}">${icon("book-open")}${readLabel}</button>` : ""}
        </div>
      </article>`;
    }).join("");

    const addCard = !ui.query.trim()
      ? `<button class="add-book-card" type="button" data-action="add-book" aria-label="添加书籍">
          <span class="add-book-plus">${icon("plus")}</span>
          <strong>添加一本书</strong>
          <small>把想读的，放进自己的书架</small>
        </button>`
      : "";

    grid.innerHTML = cards + addCard;
  }

  function syncShelfControls() {
    const search = document.getElementById("shelf-search");
    if (search && search.value !== ui.query) search.value = ui.query;
    const sort = document.getElementById("shelf-sort");
    if (sort) sort.value = ui.sort;
  }

  function renderShelf() {
    renderShelfTabs();
    renderCategoryChips();
    renderShelfMeta();
    renderBookGrid();
    syncShelfControls();
  }

  /* ---------- Render: categories ---------- */

  function renderDistribution() {
    const target = document.getElementById("distribution-panel");
    if (!target) return;
    const stats = getCategoryStats().sort((a, b) => b.count - a.count);
    const total = stats.reduce((sum, category) => sum + category.count, 0);
    let cursor = 0;
    const stops = stats
      .filter((category) => category.count > 0)
      .map((category) => {
        const start = cursor;
        cursor += (category.count / total) * 100;
        return `${category.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
      })
      .join(", ");
    const gradient = stops || "#ebe7df 0 100%";
    const top = stats.find((category) => category.count > 0);
    const description = total && top
      ? `你最常停留的地方是「${escapeHTML(top.name)}」，那里有 ${top.count} 本书。`
      : "书架还很安静，先添加一本书，阅读版图就会开始生长。";

    target.innerHTML = `<section class="distribution-panel">
      <div class="distribution-visual">
        <div class="donut" style="background: conic-gradient(${gradient})" role="img" aria-label="按分类统计的藏书比例">
          <div class="donut-center"><strong>${formatNumber(total)}</strong><span>本藏书</span></div>
        </div>
      </div>
      <div class="distribution-detail">
        <p class="eyebrow">YOUR READING MAP</p>
        <h2>阅读的宽度，<br>也是世界的宽度。</h2>
        <p>${description}</p>
        <div class="distribution-legend">
          ${stats.map((category) => `<div class="legend-row" style="--cat-color:${category.color}">
            <i></i><span class="legend-name">${escapeHTML(category.name)}</span><span class="legend-count">${category.count} 本 · ${total ? Math.round((category.count / total) * 100) : 0}%</span>
          </div>`).join("")}
        </div>
      </div>
    </section>`;
  }

  function renderCategoryGrid() {
    const target = document.getElementById("category-grid");
    if (!target) return;
    const stats = getCategoryStats().sort((a, b) => b.count - a.count);
    const heights = [46, 72, 57, 88, 63, 78];
    const cards = stats.map((category) => {
      const percent = category.count ? Math.round((category.read / category.count) * 100) : 0;
      const parts = [];
      if (category.read) parts.push(`已读 ${category.read} 本`);
      if (category.reading) parts.push(`在读 ${category.reading} 本`);
      if (category.want) parts.push(`想读 ${category.want} 本`);
      const description = parts.length ? parts.join(" · ") : "还没有书，等你放入";
      const spines = Array.from({ length: Math.min(category.count, 6) }, (_, index) => `<i style="height:${heights[index]}%"></i>`).join("");
      return `<button class="category-card" type="button" data-filter-category="${escapeHTML(category.id)}" style="--cat-color:${category.color}; --cat-soft:${category.soft}; --cat-wash:${tint(category.color, 0.055)}" aria-label="查看${escapeHTML(category.name)}分类">
        <span class="category-card-top">
          <span class="category-icon">${icon(category.icon || "bookmark")}</span>
          <span class="category-count">${category.count} 本</span>
        </span>
        <span class="category-copy">
          <span class="category-name">${escapeHTML(category.name)}</span>
          <span class="category-desc">${description}</span>
        </span>
        <span class="category-spines" aria-hidden="true">${spines}</span>
        <span class="category-meter">
          <span class="category-meter-track"><span style="width:${percent}%"></span></span>
          <em>${percent}% 已读</em>
        </span>
        <span class="category-card-foot"><span>查看 ${category.count} 本</span>${icon("arrow-up-right")}</span>
      </button>`;
    }).join("");

    target.innerHTML = `${cards}
      <button class="add-category-card" type="button" data-action="add-category">
        <span>${icon("plus")}</span>
        <strong>新建一个分类</strong>
        <small>给阅读留一个新的抽屉</small>
      </button>`;
  }

  /* ---------- Render: achievements ---------- */

  function renderLevelCard() {
    const target = document.getElementById("level-card");
    if (!target) return;
    const level = getLevel();
    const readCount = getReadBooks().length;
    const pages = getTotalPagesRead();
    const longest = getLongestStreak();
    const description = level.next
      ? `再读完 ${level.remaining} 本书，进阶为「${level.next.name}」。`
      : "你已经抵达最高段位。接下来的每一页，都是额外的礼物。";
    const progressText = level.next
      ? `${level.readCount} / ${level.next.min} 本`
      : "全部达成";
    const progressWidth = Math.round(level.progress * 100);

    target.innerHTML = `<section class="level-card">
      <div class="level-copy">
        <p class="eyebrow">READING LEVEL · ${YEAR}</p>
        <div class="level-name-row">
          <span class="level-name">${level.name}</span>
          <span class="level-number">LV. ${level.index + 1}</span>
        </div>
        <p class="level-desc">${description}</p>
        <div class="level-progress">
          <div class="level-progress-row"><span>${level.next ? `距离下一段位` : "阅读段位"}</span><strong>${progressText}</strong></div>
          <div class="level-track"><span style="width:${progressWidth}%"></span></div>
        </div>
        <div class="level-stats">
          <span><strong>${readCount}</strong> 本已读</span>
          <span><strong>${formatNumber(pages)}</strong> 页</span>
          <span><strong>${longest}</strong> 天最长连续</span>
        </div>
      </div>
      <div class="level-medal-wrap" aria-hidden="true">
        <div class="level-medal">
          ${icon("trophy")}
          <span class="level-medal-caption">SHIYE · READER</span>
        </div>
      </div>
    </section>`;
  }

  function renderAchievementGrid() {
    const grid = document.getElementById("achievement-grid");
    const summary = document.getElementById("badge-summary");
    if (!grid) return;
    const achievements = getAchievements();
    const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;
    if (summary) summary.textContent = `已点亮 ${unlockedCount} / ${achievements.length} 枚阅读徽章。`;

    grid.innerHTML = achievements.map((achievement) => {
      const progressText = achievement.unlocked
        ? "已达成"
        : `${formatNumber(achievement.current)} / ${formatNumber(achievement.target)} ${achievement.unit}`;
      return `<article class="achievement-card${achievement.unlocked ? " is-unlocked" : ""}" aria-label="${escapeHTML(achievement.title)}，${achievement.unlocked ? "已解锁" : "未解锁"}">
        <div class="achievement-top">
          <span class="achievement-medal">${icon(achievement.icon)}</span>
          <span class="achievement-state"><i></i>${achievement.unlocked ? "已点亮" : "未解锁"}</span>
        </div>
        <div class="achievement-copy">
          <h3>${escapeHTML(achievement.title)}</h3>
          <p>${escapeHTML(achievement.description)}</p>
        </div>
        <div class="achievement-progress">
          <div class="achievement-progress-row"><span>${achievement.unlocked ? "完成" : "进度"}</span><strong>${progressText}</strong></div>
          <div class="achievement-track"><span style="width:${achievement.progress}%"></span></div>
        </div>
      </article>`;
    }).join("");
  }

  function renderChart() {
    const target = document.getElementById("chart-panel");
    if (!target) return;
    const counts = Array.from({ length: 12 }, () => 0);
    getReadThisYear().forEach((book) => {
      const day = parseDay(book.finishedAt);
      if (day) counts[day.getMonth()] += 1;
    });
    const max = Math.max(1, ...counts);
    const currentMonth = new Date().getMonth();
    const best = counts.reduce((result, count, index) => (count > result.count ? { count, index } : result), { count: 0, index: -1 });
    const total = counts.reduce((sum, count) => sum + count, 0);
    const note = best.count > 0
      ? `最多的是 ${best.index + 1} 月，读完 ${best.count} 本。统计自标记为「已读完」的书籍。`
      : "标记读完一本书后，这里会长出第一根柱子。";

    target.innerHTML = `<section class="chart-panel">
      <div class="chart-head">
        <div>
          <h2>年度阅读曲线</h2>
          <p>每一根柱子，都是一段安静的时间。</p>
        </div>
        <div class="chart-total">${total}<small>本 · ${YEAR}</small></div>
      </div>
      <div class="chart-area" role="img" aria-label="${YEAR} 年每月读完书籍数量">
        ${counts.map((count, index) => {
          const isCurrent = index === currentMonth;
          const isFuture = index > currentMonth;
          const height = count ? Math.max(8, (count / max) * 100) : 0;
          return `<div class="chart-column${isCurrent ? " is-current" : ""}${isFuture ? " is-future" : ""}" aria-label="${index + 1}月，${count}本">
            <span class="chart-value">${count || ""}</span>
            <div class="chart-bar-group"><span class="chart-bar" style="height:${height}%"></span></div>
            <span class="chart-month">${index + 1}月</span>
          </div>`;
        }).join("")}
      </div>
      <p class="chart-note">${note}</p>
    </section>`;
  }

  /* ---------- Render: bilingual reading ---------- */

  function languageMeta(id) {
    return SOURCE_LANGUAGES.find((language) => language.id === id)
      || TARGET_LANGUAGES.find((language) => language.id === id)
      || { id, label: id, short: String(id || "").toUpperCase() };
  }

  function languageOptions(languages, selected) {
    return languages.map((language) => `<option value="${language.id}" ${language.id === selected ? "selected" : ""}>${language.label}</option>`).join("");
  }

  function buildGoogleTranslateUrl(sourceText = translateState.sourceText) {
    const text = sourceText.slice(0, 1200);
    const from = translateState.from === "auto" ? "auto" : translateState.from;
    const params = new URLSearchParams({ sl: from, tl: translateState.to, text, op: "translate" });
    return `https://translate.google.com/?${params.toString()}`;
  }

  function buildDictionaryExternalUrl(word) {
    return `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`;
  }

  function saveTranslationDraft() {
    window.clearTimeout(translateSaveTimer);
    try {
      if (!translateState.sourceText.trim() && !translateState.translations.some((translation) => translation && translation.trim())) {
        localStorage.removeItem(TRANSLATION_STORAGE_KEY);
        return;
      }
      const payload = {
        sourceText: translateState.sourceText,
        from: translateState.from,
        to: translateState.to,
        paragraphs: translateState.status === "done" ? translateState.paragraphs : [],
        translations: translateState.status === "done" ? translateState.translations : [],
        detected: translateState.status === "done" ? translateState.detected : "",
        providers: translateState.status === "done" ? translateState.providers : [],
        updatedAt: Date.now(),
      };
      localStorage.setItem(TRANSLATION_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // The app remains usable in memory if browser storage is unavailable.
    }
  }

  function scheduleSaveTranslationDraft() {
    window.clearTimeout(translateSaveTimer);
    translateSaveTimer = window.setTimeout(saveTranslationDraft, 360);
  }

  function translationCountLabel() {
    return `${formatNumber(translateState.sourceText.length)} / ${formatNumber(MAX_TRANSLATION_CHARS)}`;
  }

  function providerLabel(providers) {
    const values = Array.from(new Set((providers || []).filter(Boolean)));
    if (!values.length) return "机器翻译";
    return values.map((provider) => (provider === "Google" ? "Google 翻译" : provider)).join(" · ");
  }

  function renderTranslateView() {
    renderTranslateWorkbench();
    renderDictionaryPanel();
  }

  function renderTranslateWorkbench() {
    const root = document.getElementById("translate-workbench");
    if (!root) return;
    const t = translateState;
    const fromMeta = languageMeta(t.from);
    const toMeta = languageMeta(t.to);
    const sourceText = t.sourceText;
    const showCompare = !t.showEditor && t.paragraphs.length > 0 && (t.status === "loading" || t.status === "done");
    const isLoading = t.status === "loading";
    const disabledAttribute = t.sourceText.trim() ? "" : "disabled";
    const disabledLanguage = isLoading ? "disabled" : "";
    const unitCount = sourceText.trim() ? splitTranslationSource(sourceText).length : 0;

    const controls = `<div class="translate-controls">
      <label class="language-field">
        <span>原文</span>
        <select id="translate-from" aria-label="原文语言" ${disabledLanguage}>${languageOptions(SOURCE_LANGUAGES, t.from)}</select>
      </label>
      <span class="language-arrow" aria-hidden="true">${icon("arrow-right")}</span>
      <label class="language-field">
        <span>译文</span>
        <select id="translate-to" aria-label="译文语言" ${disabledLanguage}>${languageOptions(TARGET_LANGUAGES, t.to)}</select>
      </label>
      <span class="translate-control-spacer"></span>
      <span class="translate-count" id="translate-count">${translationCountLabel()}</span>
    </div>`;

    const header = `<div class="translate-head">
      <div>
        <h2>对照翻译</h2>
        <p>原文和译文，逐段停在一起。</p>
      </div>
      <div class="translate-head-meta">
        <span class="online-pill"><i></i>在线翻译</span>
        <button class="dict-jump-button" type="button" data-action="focus-dictionary">${icon("search")} 查词</button>
      </div>
    </div>`;

    let body = "";
    if (showCompare) {
      const detectedLabel = t.from === "auto" && t.detected
        ? `<span class="translate-detected-label">检测为${languageMeta(t.detected).label}</span>`
        : "";
      const resultBar = `<div class="translate-result-bar">
        ${isLoading
          ? '<span class="translate-loading"><i class="translate-loading-dot"></i>正在逐段翻译</span>'
          : `<span class="translate-provider"><i></i>${escapeHTML(providerLabel(t.providers))}</span>`}
        ${detectedLabel}
        <span>${t.paragraphs.length} 段</span>
        <span class="translate-result-spacer"></span>
        ${isLoading
          ? ""
          : `<button class="text-link" type="button" data-action="edit-translation">${icon("edit")} 编辑原文</button>
             <button class="text-link" type="button" data-action="copy-translation">${icon("copy")} 复制译文</button>`}
      </div>`;

      const rows = t.paragraphs.map((paragraph, index) => {
        const translation = t.translations[index];
        let targetContent = "";
        if (isLoading) {
          targetContent = `<div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div>`;
        } else if (translation) {
          targetContent = `<p class="compare-target-text">${escapeHTML(translation)}</p>`;
        } else {
          targetContent = `<div class="compare-target--error">
            <span>这一段暂时没有翻译成功。</span>
            <button class="text-link" type="button" data-action="retry-paragraph" data-index="${index}">单独重试 ${icon("refresh")}</button>
          </div>`;
        }
        return `<div class="compare-row">
          <div class="compare-source">
            <span class="compare-mobile-label">原文 · ${escapeHTML(fromMeta.short)}</span>
            <p class="compare-source-text">${escapeHTML(paragraph)}</p>
          </div>
          <div class="compare-target">
            <span class="compare-mobile-label">译文 · ${escapeHTML(toMeta.short)}</span>
            ${targetContent}
          </div>
        </div>`;
      }).join("");

      body = `${resultBar}
        <div class="compare-label-row">
          <div>原文 <span>${escapeHTML(fromMeta.label)}</span></div>
          <div>译文 <span>${escapeHTML(toMeta.label)}</span></div>
        </div>
        <div class="compare-scroll">${rows}</div>
        <div class="translate-disclaimer">
          <span>${isLoading ? "正在生成译文，请稍候。" : "选中左侧原文里的词，可以直接查词。"}</span>
          <span>${formatNumber(sourceText.length)} 字 · ${t.paragraphs.length} 段</span>
        </div>`;
    } else {
      const errorBanner = t.status === "error" && t.error
        ? `<div class="translate-error-banner">
            ${icon("info")}
            <div>${escapeHTML(t.error)}<br><a href="${escapeHTML(buildGoogleTranslateUrl())}" target="_blank" rel="noopener noreferrer">在 Google 翻译中打开这段原文</a></div>
          </div>`
        : "";
      const targetEmpty = `<div class="translate-placeholder">
        <span class="translate-glyph" aria-hidden="true">译</span>
        <p>译文会逐段出现在这里，<br>和原文停在同一条水平线上。</p>
      </div>`;

      body = `${errorBanner}
        <div class="translate-editor-grid">
          <div class="translate-pane translate-pane--source">
            <div class="pane-head"><span class="pane-title">原文</span><span class="pane-language">${escapeHTML(fromMeta.short)}</span></div>
            <textarea class="translate-textarea" id="translate-input" maxlength="${MAX_TRANSLATION_CHARS}" spellcheck="false" placeholder="把还没有中文版的原文粘贴到这里。&#10;&#10;可以是一段书摘，也可以是一整页。">${escapeHTML(sourceText)}</textarea>
          </div>
          <div class="translate-pane translate-pane--target">
            <div class="pane-head"><span class="pane-title">译文</span><span class="pane-language">${escapeHTML(toMeta.short)}</span></div>
            ${targetEmpty}
          </div>
        </div>
        <div class="translate-actions">
          <span class="translate-action-hint">${sourceText.trim() ? `约 ${unitCount} 段 · 支持选中查词` : "支持英语、日语、法语、德语、西班牙语、韩语"}</span>
          <div class="translate-main-actions">
            ${sourceText.trim() ? '<button class="button button--ghost translate-clear" type="button" data-action="clear-translation">清空</button>' : ""}
            <button class="button button--primary" type="button" data-action="run-translation" ${disabledAttribute}>${icon("languages")} 开始对照翻译</button>
          </div>
        </div>`;
    }

    root.innerHTML = `${header}${controls}${body}`;
  }

  function renderDictionaryPanel() {
    const root = document.getElementById("dictionary-pane");
    if (!root) return;
    const d = dictionaryState;
    let resultMarkup = "";

    if (d.status === "loading") {
      resultMarkup = `<div class="dict-loading" role="status">
        <div class="dict-loading-word"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
      </div>`;
    } else if (d.status === "error") {
      resultMarkup = `<div class="dict-error">
        ${escapeHTML(d.error || "查词服务暂时不可用，请稍后再试。")}
        <div style="margin-top: 6px;"><a href="${escapeHTML(buildDictionaryExternalUrl(d.word))}" target="_blank" rel="noopener noreferrer">前往剑桥词典查看 →</a></div>
      </div>`;
    } else if (d.status === "done" && d.result) {
      const result = d.result;
      const phoneticLine = result.phonetic
        ? `<div class="dict-phonetic-row"><span>${escapeHTML(result.phonetic)}</span>${result.audio ? `<button class="dict-audio" type="button" data-action="play-word" data-audio="${escapeHTML(result.audio)}" aria-label="播放发音">${icon("volume")}</button>` : ""}</div>`
        : (result.audio ? `<div class="dict-phonetic-row"><button class="dict-audio" type="button" data-action="play-word" data-audio="${escapeHTML(result.audio)}" aria-label="播放发音">${icon("volume")}</button></div>` : "");
      const meanings = (result.meanings || []).map((meaning) => {
        const zh = PART_OF_SPEECH_ZH[meaning.partOfSpeech] || "";
        const definitions = (meaning.definitions || []).map((entry) => `<li>${escapeHTML(entry.definition)}${entry.example ? `<span class="dict-example">“${escapeHTML(entry.example)}”</span>` : ""}</li>`).join("");
        return `<div class="dict-sense">
          <div class="dict-pos">${escapeHTML(meaning.partOfSpeech || "word")}${zh ? `<span>${escapeHTML(zh)}</span>` : ""}</div>
          <ol class="dict-definitions">${definitions}</ol>
        </div>`;
      }).join("");
      const contextMarkup = d.context
        ? `<div class="dict-context">“${escapeHTML(d.context)}”<span>原文语境</span></div>`
        : "";
      const noticeMarkup = !meanings && result.notice
        ? `<div class="dict-empty-senses">${escapeHTML(result.notice)}</div>`
        : "";
      resultMarkup = `<div class="dict-result">
        <div class="dict-word-line">
          <div>
            <h3 class="dict-word">${escapeHTML(result.word || d.word)}</h3>
            ${phoneticLine}
          </div>
          <span class="dict-lang">EN</span>
        </div>
        ${result.translation
          ? `<div class="dict-translation">${escapeHTML(result.translation)}</div>`
          : '<div class="dict-translation is-empty">中文翻译暂不可用，可以先参考英文释义。</div>'}
        ${contextMarkup}
        ${meanings ? `<div class="dict-senses">${meanings}</div>` : noticeMarkup}
        <p class="dict-source">释义来自 <a href="${escapeHTML(result.sourceUrl)}" target="_blank" rel="noopener noreferrer">Wiktionary</a> · CC BY-SA 3.0</p>
      </div>`;
    } else {
      resultMarkup = `<div class="dict-empty">
        <div class="dict-glyph" aria-hidden="true">Aa</div>
        <p class="dict-empty-title">一个词，可能就是一句话的钥匙。</p>
        <p class="dict-empty-desc">在原文里选中一个词，<br>或者在这里直接输入。</p>
        <div class="dict-suggestions">
          <span>试试</span>
          <button class="dict-suggestion" type="button" data-dict-suggestion="deliberately">deliberately</button>
          <button class="dict-suggestion" type="button" data-dict-suggestion="essential">essential</button>
          <button class="dict-suggestion" type="button" data-dict-suggestion="serendipity">serendipity</button>
        </div>
        <div class="dict-empty-tip">${icon("quote")} 查词时会保留它所在的句子，帮助你判断它在这本书里的意思。</div>
      </div>`;
    }

    root.innerHTML = `<div class="dictionary-card">
      <div class="dictionary-head">
        <div>
          <h2>查词</h2>
          <p>别让一个词，挡住整段话。</p>
        </div>
        <span class="dict-lang">EN · 中文</span>
      </div>
      <form class="dictionary-form" id="dictionary-form">
        <div class="dict-search-box">
          ${icon("search")}
          <input id="dictionary-input" type="text" maxlength="60" autocomplete="off" spellcheck="false" placeholder="输入英文单词或短语" value="${escapeHTML(d.word)}" aria-label="输入英文单词或短语">
          <button type="submit" aria-label="查询">${icon("arrow-right")}</button>
        </div>
      </form>
      ${resultMarkup}
      <p class="dict-footer-note">英文释义来自 Free Dictionary API / Wiktionary；中文翻译由在线翻译服务生成。</p>
    </div>`;
  }

  /* ---------- Translation helpers ---------- */

  function splitLongText(text, maxLength) {
    const units = [];
    let remaining = text.trim();
    while (remaining.length > maxLength) {
      const candidates = [
        remaining.lastIndexOf(". ", maxLength),
        remaining.lastIndexOf("! ", maxLength),
        remaining.lastIndexOf("? ", maxLength),
        remaining.lastIndexOf("。", maxLength),
        remaining.lastIndexOf("！", maxLength),
        remaining.lastIndexOf("？", maxLength),
      ].filter((index) => index > maxLength * 0.35);
      let cut = candidates.length ? Math.max(...candidates) + 1 : -1;
      if (cut < 0) cut = remaining.lastIndexOf(" ", maxLength);
      if (cut < maxLength * 0.35) cut = maxLength;
      units.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) units.push(remaining);
    return units;
  }

  function splitTranslationSource(text) {
    const normalized = String(text || "").replace(/\r\n?/g, "\n").trim();
    if (!normalized) return [];
    const blocks = normalized.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
    const units = [];
    for (const block of blocks) {
      if (block.length <= 1400) units.push(block);
      else units.push(...splitLongText(block, 1400));
    }
    return units;
  }

  function decodeHtmlEntities(value) {
    const element = document.createElement("textarea");
    element.innerHTML = value;
    return element.value;
  }

  function looksUntranslated(source, translation, to) {
    if (!translation) return true;
    const cleanSource = source.trim();
    const cleanTranslation = translation.trim();
    if (cleanSource !== cleanTranslation) return false;
    if (cleanSource.length <= 16) return false;
    return true;
  }

  async function translateViaGoogleClient(text, from, to) {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", from);
    url.searchParams.set("tl", to);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Translation service returned ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error("Unexpected translation response");
    const translated = data[0]
      .map((segment) => (Array.isArray(segment) ? segment[0] : ""))
      .filter(Boolean)
      .join("")
      .trim();
    if (!translated) throw new Error("Empty translation");
    return {
      text: translated,
      detected: typeof data[2] === "string" ? data[2] : "",
      provider: "Google",
    };
  }

  async function translateViaMyMemoryClient(text, from, to) {
    const source = from === "auto" ? "en" : from;
    const chunks = splitLongText(text, 440);
    const translations = [];
    for (const chunk of chunks) {
      const url = new URL("https://api.mymemory.translated.net/get");
      url.searchParams.set("q", chunk);
      url.searchParams.set("langpair", `${source}|${to}`);
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Fallback translation returned ${response.status}`);
      const data = await response.json();
      if (data?.quotaFinished) throw new Error("Translation quota exhausted");
      const translated = decodeHtmlEntities(String(data?.responseData?.translatedText || "").trim());
      if (!translated || looksUntranslated(chunk, translated, to)) throw new Error("Empty fallback translation");
      translations.push(translated);
      if (chunks.length > 1) await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return {
      text: translations.join(" ").replace(/\s+/g, " ").trim(),
      detected: source,
      provider: "MyMemory",
    };
  }

  async function translateUnitDirect(text, from, to) {
    try {
      return await translateViaGoogleClient(text, from, to);
    } catch {
      return translateViaMyMemoryClient(text, from, to);
    }
  }

  async function translateUnitsDirect(texts, from, to) {
    const results = new Array(texts.length);
    const providers = [];
    let detected = "";
    let cursor = 0;
    const worker = async () => {
      while (cursor < texts.length) {
        const index = cursor;
        cursor += 1;
        try {
          const result = await translateUnitDirect(texts[index], from, to);
          if (looksUntranslated(texts[index], result.text, to)) {
            results[index] = null;
          } else {
            results[index] = result.text;
            providers.push(result.provider);
            if (!detected && result.detected) detected = result.detected;
          }
        } catch {
          results[index] = null;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, texts.length) }, worker));
    return { results, providers, detected };
  }

  async function translateViaServer(texts, from, to) {
    if (location.protocol === "file:") throw new Error("Local API is not available");
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paragraphs: texts, from, to }),
    });
    if (!response.ok) throw new Error("Server translation failed");
    return response.json();
  }

  async function translateTextBatch(texts, from, to) {
    const direct = await translateUnitsDirect(texts, from, to);
    const failedIndices = direct.results
      .map((result, index) => (result ? -1 : index))
      .filter((index) => index >= 0);

    if (failedIndices.length) {
      try {
        const fallback = await translateViaServer(
          failedIndices.map((index) => texts[index]),
          from,
          to
        );
        (fallback.translations || []).forEach((translation, index) => {
          const paragraph = texts[failedIndices[index]];
          if (translation && !looksUntranslated(paragraph, translation, to)) {
            direct.results[failedIndices[index]] = translation;
          }
        });
        direct.providers.push(...(fallback.providers || []));
        if (!direct.detected && fallback.detected) direct.detected = fallback.detected;
      } catch {
        // The caller can still show partial results and retry.
      }
    }

    return {
      translations: direct.results,
      providers: Array.from(new Set(direct.providers.filter(Boolean))),
      detected: direct.detected,
    };
  }

  async function runTranslation() {
    if (translateState.status === "loading") return;
    const sourceText = translateState.sourceText.trim();
    if (!sourceText) {
      showToast("还没有原文", "先把想读的那一段粘贴进来。", { icon: "languages" });
      return;
    }
    if (translateState.from === translateState.to) {
      showToast("语言相同", "原文和译文选择了同一种语言。", { icon: "info" });
      return;
    }
    if (sourceText.length > MAX_TRANSLATION_CHARS) {
      showToast("文字有点多", `一次最多翻译 ${formatNumber(MAX_TRANSLATION_CHARS)} 字，请分段粘贴。`, { icon: "info" });
      return;
    }
    const paragraphs = splitTranslationSource(sourceText);
    if (!paragraphs.length) return;
    if (paragraphs.length > MAX_TRANSLATION_UNITS) {
      showToast("段落太多了", "一次最多对照 60 段，请分成几次翻译。", { icon: "info" });
      return;
    }

    translateState.paragraphs = paragraphs;
    translateState.translations = new Array(paragraphs.length).fill(null);
    translateState.detected = "";
    translateState.providers = [];
    translateState.status = "loading";
    translateState.error = "";
    translateState.showEditor = false;
    renderTranslateWorkbench();
    hideSelectionTool();

    try {
      const translated = await translateTextBatch(paragraphs, translateState.from, translateState.to);
      const successful = translated.translations.filter(Boolean).length;
      if (!successful) throw new Error("翻译服务暂时不可用，请检查网络后再试。");
      translateState.translations = translated.translations;
      translateState.detected = translated.detected;
      translateState.providers = translated.providers;
      translateState.status = "done";
      translateState.showEditor = false;
      saveTranslationDraft();
      renderTranslateWorkbench();
      if (successful < paragraphs.length) {
        showToast("部分段落未翻译", "可以点击对应的「单独重试」。", { icon: "info" });
      }
    } catch (error) {
      translateState.status = "error";
      translateState.showEditor = true;
      translateState.error = error?.message === "Failed to fetch"
        ? "无法连接翻译服务，请检查网络后再试。"
        : "翻译服务暂时不可用，请检查网络后再试。";
      saveTranslationDraft();
      renderTranslateWorkbench();
      showToast("翻译没有完成", "原文还在，可以稍后再试。", { icon: "info" });
    }
  }

  async function retryTranslationParagraph(index) {
    const paragraph = translateState.paragraphs[index];
    if (!paragraph) return;
    const cell = document.querySelectorAll(".compare-target")[index];
    if (cell) cell.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div>';
    try {
      const result = await translateUnitDirect(paragraph, translateState.from, translateState.to);
      if (looksUntranslated(paragraph, result.text, translateState.to)) throw new Error("Empty translation");
      translateState.translations[index] = result.text;
      translateState.providers = Array.from(new Set([...(translateState.providers || []), result.provider]));
      saveTranslationDraft();
      renderTranslateWorkbench();
      showToast("这一段翻译好了", "可以继续和原文对照。", { icon: "check" });
    } catch {
      showToast("这一段还是没有翻译出来", "可以稍后重试，或先在 Google 翻译中打开。", { icon: "info" });
      renderTranslateWorkbench();
    }
  }

  function clearTranslation() {
    Object.assign(translateState, createEmptyTranslationState());
    window.clearTimeout(translateSaveTimer);
    try {
      localStorage.removeItem(TRANSLATION_STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
    hideSelectionTool();
    renderTranslateView();
  }

  function editTranslationSource() {
    Object.assign(translateState, {
      showEditor: true,
      status: "idle",
      error: "",
      paragraphs: [],
      translations: [],
      detected: "",
      providers: [],
    });
    saveTranslationDraft();
    renderTranslateWorkbench();
  }

  async function copyText(value) {
    const text = String(value || "");
    if (!text.trim()) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        return copied;
      } catch {
        return false;
      }
    }
  }

  async function copyTranslation() {
    const text = translateState.translations.filter(Boolean).join("\n\n");
    if (!text) {
      showToast("还没有译文", "先完成一次翻译。", { icon: "info" });
      return;
    }
    const copied = await copyText(text);
    showToast(copied ? "译文已复制" : "复制失败", copied ? "可以粘贴到你的读书笔记里。" : "请手动选择译文复制。", { icon: copied ? "copy" : "info" });
  }

  function cleanLookupTerm(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, "")
      .trim()
      .slice(0, 60);
  }

  function contextAroundTerm(text, term) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    const index = normalized.toLocaleLowerCase().indexOf(String(term || "").toLocaleLowerCase());
    if (index < 0) return normalized.slice(0, 240);

    const starters = [". ", "! ", "? ", "。", "！", "？"];
    let start = 0;
    for (const marker of starters) {
      const position = normalized.lastIndexOf(marker, Math.max(0, index - 1));
      if (position >= 0) start = Math.max(start, position + marker.length);
    }

    const endLimit = index + String(term).length;
    const endCandidates = [];
    for (const marker of starters) {
      const position = normalized.indexOf(marker, endLimit);
      if (position >= 0) endCandidates.push(position + marker.length);
    }
    let end = endCandidates.length ? Math.min(...endCandidates) : normalized.length;
    if (end - start > 280) end = start + 280;
    return `${start > 0 ? "…" : ""}${normalized.slice(start, end).trim()}${end < normalized.length ? "…" : ""}`;
  }

  async function lookupWord(rawWord, context = "") {
    const word = cleanLookupTerm(rawWord);
    if (!word) {
      showToast("还没有选中词", "在原文里选一个词，或直接输入英文单词。", { icon: "search" });
      return;
    }
    if (!/[A-Za-z]/.test(word)) {
      showToast("查词目前支持英文", "可以选中英文单词或短语再试。", { icon: "info" });
      return;
    }

    dictionaryState.word = word;
    dictionaryState.context = context ? String(context).trim().slice(0, 260) : "";
    dictionaryState.status = "loading";
    dictionaryState.result = null;
    dictionaryState.error = "";
    const requestId = ++dictionaryRequestId;
    renderDictionaryPanel();
    scrollDictionaryIntoView();

    try {
      if (location.protocol === "file:") {
        throw new Error("请通过 start.cmd 启动后使用查词。");
      }
      const translatePromise = translateViaGoogleClient(word, "en", "zh-CN").catch(() => null);
      const response = await fetch("/api/define", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word }),
      });
      const data = await response.json().catch(() => ({}));
      if (requestId !== dictionaryRequestId) return;
      if (!response.ok) throw new Error(data.error || "查词服务暂时不可用。");
      const clientTranslation = await translatePromise;
      if (clientTranslation?.text) {
        data.translation = clientTranslation.text;
        data.notice = data.found ? "" : "词典里没有收录这个词形，先看看中文意思。";
      }
      dictionaryState.result = data;
      dictionaryState.status = "done";
      renderDictionaryPanel();
    } catch (error) {
      if (requestId !== dictionaryRequestId) return;
      dictionaryState.status = "error";
      dictionaryState.error = error?.message === "Failed to fetch"
        ? "本地查词服务没有响应，请确认是通过 start.cmd 打开的。"
        : error?.message || "查词服务暂时不可用。";
      renderDictionaryPanel();
    }
  }

  function scrollDictionaryIntoView() {
    if (ui.view !== "translate" || window.innerWidth > 1160) return;
    const pane = document.getElementById("dictionary-pane");
    if (!pane) return;
    window.setTimeout(() => {
      pane.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    }, 60);
  }

  function playWordAudio(url) {
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.play().catch(() => showToast("发音暂时无法播放", "可以检查网络后再试。", { icon: "volume" }));
    } catch {
      showToast("发音暂时无法播放", "这个音频源没有响应。", { icon: "volume" });
    }
  }

  function hideSelectionTool() {
    const tool = document.getElementById("selection-tool");
    if (tool) {
      tool.hidden = true;
      tool.classList.remove("is-below");
    }
    selectionToolState = null;
  }

  function showSelectionTool(word, context, rect) {
    const tool = document.getElementById("selection-tool");
    if (!tool) return;
    const wordElement = tool.querySelector(".selection-tool-word");
    if (wordElement) wordElement.textContent = word;
    selectionToolState = { word, context };
    tool.hidden = false;
    tool.classList.remove("is-below");
    const width = tool.offsetWidth;
    const height = tool.offsetHeight;
    const center = rect.left + rect.width / 2;
    const left = clamp(center, 18 + width / 2, window.innerWidth - 18 - width / 2);
    const above = rect.top > height + 20;
    tool.style.left = `${left}px`;
    tool.style.top = above ? `${rect.top - 7}px` : `${rect.bottom + 8}px`;
    if (!above) tool.classList.add("is-below");
  }

  function handleTranslationSelection(event) {
    const source = event.target.closest?.(".compare-source-text");
    if (!source) return;
    window.setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        hideSelectionTool();
        return;
      }
      const raw = selection.toString().replace(/\s+/g, " ").trim();
      if (!raw || raw.length > 60 || !/[A-Za-z]/.test(raw)) {
        hideSelectionTool();
        return;
      }
      const word = cleanLookupTerm(raw);
      if (!word) return;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) return;
      const context = contextAroundTerm(source.textContent || "", word);
      showSelectionTool(word, context, rect);
    }, 0);
  }

  /* ---------- Render: all ---------- */

  function renderAll() {
    renderHeader();
    renderGoalCard();
    renderStreakCard();
    renderMilestoneCard();
    renderStats();
    renderReadingPanel();
    renderHeatmap();
    renderCategorySummary();
    renderAchievementSummary();
    renderShelf();
    renderDistribution();
    renderCategoryGrid();
    renderTranslateView();
    renderLevelCard();
    renderAchievementGrid();
    renderChart();
  }

  /* ---------- View switching ---------- */

  function applyView({ scroll = false } = {}) {
    const view = VIEWS.includes(ui.view) ? ui.view : "overview";
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.viewPanel === view);
    });
    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === view;
      if (button.classList.contains("nav-item") || button.classList.contains("mobile-nav-item")) {
        button.classList.toggle("is-active", active);
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    });
    const titles = {
      overview: "概览",
      shelf: "我的书架",
      categories: "分类书架",
      translate: "译读",
      achievements: "阅读成就",
    };
    document.title = `${titles[view]} · 拾页`;
    if (scroll) window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function navigate(view, { replace = false, scroll = true } = {}) {
    if (!VIEWS.includes(view)) view = "overview";
    hideSelectionTool();
    const changed = view !== ui.view;
    ui.view = view;
    const hash = `#${view}`;
    if (location.hash !== hash) {
      if (replace) history.replaceState(null, "", hash);
      else history.pushState(null, "", hash);
    }
    applyView({ scroll: scroll && changed });
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------- Overlay helpers ---------- */

  function openOverlay({ markup, drawer = false, focusSelector = null }) {
    window.clearTimeout(overlayCloseTimer);
    const root = document.getElementById("overlay-root");
    if (!root) return;
    if (overlayOpen) {
      root.innerHTML = "";
      document.body.classList.remove("is-locked");
    }
    lastFocusedElement = document.activeElement;
    root.innerHTML = `<div class="overlay${drawer ? " overlay--drawer" : ""}">${markup}</div>`;
    document.body.classList.add("is-locked");
    overlayOpen = true;
    const overlay = root.querySelector(".overlay");
    requestAnimationFrame(() => {
      overlay?.classList.add("is-open");
      const target = (focusSelector && overlay?.querySelector(focusSelector))
        || overlay?.querySelector("[autofocus]")
        || overlay?.querySelector(".dialog-close")
        || overlay?.querySelector(".drawer .dialog-close")
        || overlay?.querySelector("button");
      target?.focus({ preventScroll: true });
    });
  }

  function closeOverlay({ restoreFocus = true } = {}) {
    const root = document.getElementById("overlay-root");
    const overlay = root?.querySelector(".overlay");
    if (!overlay) {
      document.body.classList.remove("is-locked");
      overlayOpen = false;
      return;
    }
    overlay.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    overlayOpen = false;
    window.clearTimeout(overlayCloseTimer);
    overlayCloseTimer = window.setTimeout(() => {
      if (root.contains(overlay)) root.innerHTML = "";
      if (restoreFocus && lastFocusedElement && document.contains(lastFocusedElement)) {
        lastFocusedElement.focus({ preventScroll: true });
      }
    }, 300);
  }

  function trapOverlayFocus(event) {
    if (!overlayOpen || event.key !== "Tab") return;
    const overlay = document.querySelector("#overlay-root .overlay");
    if (!overlay) return;
    const focusable = Array.from(overlay.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------- Toasts & celebration ---------- */

  function showToast(title, message = "", options = {}) {
    const region = document.getElementById("toast-region");
    if (!region) return;
    const element = document.createElement("div");
    element.className = `toast${options.tone === "achievement" ? " toast--achievement" : ""}`;
    const iconElement = document.createElement("span");
    iconElement.className = "toast-icon";
    iconElement.innerHTML = svgMarkup(options.icon || "check");
    const copy = document.createElement("div");
    copy.className = "toast-copy";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const span = document.createElement("span");
    span.textContent = message;
    copy.append(strong);
    if (message) copy.append(span);
    element.append(iconElement, copy);
    region.append(element);

    while (region.children.length > 3) region.firstElementChild.remove();
    const duration = options.duration || 3600;
    toastTimerSequence += 1;
    const sequence = toastTimerSequence;
    window.setTimeout(() => {
      if (!element.isConnected) return;
      element.classList.add("is-leaving");
      window.setTimeout(() => element.remove(), 260);
    }, duration + (sequence % 2) * 30);
  }

  function showAchievementToast(achievement) {
    showToast("成就解锁", `${achievement.title} · ${achievement.description}`, {
      tone: "achievement",
      icon: achievement.icon,
      duration: 5200,
    });
  }

  function triggerConfetti() {
    if (prefersReducedMotion()) return;
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    const colors = ["#d3b47d", "#a7b99e", "#8e6a45", "#d7c6a3", "#6f846d", "#b8795d"];
    for (let index = 0; index < 26; index += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      const x = (Math.random() - 0.5) * 620;
      const y = 180 + Math.random() * 320;
      piece.style.setProperty("--x", `${x}px`);
      piece.style.setProperty("--y", `${y}px`);
      piece.style.setProperty("--r", `${Math.round(Math.random() * 720 - 360)}deg`);
      piece.style.setProperty("--c", colors[index % colors.length]);
      piece.style.setProperty("--delay", `${Math.round(Math.random() * 160)}ms`);
      piece.style.setProperty("--dur", `${1500 + Math.round(Math.random() * 700)}ms`);
      piece.style.left = `${46 + Math.random() * 8}%`;
      layer.append(piece);
    }
    document.body.append(layer);
    window.setTimeout(() => layer.remove(), 2600);
  }

  function captureChangeSnapshot() {
    return {
      seen: new Set(Array.isArray(state.seenAchievements) ? state.seenAchievements : []),
      yearRead: getReadThisYear().length,
    };
  }

  function commitReadingChange({ title, message, before, celebrate = true }) {
    const currentAchievements = getAchievements();
    const newlyUnlocked = currentAchievements.filter((achievement) => achievement.unlocked && !before.seen.has(achievement.id));
    const seen = new Set(Array.isArray(state.seenAchievements) ? state.seenAchievements : []);
    currentAchievements.filter((achievement) => achievement.unlocked).forEach((achievement) => seen.add(achievement.id));
    state.seenAchievements = Array.from(seen);
    persist();
    renderAll();

    if (title) showToast(title, message, { icon: "check", duration: 3200 });

    const afterYearRead = getReadThisYear().length;
    const goalJustReached = afterYearRead >= state.profile.yearlyGoal && before.yearRead < state.profile.yearlyGoal;
    if (newlyUnlocked.length) {
      newlyUnlocked.slice(0, 2).forEach((achievement, index) => {
        window.setTimeout(() => showAchievementToast(achievement), 520 + index * 1400);
      });
    }
    if (goalJustReached) {
      window.setTimeout(() => showToast("年度阅读目标达成", `今年已经读完 ${afterYearRead} 本书，慢慢读，也读得很远。`, {
        tone: "achievement",
        icon: "target",
        duration: 5600,
      }), newlyUnlocked.length ? 1650 : 620);
    }
    if (celebrate && (newlyUnlocked.length || goalJustReached)) {
      window.setTimeout(triggerConfetti, 280);
    }
  }

  /* ---------- Modal markup ---------- */

  function dialogShell({ title, kicker = "SHIYE · READING ARCHIVE", description = "", body, className = "" }) {
    return `<div class="dialog ${className}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div class="dialog-head">
        <div>
          <p class="dialog-kicker">${escapeHTML(kicker)}</p>
          <h2 class="dialog-title" id="dialog-title">${escapeHTML(title)}</h2>
          ${description ? `<p class="dialog-description">${escapeHTML(description)}</p>` : ""}
        </div>
        <button class="dialog-close" type="button" data-close aria-label="关闭">${icon("close")}</button>
      </div>
      <div class="dialog-body">${body}</div>
    </div>`;
  }

  function openGoalDialog() {
    const count = getReadThisYear().length;
    const goal = state.profile.yearlyGoal;
    const body = `<form class="dialog-form" id="goal-form">
      <div class="goal-dialog-visual">
        <div class="goal-dialog-number">${count}</div>
        <div class="goal-dialog-copy">
          <strong>本 · ${YEAR} 年已读完</strong>
          <span>${goal > count ? `距离现在的目标，还有 ${goal - count} 本。` : "已经完成此刻的目标，仍可以继续向前。"}</span>
        </div>
      </div>
      <div class="field">
        <label for="goal-input">今年想读完多少本？</label>
        <div class="input-wrap">
          <input class="input" id="goal-input" name="goal" type="number" min="1" max="365" step="1" value="${goal}" required inputmode="numeric">
          <span class="input-suffix">本</span>
        </div>
        <span class="field-hint">一个伸手够得到的目标，比一个漂亮的目标更可靠。</span>
      </div>
      <p class="form-error" id="goal-error" role="alert"></p>
      <div class="form-actions">
        <button class="button button--secondary" type="button" data-close>取消</button>
        <button class="button button--primary" type="submit">保存目标</button>
      </div>
    </form>`;
    openOverlay({
      markup: dialogShell({ title: "调整年度目标", kicker: "READING GOAL", className: "dialog--small", body }),
      focusSelector: "#goal-input",
    });
  }

  function openCategoryDialog() {
    const body = `<form class="dialog-form" id="category-form">
      <div class="field">
        <label for="category-name">分类名称</label>
        <input class="input" id="category-name" name="name" type="text" maxlength="8" placeholder="比如：哲学、旅行、诗歌" required autocomplete="off">
        <span class="field-hint">最多 8 个字，之后可以在添加书籍时选择它。</span>
      </div>
      <div class="field">
        <span class="field-label" style="color: var(--muted); font-size: 9.5px; font-weight: 570;">选择颜色</span>
        <div class="color-options">
          ${CATEGORY_PALETTE.map((color, index) => `<label class="color-choice" title="颜色 ${index + 1}">
            <input type="radio" name="color" value="${index}" ${index === 0 ? "checked" : ""}>
            <i style="--color:${color.color}"></i>
          </label>`).join("")}
        </div>
      </div>
      <p class="form-error" id="category-error" role="alert"></p>
      <div class="form-actions">
        <button class="button button--secondary" type="button" data-close>取消</button>
        <button class="button button--primary" type="submit">创建分类</button>
      </div>
    </form>`;
    openOverlay({
      markup: dialogShell({ title: "新建分类", kicker: "NEW SHELF", description: "给阅读留一个新的抽屉。", className: "dialog--category", body }),
      focusSelector: "#category-name",
    });
  }

  function categoryOptions(selectedId) {
    return state.categories.map((category) => `<option value="${escapeHTML(category.id)}" ${category.id === selectedId ? "selected" : ""}>${escapeHTML(category.name)}</option>`).join("");
  }

  function themeOptions(selectedTheme) {
    return COVER_THEMES.map((theme) => `<label class="theme-choice theme-choice--${theme.id}" title="${theme.name}">
      <input type="radio" name="theme" value="${theme.id}" ${theme.id === selectedTheme ? "checked" : ""} aria-label="${theme.name}封面">
      <i></i>
    </label>`).join("");
  }

  function openBookForm(bookId = null) {
    const editing = Boolean(bookId);
    const book = editing ? getBook(bookId) : null;
    if (editing && !book) return;
    const category = book ? getCategory(book.categoryId) : (ui.shelfCategory !== "all" ? getCategory(ui.shelfCategory) : state.categories[0]);
    const defaultTheme = book?.theme || COVER_THEMES[state.books.length % COVER_THEMES.length].id;
    const status = book?.status || "want";
    const title = editing ? "编辑书籍" : "添加一本书";
    const description = editing ? "修改书名、分类或阅读状态。" : "书名、作者和封面色调，会一起成为它在书架上的样子。";

    const body = `<form class="dialog-form" id="book-form" data-mode="${editing ? "edit" : "add"}" data-book-id="${editing ? escapeHTML(book.id) : ""}" novalidate>
      <div class="book-form-layout">
        <div class="cover-preview-pane">
          <div class="cover-preview" id="cover-preview"></div>
          <p class="cover-preview-note">封面由书名和色调生成，<br>每一本只属于你。</p>
        </div>
        <div class="form-fields">
          <div class="field">
            <label for="book-title">书名</label>
            <input class="input" id="book-title" name="title" type="text" maxlength="50" placeholder="你正在读的书" value="${book ? escapeHTML(book.title) : ""}" required autocomplete="off">
          </div>
          <div class="field">
            <label for="book-author">作者</label>
            <input class="input" id="book-author" name="author" type="text" maxlength="50" placeholder="作者或译者" value="${book ? escapeHTML(book.author) : ""}" required autocomplete="off">
          </div>
          <div class="field-row">
            <div class="field">
              <label for="book-category">分类</label>
              <select class="select" id="book-category" name="categoryId">${categoryOptions(category?.id)}</select>
            </div>
            <div class="field">
              <label for="book-pages">总页数</label>
              <div class="input-wrap">
                <input class="input" id="book-pages" name="pages" type="number" min="1" max="5000" step="1" value="${book ? book.pages : 320}" required inputmode="numeric">
                <span class="input-suffix">页</span>
              </div>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="book-status">阅读状态</label>
              <select class="select" id="book-status" name="status">
                <option value="want" ${status === "want" ? "selected" : ""}>想读</option>
                <option value="reading" ${status === "reading" ? "selected" : ""}>在读</option>
                <option value="read" ${status === "read" ? "selected" : ""}>已读完</option>
              </select>
            </div>
            <div class="field">
              <label>封面色调</label>
              <fieldset class="cover-themes">
                <legend class="sr-only">封面色调</legend>
                <div class="theme-options">${themeOptions(defaultTheme)}</div>
              </fieldset>
            </div>
          </div>
          <p class="form-error" id="book-form-error" role="alert"></p>
          <div class="form-actions">
            <button class="button button--secondary" type="button" data-close>取消</button>
            <button class="button button--primary" type="submit">${editing ? "保存修改" : "加入书架"}</button>
          </div>
        </div>
      </div>
    </form>`;

    openOverlay({
      markup: dialogShell({ title, kicker: editing ? "EDIT BOOK" : "NEW BOOK", description, body }),
      focusSelector: "#book-title",
    });
    updateCoverPreview();
  }

  function renderStars(rating) {
    const value = clamp(Math.round(rating || 0), 0, 5);
    if (!value) return "";
    return `<div class="drawer-rating" aria-label="评分 ${value} 星">${Array.from({ length: 5 }, (_, index) => `<span class="${index < value ? "" : "is-empty"}">★</span>`).join("")}</div>`;
  }

  function openBookDetail(bookId) {
    const book = getBook(bookId);
    if (!book) return;
    const category = getCategory(book.categoryId);
    const meta = STATUS_META[book.status] || STATUS_META.want;
    const percent = getBookPercent(book);
    const readingDays = book.startedAt && book.finishedAt ? Math.max(1, daysBetween(book.startedAt, book.finishedAt) + 1) : 0;

    let actionMarkup = "";
    let sectionMarkup = "";
    const ebookReadLabel = book.status === "reading" ? "继续阅读" : book.status === "read" ? "再次打开" : "开始阅读";
    if (book.ebook) {
      const chapterLabel = `第 ${Math.min(book.ebook.chapterCount, (book.readerChapter || 0) + 1)} 章 / 共 ${book.ebook.chapterCount} 章`;
      if (book.status === "read") {
        sectionMarkup = `<div class="finished-banner">${icon("check")}<span><strong>已读完</strong> · ${formatFullDate(book.finishedAt)}${readingDays ? ` · 陪你走过 ${readingDays} 天` : ""}</span></div>`;
      } else if (book.status === "reading") {
        sectionMarkup = `<div class="ebook-reading-card">
          <div><span class="ebook-reading-kicker">${escapeHTML(book.ebook.format.toUpperCase())} · 阅读进度</span><p>${chapterLabel}</p></div>
          <strong>${percent}%</strong>
        </div>`;
      } else {
        sectionMarkup = `<div class="want-note">电子书已经放上书架。打开阅读器，从第一页开始。</div>`;
      }
      actionMarkup = `<button class="button button--primary" type="button" data-reader-open="${escapeHTML(book.id)}">${icon("book-open")} ${ebookReadLabel}</button>
        <button class="button button--secondary" type="button" data-action="edit-book" data-book-id="${escapeHTML(book.id)}">${icon("edit")} 编辑信息</button>`;
    } else if (book.status === "reading") {
      sectionMarkup = `<div class="drawer-section">
        <div class="drawer-section-head">
          <h3>阅读进度</h3>
          <output id="progress-output">第 ${formatNumber(book.progress)} 页 / ${formatNumber(book.pages)} 页</output>
        </div>
        <div class="range-wrap">
          <input class="range-input" id="book-progress-range" type="range" min="0" max="${book.pages}" step="1" value="${book.progress}" aria-label="阅读进度" style="--fill:${percent}%">
          <div class="range-labels"><span>第 0 页</span><span>${percent}%</span><span>${formatNumber(book.pages)} 页</span></div>
        </div>
        <p class="field-hint" style="margin-top: 10px; font-size: 9.5px;">保存后会同步到今天阅读足迹。把书读到最后，会自动点亮新的里程碑。</p>
      </div>`;
      actionMarkup = `<button class="button button--primary" type="button" data-action="save-progress" data-book-id="${escapeHTML(book.id)}">保存进度</button>
        <button class="button button--secondary" type="button" data-action="finish-book" data-book-id="${escapeHTML(book.id)}">标记读完</button>
        <button class="button button--secondary button--icon-only" type="button" data-action="edit-book" data-book-id="${escapeHTML(book.id)}" aria-label="编辑书籍">${icon("edit")}</button>`;
    } else if (book.status === "read") {
      sectionMarkup = `<div class="finished-banner">${icon("check")}<span><strong>已读完</strong> · ${formatFullDate(book.finishedAt)}${readingDays ? ` · 陪你走过 ${readingDays} 天` : ""}</span></div>`;
      actionMarkup = `<button class="button button--primary" type="button" data-action="edit-book" data-book-id="${escapeHTML(book.id)}">${icon("edit")} 编辑书籍</button>`;
    } else {
      sectionMarkup = `<div class="want-note">还没有开始。准备好时，翻开第一页，故事就会开始。</div>`;
      actionMarkup = `<button class="button button--primary" type="button" data-action="start-reading" data-book-id="${escapeHTML(book.id)}">开始阅读</button>
        <button class="button button--secondary" type="button" data-action="edit-book" data-book-id="${escapeHTML(book.id)}">${icon("edit")} 编辑</button>`;
    }

    const markup = `<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div class="drawer-head">
        <span class="drawer-kicker">BOOK DETAIL · 拾页</span>
        <button class="dialog-close" type="button" data-close aria-label="关闭">${icon("close")}</button>
      </div>
      <div class="drawer-hero">
        <div class="drawer-cover">${coverMarkup(book, category)}</div>
        <div class="drawer-copy">
          <span class="status-pill ${meta.className}"><i></i>${meta.label}</span>
          <h2 class="drawer-title" id="dialog-title">${escapeHTML(book.title)}</h2>
          <p class="drawer-author">${escapeHTML(book.author)}</p>
          ${book.status === "read" ? renderStars(book.rating) : ""}
        </div>
      </div>
      <div class="detail-facts">
        <div class="fact"><span>分类</span><strong>${escapeHTML(category.name)}</strong></div>
        <div class="fact"><span>${book.ebook ? "版本" : "页数"}</span><strong>${book.ebook ? `${escapeHTML(book.ebook.format.toUpperCase())} · ${book.ebook.chapterCount} 章` : `${formatNumber(book.pages)} 页`}</strong></div>
        <div class="fact"><span>${book.status === "read" ? "已读" : "进度"}</span><strong>${book.status === "read" ? "100%" : `${percent}%`}</strong></div>
      </div>
      ${sectionMarkup}
      <div class="drawer-actions">${actionMarkup}</div>
      <div class="drawer-footer">
        <span>加入于 ${formatFullDate(book.addedAt)}</span>
        <button class="danger-link" type="button" data-action="delete-book" data-book-id="${escapeHTML(book.id)}">从书架移除</button>
      </div>
    </div>`;

    openOverlay({ markup, drawer: true, focusSelector: ".dialog-close" });
  }

  function openSettingsDialog() {
    const body = `<form class="dialog-form" id="settings-form">
      <div class="settings-section">
        <div class="field">
          <label for="settings-name">你的名字</label>
          <input class="input" id="settings-name" name="name" type="text" maxlength="12" value="${escapeHTML(state.profile.name)}" required autocomplete="off">
        </div>
      </div>
      <div class="settings-section">
        <div class="field">
          <label for="settings-goal">年度阅读目标</label>
          <div class="input-wrap">
            <input class="input" id="settings-goal" name="goal" type="number" min="1" max="365" step="1" value="${state.profile.yearlyGoal}" required inputmode="numeric">
            <span class="input-suffix">本</span>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <p class="settings-section-title">你的数据</p>
        <p class="settings-section-desc">所有书籍和阅读记录都保存在这个浏览器里，不会上传到任何地方。导出的 JSON 包含阅读档案，但不包含导入的电子书原文件。${storageWorks ? "" : " 当前浏览器禁用了本地存储，这次的改动可能无法在刷新后保留。"}</p>
        <div class="data-actions">
          <button class="button button--secondary" type="button" data-action="export-data">${icon("download")} 导出数据</button>
          <button class="button button--secondary" type="button" data-action="reset-data">${icon("refresh")} 清空阅读数据</button>
        </div>
      </div>
      <p class="form-error" id="settings-error" role="alert"></p>
      <div class="form-actions">
        <button class="button button--secondary" type="button" data-close>取消</button>
        <button class="button button--primary" type="submit">保存设置</button>
      </div>
    </form>`;
    openOverlay({
      markup: dialogShell({ title: "设置", kicker: "PREFERENCES", description: "把这里，调成更像你的样子。", className: "dialog--small", body }),
      focusSelector: "#settings-name",
    });
  }

  /* ---------- Form interactions ---------- */

  function updateCoverPreview() {
    const form = document.getElementById("book-form");
    const preview = document.getElementById("cover-preview");
    if (!form || !preview) return;
    const data = new FormData(form);
    const category = getCategory(String(data.get("categoryId") || ""));
    const theme = COVER_THEMES.some((entry) => entry.id === data.get("theme")) ? String(data.get("theme")) : "forest";
    const temporaryBook = {
      title: String(data.get("title") || "").trim() || "书名",
      author: String(data.get("author") || "").trim() || "作者",
      theme,
    };
    preview.innerHTML = coverMarkup(temporaryBook, category);
  }

  function updateProgressOutput() {
    const range = document.getElementById("book-progress-range");
    const output = document.getElementById("progress-output");
    if (!range || !output) return;
    const value = Number(range.value);
    const max = Number(range.max);
    const percent = max > 0 ? Math.round((value / max) * 100) : 0;
    range.style.setProperty("--fill", `${percent}%`);
    output.textContent = `第 ${formatNumber(value)} 页 / ${formatNumber(max)} 页`;
    const midLabel = document.querySelector(".range-labels span:nth-child(2)");
    if (midLabel) midLabel.textContent = `${percent}%`;
  }

  function saveProgress(bookId) {
    const book = getBook(bookId);
    const range = document.getElementById("book-progress-range");
    if (!book || !range) return;
    const nextPage = clamp(Number(range.value) || 0, 0, book.pages);
    const delta = nextPage - book.progress;
    const before = captureChangeSnapshot();

    if (delta === 0) {
      showToast("进度已是最新", `《${book.title}》还停在原来的那一页。`, { icon: "book-open" });
      return;
    }

    book.progress = nextPage;
    book.lastReadAt = TODAY_KEY;
    if (!book.startedAt) book.startedAt = TODAY_KEY;
    if (nextPage >= book.pages) {
      book.status = "read";
      book.finishedAt = TODAY_KEY;
      if (delta > 0) addActivity(delta, Math.round(delta * 1.1));
      persist();
      closeOverlay();
      commitReadingChange({
        title: "又读完一本",
        message: `《${book.title}》已经读完了，恭喜。`,
        before,
      });
      return;
    }

    if (nextPage > 0) book.status = "reading";
    if (delta > 0) addActivity(delta, Math.round(delta * 1.1));
    persist();
    closeOverlay();
    commitReadingChange({
      title: "进度已保存",
      message: `《${book.title}》读到第 ${formatNumber(nextPage)} 页。`,
      before,
    });
  }

  function finishBook(bookId) {
    const book = getBook(bookId);
    if (!book) return;
    if (book.status === "read") {
      closeOverlay();
      return;
    }
    const before = captureChangeSnapshot();
    const delta = Math.max(0, book.pages - book.progress);
    book.progress = book.pages;
    book.status = "read";
    book.finishedAt = TODAY_KEY;
    book.lastReadAt = TODAY_KEY;
    if (!book.startedAt) book.startedAt = TODAY_KEY;
    if (delta > 0) addActivity(delta, Math.round(delta * 1.1));
    persist();
    closeOverlay();
    commitReadingChange({
      title: "又读完一本",
      message: `《${book.title}》已经读完了，恭喜。`,
      before,
    });
  }

  function startReading(bookId) {
    const book = getBook(bookId);
    if (!book || book.status === "read") return;
    book.status = "reading";
    book.startedAt = book.startedAt || TODAY_KEY;
    book.lastReadAt = TODAY_KEY;
    persist();
    closeOverlay();
    renderAll();
    showToast("开始阅读", `《${book.title}》正在翻开第一页。`, { icon: "book-open" });
  }

  function deleteBook(bookId) {
    const before = captureChangeSnapshot();
    const index = state.books.findIndex((book) => book.id === bookId);
    if (index < 0) return;
    const [removed] = state.books.splice(index, 1);
    persist();
    closeOverlay();
    renderAll();
    if (removed.ebook) {
      window.dispatchEvent(new CustomEvent("shiye:delete-ebook", { detail: { bookId: removed.id } }));
    }
    showToast("已从书架移除", `《${removed.title}》离开了书架，阅读记录仍然留在过去的足迹里。`, { icon: "trash" });
    const stillUnlocked = getAchievements().filter((achievement) => achievement.unlocked && !before.seen.has(achievement.id));
    if (stillUnlocked.length) {
      state.seenAchievements = Array.from(new Set([...(state.seenAchievements || []), ...stillUnlocked.map((achievement) => achievement.id)]));
      persist();
    }
  }

  function handleBookFormSubmit(form) {
    const mode = form.dataset.mode;
    const bookId = form.dataset.bookId;
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const author = String(formData.get("author") || "").trim();
    const categoryId = String(formData.get("categoryId") || "");
    const pages = clamp(Number(formData.get("pages")) || 0, 1, 5000);
    const status = ["want", "reading", "read"].includes(formData.get("status")) ? formData.get("status") : "want";
    const theme = COVER_THEMES.some((entry) => entry.id === formData.get("theme")) ? formData.get("theme") : "forest";
    const errorElement = document.getElementById("book-form-error");

    if (!title) {
      if (errorElement) errorElement.textContent = "给这本书一个名字吧。";
      document.getElementById("book-title")?.focus();
      return;
    }
    if (!author) {
      if (errorElement) errorElement.textContent = "写下作者的名字，之后更容易想起它。";
      document.getElementById("book-author")?.focus();
      return;
    }
    if (!pages) {
      if (errorElement) errorElement.textContent = "总页数需要大于 0。";
      document.getElementById("book-pages")?.focus();
      return;
    }
    if (errorElement) errorElement.textContent = "";
    const before = captureChangeSnapshot();

    if (mode === "add") {
      const today = TODAY_KEY;
      const book = {
        id: uid("book"),
        title: title.slice(0, 80),
        author: author.slice(0, 80),
        categoryId: state.categories.some((category) => category.id === categoryId) ? categoryId : state.categories[0].id,
        pages,
        progress: status === "read" ? pages : 0,
        status,
        theme,
        rating: 0,
        addedAt: today,
        startedAt: status === "want" ? null : today,
        finishedAt: status === "read" ? today : null,
        lastReadAt: status === "want" ? null : today,
      };
      state.books.unshift(book);
      persist();
      closeOverlay();
      commitReadingChange({
        title: "已加入书架",
        message: `《${book.title}》成为书架上的第 ${state.books.length} 本书。`,
        before,
      });
      return;
    }

    const book = getBook(bookId);
    if (!book) return;
    const oldStatus = book.status;
    const oldPages = book.pages;
    book.title = title.slice(0, 80);
    book.author = author.slice(0, 80);
    book.categoryId = state.categories.some((category) => category.id === categoryId) ? categoryId : state.categories[0].id;
    book.theme = theme;
    book.pages = pages;

    if (status === "read") {
      book.progress = pages;
      book.finishedAt = oldStatus === "read" ? (book.finishedAt || TODAY_KEY) : TODAY_KEY;
      book.lastReadAt = book.lastReadAt || TODAY_KEY;
    } else if (status === "want") {
      book.progress = 0;
      book.finishedAt = null;
    } else {
      book.progress = oldStatus === "reading" ? clamp(book.progress, 0, pages) : 0;
      book.finishedAt = null;
      if (oldStatus !== "reading") book.startedAt = TODAY_KEY;
      book.lastReadAt = book.lastReadAt || TODAY_KEY;
    }
    if (oldPages !== pages && book.progress > pages) book.progress = pages;

    persist();
    closeOverlay();
    commitReadingChange({
      title: "书籍信息已更新",
      message: `《${book.title}》已经保存。`,
      before,
    });
    window.setTimeout(() => openBookDetail(book.id), 320);
  }

  function handleGoalFormSubmit(form) {
    const value = clamp(Number(new FormData(form).get("goal")) || 0, 1, 365);
    const error = document.getElementById("goal-error");
    if (!value) {
      if (error) error.textContent = "目标需要是 1 到 365 之间的数字。";
      return;
    }
    state.profile.yearlyGoal = value;
    persist();
    closeOverlay();
    renderAll();
    showToast("年度目标已更新", `今年的阅读目标调整为 ${value} 本。`, { icon: "target" });
  }

  function handleCategoryFormSubmit(form) {
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const colorIndex = clamp(Number(formData.get("color")) || 0, 0, CATEGORY_PALETTE.length - 1);
    const error = document.getElementById("category-error");
    if (!name) {
      if (error) error.textContent = "分类需要一个名字。";
      return;
    }
    if (state.categories.some((category) => category.name === name)) {
      if (error) error.textContent = "已经有这个分类了，换一个名字吧。";
      return;
    }
    const palette = CATEGORY_PALETTE[colorIndex];
    state.categories.push({
      id: uid("cat"),
      name: name.slice(0, 12),
      color: palette.color,
      soft: palette.soft,
      icon: "bookmark",
    });
    persist();
    closeOverlay();
    renderAll();
    showToast("分类已创建", `「${name.slice(0, 12)}」成为新的阅读方向。`, { icon: "layers" });
  }

  function handleSettingsFormSubmit(form) {
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const goal = clamp(Number(formData.get("goal")) || 0, 1, 365);
    if (!name || !goal) {
      const error = document.getElementById("settings-error");
      if (error) error.textContent = "名字和目标都需要填写完整。";
      return;
    }
    state.profile.name = name.slice(0, 12);
    state.profile.yearlyGoal = goal;
    persist();
    closeOverlay();
    renderAll();
    showToast("设置已保存", `你好，${state.profile.name}。今年读 ${goal} 本。`, { icon: "user" });
  }

  function exportData() {
    const payload = {
      app: "拾页",
      exportedAt: new Date().toISOString(),
      data: state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `拾页-阅读数据-${TODAY_KEY}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("数据已导出", "一份属于你的阅读档案。" , { icon: "download" });
  }

  function resetData() {
    state = seedState();
    initializeAchievementHistory();
    ui.shelfStatus = "all";
    ui.shelfCategory = "all";
    ui.query = "";
    ui.sort = "recent";
    persist();
    closeOverlay();
    window.dispatchEvent(new CustomEvent("shiye:data-reset"));
    renderAll();
    showToast("阅读数据已清空", "书架、阅读记录和成就都回到了空白状态。", { icon: "refresh" });
  }

  function addImportedEbook(book) {
    state.books.unshift(book);
    persist();
    renderAll();
  }

  function saveEbookReadingPosition(bookId, position = {}) {
    const book = getBook(bookId);
    if (!book?.ebook) return;
    const wasWant = book.status === "want";
    book.readingPercent = book.status === "read" ? 100 : clamp(Number(position.percent) || 0, 0, 100);
    book.readerChapter = clamp(Number(position.chapterIndex) || 0, 0, Math.max(0, book.ebook.chapterCount - 1));
    book.readerScroll = clamp(Number(position.scrollRatio) || 0, 0, 1);
    book.lastReadAt = TODAY_KEY;
    if (wasWant) {
      book.status = "reading";
      book.startedAt = book.startedAt || TODAY_KEY;
    }
    syncEbookProgress(book);
    persist();
  }

  function recordReadingMinutes(minutes) {
    const value = clamp(Math.round(Number(minutes) || 0), 0, 360);
    if (!value) return;
    addActivity(0, value);
    persist();
  }

  function markEbookFinished(bookId) {
    const book = getBook(bookId);
    if (!book?.ebook || book.status === "read") return;
    const before = captureChangeSnapshot();
    book.readingPercent = 100;
    book.readerChapter = Math.max(0, book.ebook.chapterCount - 1);
    book.readerScroll = 1;
    book.progress = book.pages;
    book.status = "read";
    book.finishedAt = TODAY_KEY;
    book.lastReadAt = TODAY_KEY;
    book.startedAt = book.startedAt || TODAY_KEY;
    persist();
    commitReadingChange({
      title: "又读完一本",
      message: `《${book.title}》已经读完了，恭喜。`,
      before,
    });
  }

  function consumeReaderCleanupIds() {
    const ids = Array.isArray(window.__shiyeCleanupEbookIds) ? window.__shiyeCleanupEbookIds.slice() : [];
    window.__shiyeCleanupEbookIds = [];
    return ids;
  }

  window.ShiyeApp = {
    get state() {
      return state;
    },
    getBook: (bookId) => getBook(bookId),
    get categories() {
      return state.categories.map((category) => ({ id: category.id, name: category.name, color: category.color }));
    },
    getCurrentCategoryId: () => (ui.shelfCategory !== "all" ? ui.shelfCategory : state.categories[0]?.id),
    persist,
    renderAll,
    showToast,
    closeOverlay: (options) => closeOverlay(options),
    addImportedEbook,
    saveEbookReadingPosition,
    recordReadingMinutes,
    markEbookFinished,
    consumeReaderCleanupIds,
    translateTextBatch,
  };

  /* ---------- Event handling ---------- */

  function onDocumentClick(event) {
    const closeTrigger = event.target.closest("[data-close]");
    if (closeTrigger) {
      event.preventDefault();
      closeOverlay();
      return;
    }

    const overlay = event.target.closest(".overlay");
    if (overlay && event.target === overlay) {
      closeOverlay();
      return;
    }

    const viewTrigger = event.target.closest("[data-view]");
    if (viewTrigger && !event.target.closest("#overlay-root")) {
      event.preventDefault();
      closeOverlay({ restoreFocus: false });
      navigate(viewTrigger.dataset.view);
      return;
    }

    const actionTrigger = event.target.closest("[data-action]");
    if (actionTrigger) {
      const action = actionTrigger.dataset.action;
      const getId = () => actionTrigger.dataset.bookId || actionTrigger.closest("[data-book-id]")?.dataset.bookId;
      switch (action) {
        case "add-book":
          openBookForm();
          return;
        case "edit-goal":
          openGoalDialog();
          return;
        case "open-settings":
          openSettingsDialog();
          return;
        case "add-category":
          openCategoryDialog();
          return;
        case "search-shelf":
          navigate("shelf");
          window.setTimeout(() => document.getElementById("shelf-search")?.focus(), 220);
          return;
        case "view-reading":
          ui.shelfStatus = "reading";
          ui.shelfCategory = "all";
          ui.query = "";
          navigate("shelf");
          renderShelf();
          return;
        case "clear-filters":
          ui.shelfStatus = "all";
          ui.shelfCategory = "all";
          ui.query = "";
          renderShelf();
          return;
        case "run-translation":
          runTranslation();
          return;
        case "clear-translation":
          clearTranslation();
          return;
        case "edit-translation":
          editTranslationSource();
          return;
        case "copy-translation":
          copyTranslation();
          return;
        case "retry-paragraph": {
          const index = Number(actionTrigger.dataset.index);
          if (Number.isInteger(index)) retryTranslationParagraph(index);
          return;
        }
        case "lookup-selection": {
          const pending = selectionToolState;
          hideSelectionTool();
          try {
            window.getSelection()?.removeAllRanges();
          } catch {
            // Selection cleanup is not essential.
          }
          if (pending) lookupWord(pending.word, pending.context);
          return;
        }
        case "focus-dictionary":
          scrollDictionaryIntoView();
          window.setTimeout(() => document.getElementById("dictionary-input")?.focus({ preventScroll: true }), 360);
          return;
        case "play-word":
          playWordAudio(actionTrigger.dataset.audio || "");
          return;
        case "edit-book": {
          const bookId = getId();
          closeOverlay({ restoreFocus: false });
          if (bookId) window.setTimeout(() => openBookForm(bookId), 80);
          return;
        }
        case "save-progress":
          saveProgress(getId());
          return;
        case "finish-book":
          finishBook(getId());
          return;
        case "start-reading":
          startReading(getId());
          return;
        case "delete-book": {
          const book = getBook(getId());
          if (!book) return;
          if (actionTrigger.dataset.confirm === "1") {
            deleteBook(book.id);
            return;
          }
          actionTrigger.dataset.confirm = "1";
          actionTrigger.classList.add("is-confirming");
          actionTrigger.textContent = "再次点击，确认移除";
          window.setTimeout(() => {
            if (!actionTrigger.isConnected) return;
            actionTrigger.dataset.confirm = "";
            actionTrigger.classList.remove("is-confirming");
            actionTrigger.textContent = "从书架移除";
          }, 4000);
          return;
        }
        case "export-data":
          exportData();
          return;
        case "reset-data": {
          if (actionTrigger.dataset.confirm === "1") {
            resetData();
            return;
          }
          actionTrigger.dataset.confirm = "1";
          actionTrigger.textContent = "再次点击，确认清空";
          window.setTimeout(() => {
            if (!actionTrigger.isConnected) return;
            actionTrigger.dataset.confirm = "";
            actionTrigger.innerHTML = `${icon("refresh")} 清空阅读数据`;
          }, 4000);
          return;
        }
        default:
          return;
      }
    }

    const dictSuggestion = event.target.closest("[data-dict-suggestion]");
    if (dictSuggestion) {
      lookupWord(dictSuggestion.dataset.dictSuggestion);
      return;
    }

    const statusTrigger = event.target.closest("[data-status]");
    if (statusTrigger) {
      ui.shelfStatus = statusTrigger.dataset.status;
      renderShelf();
      return;
    }

    const categoryTrigger = event.target.closest("[data-filter-category]");
    if (categoryTrigger) {
      const categoryId = categoryTrigger.dataset.filterCategory;
      ui.shelfStatus = "all";
      ui.query = "";
      ui.shelfCategory = categoryId;
      if (categoryId !== "all") {
        navigate("shelf");
        renderShelf();
        if (ui.view === "shelf") window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      } else {
        renderShelf();
      }
      return;
    }

    const bookTrigger = event.target.closest("[data-book]");
    if (bookTrigger) {
      openBookDetail(bookTrigger.dataset.book);
    }
  }

  function onDocumentSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === "book-form") {
      event.preventDefault();
      handleBookFormSubmit(form);
    } else if (form.id === "goal-form") {
      event.preventDefault();
      handleGoalFormSubmit(form);
    } else if (form.id === "category-form") {
      event.preventDefault();
      handleCategoryFormSubmit(form);
    } else if (form.id === "settings-form") {
      event.preventDefault();
      handleSettingsFormSubmit(form);
    } else if (form.id === "dictionary-form") {
      event.preventDefault();
      const input = form.querySelector("#dictionary-input");
      lookupWord(input?.value || "");
    }
  }

  function onDocumentInput(event) {
    if (event.target.id === "shelf-search") {
      ui.query = event.target.value;
      renderShelfMeta();
      renderBookGrid();
    } else if (event.target.id === "book-progress-range") {
      updateProgressOutput();
    } else if (event.target.closest("#book-form")) {
      updateCoverPreview();
    } else if (event.target.id === "translate-input") {
      translateState.sourceText = event.target.value;
      translateState.status = "idle";
      translateState.error = "";
      translateState.showEditor = true;
      translateState.paragraphs = [];
      translateState.translations = [];
      translateState.detected = "";
      translateState.providers = [];
      const count = document.getElementById("translate-count");
      if (count) count.textContent = translationCountLabel();
      const runButton = document.querySelector('[data-action="run-translation"]');
      if (runButton) runButton.disabled = !event.target.value.trim();
      scheduleSaveTranslationDraft();
    }
  }

  function onDocumentChange(event) {
    if (event.target.id === "shelf-sort") {
      ui.sort = event.target.value;
      renderBookGrid();
    } else if (event.target.id === "translate-from" || event.target.id === "translate-to") {
      const nextFrom = event.target.id === "translate-from" ? event.target.value : translateState.from;
      const nextTo = event.target.id === "translate-to" ? event.target.value : translateState.to;
      if (nextFrom === translateState.from && nextTo === translateState.to) return;
      translateState.from = nextFrom;
      translateState.to = nextTo;
      translateState.status = "idle";
      translateState.error = "";
      translateState.showEditor = true;
      translateState.paragraphs = [];
      translateState.translations = [];
      translateState.detected = "";
      translateState.providers = [];
      saveTranslationDraft();
      renderTranslateView();
    }
  }

  function onDocumentKeydown(event) {
    if (event.key === "Escape") {
      if (overlayOpen) {
        event.preventDefault();
        closeOverlay();
        return;
      }
      hideSelectionTool();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && document.activeElement?.id === "translate-input") {
      event.preventDefault();
      runTranslation();
      return;
    }
    trapOverlayFocus(event);
    if (overlayOpen) return;
    const tag = document.activeElement?.tagName;
    const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable;
    if (event.key === "/" && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      navigate("shelf");
      window.setTimeout(() => document.getElementById("shelf-search")?.focus(), 220);
    }
  }

  function onPopState() {
    const view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
    ui.view = view;
    applyView({ scroll: false });
    closeOverlay({ restoreFocus: false });
  }

  /* ---------- Init ---------- */

  function init() {
    hydrateIcons();
    initializeAchievementHistory();
    if (!location.hash || !VIEWS.includes(location.hash.slice(1))) {
      history.replaceState(null, "", "#overview");
    }
    renderAll();
    applyView();
    if (window.__shiyeDemoCleaned) {
      window.__shiyeDemoCleaned = false;
      showToast("旧示例数据已清理", "示例书、演示统计和示例导入内容已经移除。", { icon: "refresh" });
    }
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("submit", onDocumentSubmit);
    document.addEventListener("input", onDocumentInput);
    document.addEventListener("change", onDocumentChange);
    document.addEventListener("keydown", onDocumentKeydown);
    document.addEventListener("mouseup", handleTranslationSelection);
    document.addEventListener("mousedown", (event) => {
      if (!event.target.closest?.("#selection-tool") && !event.target.closest?.(".compare-source-text")) {
        hideSelectionTool();
      }
    });
    window.addEventListener("scroll", hideSelectionTool, true);
    window.addEventListener("resize", hideSelectionTool);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const next = normalizeState(JSON.parse(event.newValue));
        if (!next) return;
        state = next;
        initializeAchievementHistory();
        renderAll();
      } catch {
        // Keep the current view if another tab wrote an incomplete state.
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
