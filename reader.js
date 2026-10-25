/* =========================================================
   拾页 · reader
   EPUB / TXT import, a quiet reading room, and bilingual margins.
   ========================================================= */

(() => {
  "use strict";

  const app = window.ShiyeApp;
  if (!app) return;

  /* ---------- Constants ---------- */

  const DB_NAME = "shiye-reader-content";
  const DB_VERSION = 1;
  const EBOOK_STORE = "ebooks";
  const TRANSLATION_STORE = "translations";
  const PREFS_KEY = "shiye.reader.prefs.v2";
  const MAX_FILE_BYTES = 42 * 1024 * 1024;
  const MAX_IMPORT_CHAPTERS = 1200;
  const MAX_LINKED_CHAPTERS = 80;
  const TRANSLATION_BATCH_SIZE = 8;
  const COVER_THEMES = ["forest", "clay", "ink", "sand", "sky", "plum"];
  const CHAPTER_MARKER_RE = /^(?:第[0-9〇零一二三四五六七八九十百千万两]+[章回节卷部篇集](?:[\s：:、.．-].*)?|(?:chapter|part|book)\s+(?:[0-9ivxlc]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)(?:[\s：:.-].*)?)$/i;
  const SENTENCE_MARKERS = [". ", "! ", "? ", "。", "！", "？", "\n"];

  const LANGUAGE_LABELS = {
    en: "English",
    ja: "日本語",
    fr: "Français",
    de: "Deutsch",
    es: "Español",
    ko: "한국어",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
    zh: "中文",
    auto: "原文",
    unknown: "原文",
  };

  const SOURCE_LANGUAGE_CODES = new Set(["en", "ja", "fr", "de", "es", "ko"]);
  const WORD_LIMIT = 56;

  const ICONS = {
    "arrow-left": '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.1M4 12h.1M4 18h.1"/>',
    languages: '<path d="M3.5 5.5h8M7.5 3.5v2M5.5 5.5c.5 3.3 2.2 5.9 5 7.6M11 5.5c-.5 3.2-2 5.8-4.4 7.8"/><path d="m13.3 20.5 3.4-8.5 3.4 8.5M14.5 17.5h4.4"/>',
    book: '<path d="M4.5 6.2c2.7-.9 5.2-.4 7.5 1.3v11c-2.3-1.7-4.8-2.2-7.5-1.3V6.2Z"/><path d="M19.5 6.2c-2.7-.9-5.2-.4-7.5 1.3v11c2.3-1.7 4.8-2.2 7.5-1.3V6.2Z"/>',
    upload: '<path d="M12 16V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 14.5v3A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-3"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.1 4.1"/>',
    volume: '<path d="M4 9h4l5-4v14l-5-4H4V9Z"/><path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10"/>',
    check: '<path d="m5 12.5 4.2 4.2L19 6.9"/>',
    "chevron-left": '<path d="m15 6-6 6 6 6"/>',
    "chevron-right": '<path d="m9 6 6 6-6 6"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 10.5v6M12 7.5h.1"/>',
    refresh: '<path d="M20 8.5A8.5 8.5 0 1 0 19.2 16"/><path d="M20 3.5v5h-5"/>',
  };

  /* ---------- Utilities ---------- */

  function icon(name, className = "") {
    return `<span class="icon ${className}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.book}</svg></span>`;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return entities[character];
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeText(value) {
    return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function uid(prefix = "book") {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function todayKey() {
    const day = new Date();
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("zh-CN").format(Math.round(Number(value) || 0));
  }

  function themeForTitle(title) {
    let total = 0;
    for (const character of String(title || "")) total = (total + character.codePointAt(0) * 17) % 9973;
    return COVER_THEMES[total % COVER_THEMES.length];
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function getFileExtension(name) {
    const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function stripExtension(name) {
    return String(name || "未命名电子书").replace(/\.[^.]+$/, "").trim() || "未命名电子书";
  }

  function currentBook() {
    return state.activeBookId ? app.getBook(state.activeBookId) : null;
  }

  /* ---------- Preferences ---------- */

  function loadPreferences() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
      if (!parsed || typeof parsed !== "object") throw new Error("empty");
      const bilingual = Boolean(parsed.bilingual);
      const mode = parsed.mode === "scroll" ? "scroll" : "paged";
      return {
        fontSize: clamp(Number(parsed.fontSize) || 18, 14, 24),
        lineHeight: clamp(Number(parsed.lineHeight) || 1.9, 1.55, 2.25),
        bilingual,
        mode: bilingual ? "scroll" : mode,
      };
    } catch {
      return { fontSize: 18, lineHeight: 1.9, bilingual: false, mode: "paged" };
    }
  }

  const prefs = loadPreferences();

  function savePreferences() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Reading remains available for this session.
    }
  }

  function applyPreferences() {
    if (!ui.layer) return;
    ui.layer.style.setProperty("--reader-font-size", `${prefs.fontSize}px`);
    ui.layer.style.setProperty("--reader-line-height", String(prefs.lineHeight));
    if (ui.sizeLabel) ui.sizeLabel.textContent = `${prefs.fontSize}px`;
    if (ui.lineButtons) {
      ui.lineButtons.querySelectorAll("[data-reader-line]").forEach((button) => {
        button.classList.toggle("is-active", Math.abs(Number(button.dataset.readerLine) - prefs.lineHeight) < 0.02);
      });
    }
    if (ui.modeButtons) {
      ui.modeButtons.querySelectorAll("[data-reader-mode]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.readerMode === state.mode);
      });
    }
    if (ui.modeValue) ui.modeValue.textContent = state.mode === "paged" ? "翻页" : "滚动";
  }

  /* ---------- IndexedDB ---------- */

  let dbPromise = null;

  function openDatabase() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("当前浏览器不支持本地电子书存储。"));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(EBOOK_STORE)) {
          db.createObjectStore(EBOOK_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(TRANSLATION_STORE)) {
          const store = db.createObjectStore(TRANSLATION_STORE, { keyPath: "key" });
          store.createIndex("bookId", "bookId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("无法打开本地书库。"));
    });
    return dbPromise;
  }

  async function dbGet(storeName, key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbPut(storeName, value) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("本地存储写入失败。"));
    });
  }

  async function deleteBookContent(bookId) {
    if (!bookId) return;
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EBOOK_STORE, TRANSLATION_STORE], "readwrite");
      transaction.objectStore(EBOOK_STORE).delete(bookId);
      const store = transaction.objectStore(TRANSLATION_STORE);
      if (store.indexNames.contains("bookId")) {
        const index = store.index("bookId");
        const cursorRequest = index.openCursor(IDBKeyRange.only(bookId));
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          cursor.delete();
          cursor.continue();
        };
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function clearReaderData() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EBOOK_STORE, TRANSLATION_STORE], "readwrite");
      transaction.objectStore(EBOOK_STORE).clear();
      transaction.objectStore(TRANSLATION_STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /* ---------- EPUB / TXT parsing ---------- */

  function parseMarkup(text, type = "application/xml") {
    const doc = new DOMParser().parseFromString(String(text || ""), type);
    if (type.includes("xml") && doc.querySelector("parsererror")) {
      return new DOMParser().parseFromString(String(text || ""), "text/html");
    }
    return doc;
  }

  function allByLocalName(root, localName) {
    return Array.from(root.getElementsByTagName("*")).filter((element) => element.localName === localName);
  }

  function firstByLocalName(root, localName) {
    return allByLocalName(root, localName)[0] || null;
  }

  function zipFile(zip, filePath) {
    const wanted = String(filePath || "").replace(/^\/+/, "");
    if (!wanted) return null;
    const candidates = [wanted];
    try { candidates.push(decodeURIComponent(wanted)); } catch {}
    candidates.push(wanted.replace(/ /g, "%20"));
    for (const candidate of candidates) {
      const entry = zip.file(candidate);
      if (entry) return entry;
    }
    const lower = wanted.toLowerCase();
    const key = Object.keys(zip.files).find((name) => {
      if (name.endsWith("/")) return false;
      let decoded = name;
      try { decoded = decodeURIComponent(name); } catch {}
      return name.toLowerCase() === lower || decoded.toLowerCase() === lower;
    });
    return key ? zip.file(key) : null;
  }

  function pathKey(value) {
    return String(value || "").replace(/^\/+/, "").replace(/\\/g, "/").toLowerCase();
  }

  function resolveZipPath(baseFile, href) {
    const cleanHref = String(href || "").split("#")[0].split("?")[0];
    if (!cleanHref) return String(baseFile || "").split("#")[0];
    try {
      const base = new URL(`https://ebook.local/${String(baseFile || "").replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/")}`);
      const resolved = new URL(cleanHref, base);
      return decodeURIComponent(resolved.pathname.replace(/^\/+/, ""));
    } catch {
      const directory = String(baseFile || "").split("/").slice(0, -1).join("/");
      const combined = `${directory}/${cleanHref}`.replace(/\/+/g, "/");
      try { return decodeURIComponent(combined); } catch { return combined; }
    }
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(String(value || ""));
    } catch {
      return String(value || "");
    }
  }

  function isExternalHref(href) {
    return /^(?:https?:|mailto:|tel:)/i.test(String(href || "").trim());
  }

  function collectAnchorIds(element, body) {
    const ids = new Set();
    let cursor = element;
    while (cursor && cursor !== body && cursor.nodeType === Node.ELEMENT_NODE) {
      if (cursor.id) ids.add(cursor.id);
      cursor = cursor.parentElement;
    }
    element.querySelectorAll("[id]").forEach((node) => {
      if (node.id) ids.add(node.id);
    });
    element.querySelectorAll("a[name]").forEach((node) => {
      const name = node.getAttribute("name");
      if (name) ids.add(name);
    });
    return Array.from(ids);
  }

  function sanitizeInline(element, context = null) {
    let output = "";
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        output += escapeHTML(node.nodeValue);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = node.tagName.toLowerCase();
      if (tag === "br") {
        output += "<br>";
      } else if (tag === "img") {
        const alt = normalizeText(node.getAttribute("alt") || "");
        if (alt) output += `<span class="reader-image-alt">［图片：${escapeHTML(alt)}］</span>`;
      } else if (tag === "a") {
        const href = String(node.getAttribute("href") || "").trim();
        const inner = sanitizeInline(node, context);
        if (!href) {
          output += inner;
        } else if (isExternalHref(href)) {
          output += `<a class="reader-external-link" href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
        } else if (context && !/^[a-z][a-z0-9+.-]*:/i.test(href)) {
          const hashIndex = href.indexOf("#");
          const rawPath = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
          const fragment = hashIndex >= 0 ? safeDecode(href.slice(hashIndex + 1)) : "";
          const targetPath = rawPath
            ? resolveZipPath(context.basePath, rawPath)
            : String(context.basePath || "");
          const type = `${node.getAttribute("epub:type") || ""} ${node.getAttribute("role") || ""}`.toLowerCase();
          const marker = normalizeText(node.textContent);
          const noteRef = type.includes("noteref")
            || type.includes("doc-noteref")
            || (Boolean(fragment) && marker.length <= 6 && /^[\s\d*†‡§¶\[\]()（）.]+$/.test(marker));
          const linkIndex = context.links.length;
          context.links.push({ path: targetPath, fragment, note: noteRef });
          output += `<a class="reader-epub-link${noteRef ? " is-note-ref" : ""}" role="link" tabindex="0" data-reader-link="${linkIndex}">${inner}</a>`;
        } else {
          output += inner;
        }
      } else if (["em", "i", "strong", "b", "u", "s", "sup", "sub", "code"].includes(tag)) {
        output += `<${tag}>${sanitizeInline(node, context)}</${tag}>`;
      } else {
        output += sanitizeInline(node, context);
      }
    }
    return output;
  }

  function extractBlocks(doc, basePath = "") {
    doc.querySelectorAll("script, style, noscript, svg, iframe, object, embed, form, input, button, select, textarea, nav").forEach((node) => node.remove());
    const body = doc.body || doc.documentElement;
    if (!body) return { blocks: [], links: [] };
    const selector = "h1,h2,h3,h4,h5,h6,p,blockquote,li,pre";
    const elements = Array.from(body.querySelectorAll(selector)).filter((element) => {
      const parentBlock = element.parentElement?.closest(selector);
      return !parentBlock;
    });
    const context = { basePath, links: [] };
    const blocks = elements.map((element) => {
      const tag = element.tagName.toLowerCase();
      const text = normalizeText(element.textContent);
      if (!text) return null;
      const type = tag === "blockquote" ? "blockquote"
        : tag === "pre" ? "pre"
          : tag === "li" ? "li"
            : ["h1", "h2"].includes(tag) ? tag
              : ["h3", "h4", "h5", "h6"].includes(tag) ? "h3"
                : "p";
      const html = type === "pre" ? escapeHTML(text) : (sanitizeInline(element, context) || escapeHTML(text));
      const anchors = collectAnchorIds(element, body);
      return { type, text, html, anchors };
    }).filter(Boolean);

    if (blocks.length) return { blocks, links: context.links };

    const fallbackText = normalizeText(body.innerText || body.textContent || "");
    if (!fallbackText) return { blocks: [], links: [] };
    const paragraphs = fallbackText.split(/\n+/).map((line) => normalizeText(line)).filter(Boolean);
    return {
      blocks: paragraphs.map((text) => ({ type: "p", text, html: escapeHTML(text), anchors: [] })),
      links: [],
    };
  }

  function normalizeChapterTitle(title) {
    return normalizeText(title).toLocaleLowerCase();
  }

  async function readEpubToc(zip, opfDoc, manifestItems, opfPath) {
    const nodes = [];
    const byPath = new Map();
    const MAX_TOC_NODES = 6000;

    function parseTocHref(href, basePath) {
      const raw = String(href || "").trim();
      if (!raw) return { path: "", fragment: "" };
      const hashIndex = raw.indexOf("#");
      const pathPart = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
      const fragment = hashIndex >= 0 ? safeDecode(raw.slice(hashIndex + 1)) : "";
      return {
        path: pathPart ? resolveZipPath(basePath, pathPart) : "",
        fragment,
      };
    }

    function addNode({ label, path, fragment, parentId, depth }) {
      if (!label || nodes.length >= MAX_TOC_NODES) return null;
      const node = {
        id: `toc-${nodes.length + 1}`,
        label: normalizeText(label),
        path: path || "",
        fragment: fragment || "",
        parentId: parentId || null,
        depth: clamp(Number(depth) || 0, 0, 12),
        order: nodes.length,
      };
      nodes.push(node);
      if (node.path && !byPath.has(node.path)) byPath.set(node.path, node.label);
      return node;
    }

    const navItem = manifestItems.find((item) => (item.properties || "").split(/\s+/).includes("nav"));
    if (navItem) {
      try {
        const entry = zipFile(zip, navItem.path);
        if (entry) {
          const html = await entry.async("string");
          const doc = new DOMParser().parseFromString(html, "text/html");
          const navs = Array.from(doc.querySelectorAll("nav"));
          const tocNav = navs.find((nav) => {
            const type = nav.getAttribute("epub:type") || nav.getAttribute("role") || nav.getAttribute("type") || "";
            return type.includes("toc");
          }) || navs[0];
          const walkList = (list, parentId, depth) => {
            if (!list || nodes.length >= MAX_TOC_NODES) return;
            Array.from(list.children)
              .filter((child) => child.localName === "li")
              .forEach((item) => {
                if (nodes.length >= MAX_TOC_NODES) return;
                const children = Array.from(item.children);
                const anchor = children.find((child) => child.localName === "a");
                const labelNode = anchor || children.find((child) => ["span", "strong", "b", "p", "div"].includes(child.localName));
                const label = normalizeText(labelNode?.textContent || "");
                const nestedList = children.find((child) => child.localName === "ol");
                if (!label) {
                  if (nestedList) walkList(nestedList, parentId, depth);
                  return;
                }
                const parsed = parseTocHref(anchor?.getAttribute("href") || "", navItem.path);
                const node = addNode({
                  label,
                  path: parsed.path,
                  fragment: parsed.fragment,
                  parentId,
                  depth,
                });
                if (nestedList) walkList(nestedList, node?.id || parentId, depth + 1);
              });
          };
          const navList = Array.from(tocNav?.children || []).find((child) => child.localName === "ol")
            || tocNav?.querySelector("ol");
          walkList(navList, null, 0);
        }
      } catch {
        // Fall through to NCX.
      }
    }

    if (!nodes.length) {
      const spine = allByLocalName(opfDoc, "spine")[0];
      const ncxId = spine?.getAttribute("toc");
      const ncxItem = (ncxId && manifestItems.find((item) => item.id === ncxId))
        || manifestItems.find((item) => item.mediaType === "application/x-dtbncx+xml" || /\.ncx$/i.test(item.path));
      if (ncxItem) {
        try {
          const entry = zipFile(zip, ncxItem.path);
          if (entry) {
            const doc = parseMarkup(await entry.async("string"));
            const navMap = firstByLocalName(doc, "navMap");
            const walkPoints = (parent, parentId, depth) => {
              if (!parent || nodes.length >= MAX_TOC_NODES) return;
              Array.from(parent.children)
                .filter((child) => child.localName === "navPoint")
                .forEach((point) => {
                  if (nodes.length >= MAX_TOC_NODES) return;
                  const label = normalizeText(firstByLocalName(point, "navLabel")?.textContent || "");
                  const content = Array.from(point.children).find((child) => child.localName === "content");
                  const parsed = parseTocHref(content?.getAttribute("src") || "", ncxItem.path);
                  if (!label) {
                    walkPoints(point, parentId, depth);
                    return;
                  }
                  const node = addNode({
                    label,
                    path: parsed.path,
                    fragment: parsed.fragment,
                    parentId,
                    depth,
                  });
                  walkPoints(point, node?.id || parentId, depth + 1);
                });
            };
            walkPoints(navMap, null, 0);
          }
        } catch {
          // TOC is a nice-to-have; chapters can fall back to their headings.
        }
      }
    }

    return { nodes, byPath };
  }

  function splitLongBlockText(text, maxLength = 1600) {
    const units = [];
    let remaining = String(text || "").trim();
    while (remaining.length > maxLength) {
      const candidates = [". ", "! ", "? ", "。", "！", "？", "；"]
        .map((marker) => remaining.lastIndexOf(marker, maxLength))
        .filter((position) => position > maxLength * 0.35);
      let cut = candidates.length ? Math.max(...candidates) + 1 : -1;
      if (cut < 0) cut = remaining.lastIndexOf(" ", maxLength);
      if (cut < maxLength * 0.35) cut = maxLength;
      units.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) units.push(remaining);
    return units;
  }

  function splitOversizedBlocks(blocks) {
    const result = [];
    for (const block of blocks) {
      if (block.text.length <= 1800 || String(block.html || "").includes("data-reader-link")) {
        result.push(block);
        continue;
      }
      splitLongBlockText(block.text).forEach((text, index) => {
        result.push({
          type: index === 0 ? block.type : "p",
          text,
          html: escapeHTML(text),
          anchors: index === 0 && Array.isArray(block.anchors) ? block.anchors : [],
        });
      });
    }
    return result;
  }

  function textForFirstHeading(blocks) {
    const first = blocks.find((block) => ["h1", "h2", "h3"].includes(block.type));
    return first ? first.text : "";
  }

  async function parseEpubFile(file, onProgress = () => {}) {
    if (!window.JSZip) throw new Error("EPUB 解析组件没有加载，请刷新页面后再试。");
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const containerEntry = zipFile(zip, "META-INF/container.xml");
    if (!containerEntry) throw new Error("这个文件不像是一本 EPUB：缺少 container.xml。");
    const containerDoc = parseMarkup(await containerEntry.async("string"));
    const rootfile = firstByLocalName(containerDoc, "rootfile");
    const opfPath = rootfile?.getAttribute("full-path");
    if (!opfPath) throw new Error("这个 EPUB 没有找到书籍信息文件。");
    const opfEntry = zipFile(zip, opfPath);
    if (!opfEntry) throw new Error("EPUB 里的书籍信息文件缺失，可能已损坏。");
    const opfDoc = parseMarkup(await opfEntry.async("string"));

    const manifestItems = allByLocalName(opfDoc, "item").map((item) => ({
      id: item.getAttribute("id") || "",
      path: resolveZipPath(opfPath, item.getAttribute("href") || ""),
      mediaType: item.getAttribute("media-type") || "",
      properties: item.getAttribute("properties") || "",
    }));
    const manifest = new Map(manifestItems.map((item) => [item.id, item]));
    const spine = allByLocalName(opfDoc, "spine")[0];
    const itemRefs = allByLocalName(opfDoc, "itemref");
    if (!itemRefs.length || !spine) throw new Error("这个 EPUB 没有可以阅读的章节。");

    const title = normalizeText(firstByLocalName(opfDoc, "title")?.textContent) || stripExtension(file.name);
    const author = normalizeText(firstByLocalName(opfDoc, "creator")?.textContent) || "佚名";
    const language = normalizeText(firstByLocalName(opfDoc, "language")?.textContent).toLowerCase();
    const toc = await readEpubToc(zip, opfDoc, manifestItems, opfPath);
    const chapters = [];
    let totalChars = 0;

    for (let index = 0; index < itemRefs.length; index += 1) {
      const idref = itemRefs[index].getAttribute("idref");
      const item = manifest.get(idref);
      if (!item || !item.path) continue;
      if (item.mediaType && !/xhtml|html|xml/.test(item.mediaType) && !/\.x?html?$/i.test(item.path)) continue;
      const entry = zipFile(zip, item.path);
      if (!entry) continue;
      let html;
      try {
        html = await entry.async("string");
      } catch {
        continue;
      }
      const doc = new DOMParser().parseFromString(html, "text/html");
      const extracted = extractBlocks(doc, item.path);
      let blocks = splitOversizedBlocks(extracted.blocks);
      if (!blocks.length) continue;
      const tocTitle = toc.byPath.get(item.path) || "";
      const headingTitle = textForFirstHeading(blocks);
      let chapterTitle = normalizeText(tocTitle || headingTitle) || `第 ${chapters.length + 1} 章`;
      if (blocks[0] && ["h1", "h2", "h3"].includes(blocks[0].type)
        && normalizeChapterTitle(blocks[0].text) === normalizeChapterTitle(chapterTitle)
        && blocks.length > 1) {
        blocks = blocks.slice(1);
      }
      if (!blocks.length) continue;
      const anchors = {};
      blocks.forEach((block, blockIndex) => {
        (block.anchors || []).forEach((anchor) => {
          if (anchor && !Object.prototype.hasOwnProperty.call(anchors, anchor)) anchors[anchor] = blockIndex;
        });
        delete block.anchors;
      });
      const charCount = blocks.reduce((sum, block) => sum + block.text.length, 0);
      totalChars += charCount;
      chapters.push({
        title: chapterTitle.slice(0, 120),
        blocks,
        chars: charCount,
        path: item.path,
        links: extracted.links,
        anchors,
      });
      if (index % 3 === 0) onProgress(`正在整理第 ${Math.min(index + 1, itemRefs.length)} / ${itemRefs.length} 个书页…`);
      if (chapters.length >= MAX_IMPORT_CHAPTERS) break;
    }

    // Some EPUBs keep footnotes and endnotes in documents that are linked
    // from the spine but not listed in it. Pull those documents in so the
    // references have somewhere to land.
    const processedPaths = new Set(chapters.map((chapter) => pathKey(chapter.path)));
    let linkedChapterCount = 0;
    while (linkedChapterCount < MAX_LINKED_CHAPTERS && chapters.length < MAX_IMPORT_CHAPTERS) {
      const unresolved = new Set();
      chapters.forEach((chapter) => {
        (chapter.links || []).forEach((link) => {
          const key = pathKey(link.path);
          if (key && !processedPaths.has(key)) unresolved.add(link.path);
        });
      });
      if (!unresolved.size) break;

      let added = false;
      for (const targetPath of unresolved) {
        const key = pathKey(targetPath);
        if (!key || processedPaths.has(key)) continue;
        processedPaths.add(key);
        const item = manifestItems.find((entry) => pathKey(entry.path) === key
          && !(entry.properties || "").split(/\s+/).includes("nav"));
        const filePath = item?.path || targetPath;
        if (item?.mediaType && !/xhtml|html|xml/i.test(item.mediaType) && !/\.x?html?$/i.test(filePath)) continue;
        const entry = zipFile(zip, filePath);
        if (!entry) continue;
        let html;
        try {
          html = await entry.async("string");
        } catch {
          continue;
        }
        const doc = new DOMParser().parseFromString(html, "text/html");
        const extracted = extractBlocks(doc, filePath);
        let blocks = splitOversizedBlocks(extracted.blocks);
        if (!blocks.length) continue;
        const tocTitle = toc.byPath.get(filePath) || "";
        const headingTitle = textForFirstHeading(blocks);
        let chapterTitle = normalizeText(tocTitle || headingTitle) || "注释";
        if (blocks[0] && ["h1", "h2", "h3"].includes(blocks[0].type)
          && normalizeChapterTitle(blocks[0].text) === normalizeChapterTitle(chapterTitle)
          && blocks.length > 1) {
          blocks = blocks.slice(1);
        }
        if (!blocks.length) continue;
        const anchors = {};
        blocks.forEach((block, blockIndex) => {
          (block.anchors || []).forEach((anchor) => {
            if (anchor && !Object.prototype.hasOwnProperty.call(anchors, anchor)) anchors[anchor] = blockIndex;
          });
          delete block.anchors;
        });
        const charCount = blocks.reduce((sum, block) => sum + block.text.length, 0);
        totalChars += charCount;
        chapters.push({
          title: chapterTitle.slice(0, 120),
          blocks,
          chars: charCount,
          path: filePath,
          links: extracted.links,
          anchors,
        });
        linkedChapterCount += 1;
        added = true;
        onProgress(`正在补齐第 ${linkedChapterCount} 个注释页…`);
        if (linkedChapterCount >= MAX_LINKED_CHAPTERS || chapters.length >= MAX_IMPORT_CHAPTERS) break;
      }
      if (!added) break;
    }

    if (!chapters.length) throw new Error("这本 EPUB 没有可提取的文字章节；它可能只有图片，或带有 DRM 保护。");
    return {
      title: title.slice(0, 100),
      author: author.slice(0, 100),
      language,
      chapters,
      toc: toc.nodes,
      totalChars,
    };
  }

  function decodeTxtBuffer(buffer) {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let text = decoder.decode(buffer);
    const badCharacters = (text.match(/\uFFFD/g) || []).length;
    if (badCharacters > Math.max(6, text.length * 0.0015)) {
      try {
        const alternate = new TextDecoder("gb18030").decode(buffer);
        if (alternate && (alternate.match(/\uFFFD/g) || []).length < badCharacters) text = alternate;
      } catch {
        // Keep UTF-8 when the alternate decoder is unavailable.
      }
    }
    return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  }

  function splitTextParagraphs(text) {
    const normalized = String(text || "").replace(/\r\n?/g, "\n").trim();
    if (!normalized) return [];
    let blocks = normalized.split(/\n\s*\n/).map(normalizeText).filter(Boolean);
    if (blocks.length <= 1) {
      blocks = normalized.split(/\n+/).map(normalizeText).filter(Boolean);
    }
    return blocks;
  }

  function isChapterLine(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed || trimmed.length > 55) return false;
    return CHAPTER_MARKER_RE.test(trimmed)
      || /^(?:序章|前言|序言|楔子|引子|尾声|后记|终章|番外)(?:[\s：:、.．-].*)?$/.test(trimmed)
      || /^[0-9]{1,3}[、.．]\s*\S.{0,34}$/.test(trimmed);
  }

  function txtLanguage(text) {
    const kana = (text.match(/[\u3040-\u30ff]/g) || []).length;
    const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
    const latin = (text.match(/[A-Za-z]/g) || []).length;
    if (kana > 20) return "ja";
    if (cjk > latin * 0.45 && cjk > 20) return "zh";
    return "en";
  }

  function parseTxtText(text, fileName, onProgress = () => {}) {
    const normalized = String(text || "").replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
    if (!normalized) throw new Error("这个文本文件是空的。");
    const lines = normalized.split("\n");
    const markerIndexes = [];
    lines.forEach((line, index) => {
      if (isChapterLine(line)) markerIndexes.push(index);
    });

    const chapters = [];
    if (markerIndexes.length >= 2) {
      if (markerIndexes[0] > 0) {
        const preface = lines.slice(0, markerIndexes[0]).join("\n").trim();
        if (preface.length > 120) {
          const blocks = splitTextParagraphs(preface).map((paragraph) => ({ type: "p", text: paragraph, html: escapeHTML(paragraph) }));
          if (blocks.length) chapters.push({ title: "前言", blocks, chars: preface.length });
        }
      }
      markerIndexes.forEach((start, index) => {
        const end = markerIndexes[index + 1] ?? lines.length;
        const title = normalizeText(lines[start]) || `第 ${chapters.length + 1} 节`;
        const content = lines.slice(start + 1, end).join("\n").trim();
        if (!content) return;
        const paragraphs = splitTextParagraphs(content);
        if (!paragraphs.length) return;
        const blocks = splitOversizedBlocks(paragraphs.map((paragraph) => ({ type: "p", text: paragraph, html: escapeHTML(paragraph) })));
        chapters.push({ title, blocks, chars: blocks.reduce((sum, block) => sum + block.text.length, 0) });
      });
    } else {
      const paragraphs = splitTextParagraphs(normalized);
      let current = [];
      let currentChars = 0;
      let chapterNumber = 1;
      const flush = () => {
        if (!current.length) return;
        chapters.push({
          title: `第 ${chapterNumber} 节`,
          blocks: current,
          chars: currentChars,
        });
        chapterNumber += 1;
        current = [];
        currentChars = 0;
      };
      paragraphs.forEach((paragraph) => {
        const blocks = splitOversizedBlocks([{ type: "p", text: paragraph, html: escapeHTML(paragraph) }]);
        current.push(...blocks);
        currentChars += paragraph.length;
        if (currentChars >= 11500) flush();
      });
      flush();
    }

    if (!chapters.length) throw new Error("没有从这份文本里读到正文。");
    const title = stripExtension(fileName);
    const totalChars = chapters.reduce((sum, chapter) => sum + chapter.chars, 0);
    onProgress(`已整理 ${chapters.length} 节正文…`);
    return {
      title,
      author: "佚名",
      language: txtLanguage(normalized),
      chapters: chapters.slice(0, MAX_IMPORT_CHAPTERS),
      totalChars,
    };
  }

  async function parseTxtFile(file, onProgress = () => {}) {
    const buffer = await file.arrayBuffer();
    const text = decodeTxtBuffer(buffer);
    return parseTxtText(text, file.name, onProgress);
  }

  /* ---------- Reader shell ---------- */

  const state = {
    layer: null,
    isOpen: false,
    activeBookId: null,
    record: null,
    chapterIndex: 0,
    mode: prefs.mode,
    pageIndex: 0,
    pageCount: 1,
    pageWidth: 0,
    pageGap: 72,
    pageReady: true,
    pageReadyWaiters: [],
    pageRenderToken: 0,
    searchQuery: "",
    noteReturn: null,
    tocTree: [],
    tocNodeMap: new Map(),
    tocCollapsed: new Set(),
    bilingual: false,
    translations: null,
    translationStatus: "idle",
    translationProviders: [],
    translationToken: 0,
    translationTarget: "zh-CN",
    chapters: [],
    loadingToken: 0,
    saveTimer: 0,
    scrollFrame: 0,
    lastFocused: null,
    selectionTool: null,
    selectionWord: "",
    selectionContext: "",
    wordLookupToken: 0,
    importing: false,
    panel: "",
    sessionActiveMs: 0,
    sessionTick: 0,
    sessionRunning: false,
  };

  let ui = {};

  function ensureShell() {
    if (state.layer) return;
    const root = document.getElementById("reader-root");
    if (!root) return;
    root.innerHTML = `
      <div class="reader-layer" id="reader-layer" role="dialog" aria-modal="true" aria-labelledby="reader-book-title" hidden>
        <header class="reader-toolbar">
          <div class="reader-toolbar-left">
            <button class="reader-icon-btn" type="button" data-reader-action="close" aria-label="退出阅读" title="返回书架">${icon("arrow-left")}</button>
            <button class="reader-tool-btn reader-toc-trigger" type="button" data-reader-action="toc" aria-label="打开目录" title="目录">${icon("list")}<span class="reader-tool-label">目录</span></button>
          </div>
          <div class="reader-toolbar-center">
            <div class="reader-book-title" id="reader-book-title">正在打开</div>
            <div class="reader-book-context" id="reader-book-context">拾页阅读器</div>
          </div>
          <div class="reader-toolbar-right">
            <button class="reader-tool-btn" type="button" data-reader-action="search-book" aria-label="在书中查找" title="在书中查找">${icon("search")}<span class="reader-tool-label">查找</span></button>
            <button class="reader-icon-btn reader-word-trigger" type="button" data-reader-action="word-search" aria-label="查词" title="查词"><span class="reader-word-glyph">词</span></button>
            <button class="reader-tool-btn" type="button" data-reader-action="bilingual" aria-pressed="false" title="切换双语对照">${icon("languages")}<span class="reader-tool-label">对照</span></button>
            <button class="reader-icon-btn" type="button" data-reader-action="settings" aria-label="阅读设置" title="阅读设置"><span class="reader-aa" style="font-family: var(--font-serif); font-size: 15px;">Aa</span></button>
          </div>
        </header>
        <div class="reader-progress"><span id="reader-progress-fill"></span></div>
        <main class="reader-main" id="reader-main" tabindex="-1">
          <div class="reader-doc" id="reader-doc"></div>
        </main>
        <button class="reader-note-return" id="reader-note-return" type="button" data-reader-action="return-note" hidden>
          ${icon("arrow-left")}<span>返回原文</span>
        </button>
        <footer class="reader-statusbar" id="reader-statusbar">
          <div class="reader-status-left">
            <button class="reader-status-chapter" type="button" data-reader-action="toc" title="打开目录">
              ${icon("list")}<span id="reader-status-chapter">第 1 / 1 章</span>
            </button>
          </div>
          <div class="reader-page-controls" id="reader-page-controls">
            <button class="reader-page-step" type="button" data-reader-page="prev" aria-label="上一页" title="上一页">${icon("chevron-left")}</button>
            <form class="reader-page-form" id="reader-page-form">
              <span>第</span>
              <input id="reader-page-input" type="number" min="1" value="1" inputmode="numeric" aria-label="当前页码">
              <span>/</span><span id="reader-page-total">1</span><span>页</span>
              <button type="submit" title="跳到输入的页码">跳转</button>
            </form>
            <button class="reader-page-step" type="button" data-reader-page="next" aria-label="下一页" title="下一页">${icon("chevron-right")}</button>
          </div>
          <div class="reader-scroll-note" id="reader-scroll-note">连续滚动</div>
          <div class="reader-status-right">
            <span class="reader-status-percent" id="reader-status-percent">0%</span>
            <button class="reader-mode-toggle" type="button" data-reader-action="toggle-mode" title="切换翻页 / 滚动阅读"><span id="reader-mode-label">翻页</span></button>
          </div>
        </footer>
        <div class="reader-scrim" id="reader-scrim" data-reader-action="close-panel"></div>
        <aside class="reader-drawer reader-drawer--toc" id="reader-toc" aria-label="目录与查找" aria-hidden="true">
          <div class="reader-drawer-head">
            <div>
              <h2>目录与查找</h2>
              <p id="reader-toc-subtitle">书籍章节</p>
            </div>
            <button class="reader-icon-btn" type="button" data-reader-action="close-panel" aria-label="关闭目录">${icon("close")}</button>
          </div>
          <form class="reader-toc-search" id="reader-toc-search">
            ${icon("search")}
            <input id="reader-toc-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="在整本书里查找" aria-label="在整本书里查找">
            <button type="submit">查找</button>
          </form>
          <div class="reader-toc-list" id="reader-toc-list"></div>
        </aside>
        <aside class="reader-drawer reader-drawer--word" id="reader-word" aria-label="查词" aria-hidden="true">
          <div class="reader-drawer-head">
            <div>
              <h2>查词</h2>
              <p id="reader-word-subtitle">选中一个词，看看它在上下文里的意思。</p>
            </div>
            <button class="reader-icon-btn" type="button" data-reader-action="close-panel" aria-label="关闭查词">${icon("close")}</button>
          </div>
          <form class="reader-word-search" id="reader-word-search">
            ${icon("search")}
            <input id="reader-word-input" type="text" maxlength="56" autocomplete="off" spellcheck="false" placeholder="输入单词或原文中的词组" aria-label="输入要查询的单词">
            <button type="submit" aria-label="开始查词">${icon("arrow-right")}</button>
          </form>
          <div class="reader-word-body" id="reader-word-body"></div>
        </aside>
        <div class="reader-settings" id="reader-settings" hidden>
          <div class="reader-settings-section">
            <div class="reader-settings-label"><span>阅读字号</span><strong id="reader-size-label">18px</strong></div>
            <div class="reader-size-controls">
              <button type="button" data-reader-font="-1" aria-label="缩小字号">A−</button>
              <span class="reader-size-value" aria-hidden="true">正文</span>
              <button type="button" data-reader-font="1" aria-label="放大字号">A+</button>
            </div>
          </div>
          <div class="reader-settings-section">
            <div class="reader-settings-label"><span>行间距离</span><strong>舒适</strong></div>
            <div class="reader-line-options" id="reader-line-options">
              <button type="button" data-reader-line="1.65">紧凑</button>
              <button type="button" data-reader-line="1.9">舒展</button>
              <button type="button" data-reader-line="2.15">宽松</button>
            </div>
          </div>
          <div class="reader-settings-section">
            <div class="reader-settings-label"><span>阅读方式</span><strong id="reader-mode-value">翻页</strong></div>
            <div class="reader-mode-options" id="reader-mode-options">
              <button type="button" data-reader-mode="paged">翻页</button>
              <button type="button" data-reader-mode="scroll">滚动</button>
            </div>
          </div>
          <div class="reader-settings-section">
            <p class="reader-settings-note">翻页阅读更接近电子书；开启「对照」时会自动切换为滚动，因为双栏译文不适合分页。翻译只发送当前章节到在线服务。</p>
          </div>
        </div>
      </div>
      <div class="reader-import-layer" id="reader-import-layer" hidden>
        <div class="reader-import-card" role="dialog" aria-modal="true" aria-labelledby="reader-import-title">
          <div class="reader-import-icon" id="reader-import-icon">${icon("book")}</div>
          <h2 id="reader-import-title">正在导入电子书</h2>
          <p id="reader-import-desc">正在打开书页，请稍候。</p>
          <div class="reader-import-file" id="reader-import-file"></div>
          <div class="reader-import-bar" id="reader-import-bar"><span></span></div>
          <div class="reader-import-error" id="reader-import-error" hidden></div>
          <div class="reader-import-actions" id="reader-import-actions" hidden></div>
        </div>
      </div>
      <div class="reader-select-tool" id="reader-select-tool" hidden>
        <span class="reader-select-word"></span>
        <button type="button" data-reader-word="lookup">查词</button>
      </div>
    `;

    ui = {
      layer: root.querySelector("#reader-layer"),
      title: root.querySelector("#reader-book-title"),
      context: root.querySelector("#reader-book-context"),
      progressFill: root.querySelector("#reader-progress-fill"),
      main: root.querySelector("#reader-main"),
      doc: root.querySelector("#reader-doc"),
      statusbar: root.querySelector("#reader-statusbar"),
      statusChapter: root.querySelector("#reader-status-chapter"),
      statusPercent: root.querySelector("#reader-status-percent"),
      pageControls: root.querySelector("#reader-page-controls"),
      pageForm: root.querySelector("#reader-page-form"),
      pageInput: root.querySelector("#reader-page-input"),
      pageTotal: root.querySelector("#reader-page-total"),
      pagePrev: root.querySelector('[data-reader-page="prev"]'),
      pageNext: root.querySelector('[data-reader-page="next"]'),
      noteReturnButton: root.querySelector("#reader-note-return"),
      scrollNote: root.querySelector("#reader-scroll-note"),
      modeLabel: root.querySelector("#reader-mode-label"),
      modeValue: root.querySelector("#reader-mode-value"),
      modeButtons: root.querySelector("#reader-mode-options"),
      toc: root.querySelector("#reader-toc"),
      tocList: root.querySelector("#reader-toc-list"),
      tocSubtitle: root.querySelector("#reader-toc-subtitle"),
      tocSearchForm: root.querySelector("#reader-toc-search"),
      tocSearchInput: root.querySelector("#reader-toc-search-input"),
      word: root.querySelector("#reader-word"),
      wordBody: root.querySelector("#reader-word-body"),
      wordSubtitle: root.querySelector("#reader-word-subtitle"),
      wordSearchForm: root.querySelector("#reader-word-search"),
      wordInput: root.querySelector("#reader-word-input"),
      scrim: root.querySelector("#reader-scrim"),
      settings: root.querySelector("#reader-settings"),
      sizeLabel: root.querySelector("#reader-size-label"),
      lineButtons: root.querySelector("#reader-line-options"),
      bilingualButton: root.querySelector('[data-reader-action="bilingual"]'),
      pageViewport: null,
      pageFlow: null,
      pageFolio: null,
      importLayer: root.querySelector("#reader-import-layer"),
      importTitle: root.querySelector("#reader-import-title"),
      importDesc: root.querySelector("#reader-import-desc"),
      importFile: root.querySelector("#reader-import-file"),
      importBar: root.querySelector("#reader-import-bar"),
      importError: root.querySelector("#reader-import-error"),
      importActions: root.querySelector("#reader-import-actions"),
      importIcon: root.querySelector("#reader-import-icon"),
      selectTool: root.querySelector("#reader-select-tool"),
      fileInput: document.getElementById("ebook-file-input"),
    };
    state.layer = ui.layer;
    state.selectionTool = ui.selectTool;
    applyPreferences();
    bindReaderEvents();
  }

  /* ---------- Import flow ---------- */

  function importButtonMarkup() {
    return `${icon("upload")} 选择文件`;
  }

  function openImportLayer(file, message = "正在打开书页，请稍候。") {
    ensureShell();
    if (!ui.importLayer) return;
    ui.importLayer.hidden = false;
    ui.importTitle.textContent = "正在导入电子书";
    ui.importDesc.textContent = message;
    ui.importFile.textContent = file?.name || "未选择文件";
    ui.importBar.hidden = false;
    ui.importError.hidden = true;
    ui.importError.textContent = "";
    ui.importActions.hidden = true;
    ui.importActions.innerHTML = "";
    ui.importIcon.innerHTML = icon("book");
    state.importing = true;
    document.body.classList.add("is-locked");
  }

  function closeImportLayer() {
    ensureShell();
    if (!ui.importLayer) return;
    ui.importLayer.hidden = true;
    state.importing = false;
    if (!state.isOpen) document.body.classList.remove("is-locked");
  }

  function showImportError(message) {
    ensureShell();
    ui.importTitle.textContent = "没有导入成功";
    ui.importDesc.textContent = "换一个文件再试一次，或者先确认它是一本没有 DRM 的 EPUB / TXT。";
    ui.importError.hidden = false;
    ui.importError.textContent = message;
    ui.importBar.hidden = true;
    ui.importActions.hidden = false;
    ui.importActions.innerHTML = `
      <button type="button" data-import-action="retry">${importButtonMarkup()}</button>
      <button type="button" data-import-action="close">关闭</button>
    `;
    state.importing = false;
    if (!state.isOpen) document.body.classList.remove("is-locked");
  }

  function updateImportProgress(message) {
    if (!ui.importLayer || ui.importLayer.hidden) return;
    if (message) ui.importDesc.textContent = message;
  }

  async function importFile(file) {
    if (!file || state.importing) return;
    ensureShell();
    if (!ui.fileInput) return;
    const extension = getFileExtension(file.name);
    if (!["epub", "txt", "md"].includes(extension)) {
      openImportLayer(file, "正在检查文件…");
      showImportError("目前支持 EPUB 和 TXT 电子书。这个文件的格式还不在支持范围内。");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      openImportLayer(file, "正在检查文件…");
      showImportError(`文件有点大（${(file.size / 1024 / 1024).toFixed(1)} MB），目前一次最多导入 42 MB。`);
      return;
    }

    openImportLayer(file);
    try {
      const onProgress = (message) => updateImportProgress(message);
      const parsed = extension === "epub"
        ? await parseEpubFile(file, onProgress)
        : await parseTxtFile(file, onProgress);
      updateImportProgress("正在把书放上书架…");
      const categoryId = app.getCurrentCategoryId() || app.categories[0]?.id;
      if (!categoryId) throw new Error("还没有可以放入的分类。");
      const bookId = uid("book");
      const language = parsed.language || "";
      const record = {
        id: bookId,
        title: parsed.title,
        author: parsed.author,
        language,
        format: extension === "epub" ? "epub" : "txt",
        fileName: file.name,
        chapters: parsed.chapters,
        toc: parsed.toc || [],
        totalChars: parsed.totalChars,
        importedAt: new Date().toISOString(),
      };
      await dbPut(EBOOK_STORE, record);

      const totalChars = parsed.totalChars || 1;
      const pages = clamp(Math.round(totalChars / 950), 20, 5000);
      const days = todayKey();
      const book = {
        id: bookId,
        title: parsed.title.slice(0, 80),
        author: parsed.author.slice(0, 80),
        categoryId,
        pages,
        progress: 0,
        status: "reading",
        theme: themeForTitle(parsed.title),
        rating: 0,
        addedAt: days,
        startedAt: days,
        finishedAt: null,
        lastReadAt: days,
        ebook: {
          format: extension === "epub" ? "epub" : "txt",
          fileName: file.name,
          chapterCount: parsed.chapters.length,
          language,
        },
        readingPercent: 0,
        readerChapter: 0,
        readerScroll: 0,
      };
      app.addImportedEbook(book);
      await sleep(240);
      closeImportLayer();
      app.showToast("电子书已导入", `《${book.title}》已放入书架，现在开始阅读。`, { icon: "book-open" });
      await openReader(bookId);
    } catch (error) {
      showImportError(error?.message || "无法读取这个文件。请确认它是一本没有 DRM 的电子书。");
    }
  }

  function openFilePicker() {
    ensureShell();
    ui.fileInput?.click();
  }

  /* ---------- Reader open / close / state ---------- */

  function updateBookHeader() {
    if (!ui.title) return;
    const book = currentBook();
    if (!book) return;
    ui.title.textContent = book.title;
    const chapterCount = state.chapters.length;
    const percent = overallPercent();
    ui.context.textContent = chapterCount
      ? `${book.author || "佚名"} · 第 ${Math.min(chapterCount, state.chapterIndex + 1)} / ${chapterCount} 章 · ${Math.round(percent)}%`
      : (book.author || "佚名");
    if (ui.statusChapter) {
      ui.statusChapter.textContent = chapterCount
        ? `第 ${Math.min(chapterCount, state.chapterIndex + 1)} / ${chapterCount} 章`
        : "未打开";
    }
    if (ui.statusPercent) ui.statusPercent.textContent = `${Math.round(percent)}%`;
  }

  function setBilingualButton() {
    if (!ui.bilingualButton) return;
    ui.bilingualButton.classList.toggle("is-active", state.bilingual);
    ui.bilingualButton.setAttribute("aria-pressed", String(state.bilingual));
    ui.bilingualButton.title = state.bilingual ? "关闭双语对照" : "开启双语对照";
    const label = ui.bilingualButton.querySelector(".reader-tool-label");
    if (label) label.textContent = "对照";
  }

  function applyReaderThemeVariables() {
    if (!ui.layer) return;
    applyPreferences();
  }

  function isPagedMode() {
    return state.mode === "paged" && !state.bilingual;
  }

  function applyModeUI() {
    if (!ui.layer) return;
    const paged = isPagedMode();
    ui.layer.classList.toggle("is-paged", paged);
    ui.layer.classList.toggle("is-scroll", !paged);
    ui.main?.classList.toggle("is-paged", paged);
    ui.pageControls?.classList.toggle("is-hidden", !paged);
    ui.scrollNote?.classList.toggle("is-hidden", paged);
    if (ui.modeLabel) ui.modeLabel.textContent = paged ? "翻页" : "滚动";
    if (ui.modeValue) ui.modeValue.textContent = paged ? "翻页" : "滚动";
    if (ui.modeButtons) {
      ui.modeButtons.querySelectorAll("[data-reader-mode]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.readerMode === state.mode);
      });
    }
  }

  function getScrollRatio() {
    if (isPagedMode()) {
      if (state.pageCount <= 1) return 0;
      return clamp(state.pageIndex / (state.pageCount - 1), 0, 1);
    }
    if (!ui.main) return 0;
    const max = ui.main.scrollHeight - ui.main.clientHeight;
    if (max <= 4) return 0;
    return clamp(ui.main.scrollTop / max, 0, 1);
  }

  function overallPercent() {
    if (!state.chapters.length) return 0;
    if (currentBook()?.status === "read") return 100;
    if (state.chapters.length === 1) return getScrollRatio() * 100;
    return clamp(((state.chapterIndex + getScrollRatio()) / state.chapters.length) * 100, 0, 100);
  }

  function setProgressDisplay() {
    if (!ui.progressFill) return;
    const percent = overallPercent();
    ui.progressFill.style.width = `${percent}%`;
    if (ui.statusPercent) ui.statusPercent.textContent = `${Math.round(percent)}%`;
    updateBookHeader();
    updatePageStatus();
  }

  function schedulePositionSave() {
    if (state.saveTimer) return;
    state.saveTimer = window.setTimeout(() => {
      state.saveTimer = 0;
      persistPosition();
    }, 900);
  }

  function persistPosition() {
    const book = currentBook();
    if (!book || !state.chapters.length) return;
    const percent = Math.round(overallPercent() * 10) / 10;
    app.saveEbookReadingPosition(book.id, {
      percent,
      chapterIndex: state.chapterIndex,
      scrollRatio: getScrollRatio(),
    });
  }

  async function openReader(bookId) {
    ensureShell();
    const book = app.getBook(bookId);
    if (!book?.ebook) return;
    if (state.isOpen) closeReader({ save: false, refresh: false });
    app.closeOverlay({ restoreFocus: false });
    state.activeBookId = bookId;
    state.lastFocused = document.activeElement;
    state.isOpen = true;
    state.bilingual = Boolean(prefs.bilingual);
    state.mode = state.bilingual ? "scroll" : prefs.mode;
    state.pageIndex = 0;
    state.pageCount = 1;
    state.pageReady = true;
    state.pageReadyWaiters = [];
    state.searchQuery = "";
    state.noteReturn = null;
    state.tocTree = [];
    state.tocNodeMap = new Map();
    state.tocCollapsed = new Set();
    state.translations = null;
    state.translationStatus = "idle";
    state.translationProviders = [];
    state.chapters = [];
    state.record = null;
    state.chapterIndex = 0;
    state.loadingToken += 1;
    state.translationToken += 1;
    if (ui.toc) ui.toc.classList.remove("is-open");
    if (ui.word) ui.word.classList.remove("is-open");
    if (ui.settings) ui.settings.hidden = true;
    if (ui.scrim) ui.scrim.classList.remove("is-open");
    if (ui.tocSearchInput) ui.tocSearchInput.value = "";
    state.panel = "";
    hideReaderSelectionTool();
    updateNoteReturnUI();
    setBilingualButton();
    applyModeUI();
    ui.layer.hidden = false;
    document.body.classList.add("reader-open");
    document.body.classList.add("is-locked");
    ui.title.textContent = book.title;
    ui.context.textContent = book.author || "正在打开书页…";
    ui.progressFill.style.width = `${book.readingPercent || 0}%`;
    if (ui.statusPercent) ui.statusPercent.textContent = `${Math.round(book.readingPercent || 0)}%`;
    if (ui.statusChapter) ui.statusChapter.textContent = "正在打开";
    ui.doc.className = "reader-doc";
    ui.main.scrollTop = 0;
    ui.doc.innerHTML = `<div class="reader-state reader-state--loading"><span class="reader-state-glyph">${icon("book")}</span><h2>正在打开书页</h2><p>把你上次停下的地方找回来。</p></div>`;
    applyReaderThemeVariables();
    requestAnimationFrame(() => ui.layer.querySelector('[data-reader-action="close"]')?.focus({ preventScroll: true }));

    let record;
    try {
      record = await dbGet(EBOOK_STORE, bookId);
    } catch (error) {
      showReaderFileError(error?.message || "无法读取本地电子书内容。");
      return;
    }
    if (!state.isOpen || state.activeBookId !== bookId) return;
    if (!record || !Array.isArray(record.chapters) || !record.chapters.length) {
      showReaderFileError("这本书的正文不在这台设备的本地书库里。它可能是在清理浏览器数据时被移除了，需要重新导入原文件。");
      return;
    }
    state.record = record;
    state.chapters = record.chapters;
    state.chapterIndex = clamp(Number(book.readerChapter) || 0, 0, record.chapters.length - 1);
    buildReaderToc(record);
    ui.tocSubtitle.textContent = `${record.chapters.length} 章 · ${formatNumber(record.totalChars || 0)} 字`;
    if (record.format === "epub" && !record.chapters.some((chapter) => chapter.path)) {
      app.showToast("这本书是旧版导入的", "重新导入一次原文件后，书内注释和链接才能跳转。", { icon: "info", duration: 4400 });
    }
    await loadChapter(state.chapterIndex, { scrollRatio: clamp(Number(book.readerScroll) || 0, 0, 1), initial: true });
    persistPosition();
    updateBookHeader();
    startReadingSession();
  }

  function showReaderFileError(message) {
    if (!ui.doc) return;
    ui.context.textContent = "正文不可用";
    ui.progressFill.style.width = "0%";
    ui.doc.innerHTML = `<div class="reader-state">
      <span class="reader-state-glyph">${icon("book")}</span>
      <h2>这本书暂时打不开</h2>
      <p>${escapeHTML(message)}</p>
      <div class="reader-state-actions">
        <button type="button" data-reader-action="close">返回书架</button>
        <button type="button" data-reader-action="import">重新导入</button>
      </div>
    </div>`;
  }

  function startReadingSession() {
    state.sessionActiveMs = 0;
    state.sessionTick = document.visibilityState === "visible" ? Date.now() : 0;
    state.sessionRunning = Boolean(state.sessionTick);
  }

  function pauseReadingSession() {
    if (!state.sessionRunning) return;
    state.sessionActiveMs += Math.max(0, Date.now() - state.sessionTick);
    state.sessionRunning = false;
    state.sessionTick = 0;
  }

  function resumeReadingSession() {
    if (!state.isOpen || state.sessionRunning) return;
    state.sessionTick = Date.now();
    state.sessionRunning = true;
  }

  function flushReadingSession() {
    pauseReadingSession();
    const minutes = Math.min(360, Math.floor(state.sessionActiveMs / 60000));
    if (minutes >= 1 && state.activeBookId) {
      app.recordReadingMinutes(minutes);
    }
    state.sessionActiveMs = 0;
  }

  function closeReader({ save = true, refresh = true } = {}) {
    if (!state.isOpen) return;
    if (save) persistPosition();
    flushReadingSession();
    state.isOpen = false;
    state.loadingToken += 1;
    state.translationToken += 1;
    state.pageRenderToken += 1;
    resolvePageWaiters();
    state.noteReturn = null;
    updateNoteReturnUI();
    hideReaderSelectionTool();
    closeReaderPanels();
    if (ui.layer) ui.layer.hidden = true;
    document.body.classList.remove("reader-open");
    document.body.classList.remove("is-locked");
    state.activeBookId = null;
    state.record = null;
    state.chapters = [];
    if (refresh) app.renderAll();
    if (state.lastFocused && document.contains(state.lastFocused)) {
      state.lastFocused.focus({ preventScroll: true });
    }
  }

  function forceCloseReader() {
    if (!state.isOpen) return;
    state.isOpen = false;
    state.pageRenderToken += 1;
    resolvePageWaiters();
    state.noteReturn = null;
    updateNoteReturnUI();
    state.activeBookId = null;
    state.record = null;
    state.chapters = [];
    if (ui.layer) ui.layer.hidden = true;
    document.body.classList.remove("reader-open");
    document.body.classList.remove("is-locked");
  }

  /* ---------- Chapter rendering ---------- */

  function blockClass(type) {
    if (type === "h1" || type === "h2" || type === "h3") return "is-heading";
    if (type === "blockquote") return "is-blockquote";
    if (type === "li") return "is-li";
    return "";
  }

  function sourceBlockMarkup(block, index = null) {
    return `<div class="reader-block reader-block--${block.type}"${Number.isInteger(index) ? ` data-reader-block="${index}"` : ""}>${block.html}</div>`;
  }

  function sourceInlineMarkup(block) {
    return `<div class="reader-source-text ${blockClass(block.type)}">${block.html}</div>`;
  }

  function translationForChapter(index) {
    if (!state.translations) return null;
    return state.translations[index] || null;
  }

  function translationCellMarkup(index) {
    const value = translationForChapter(index);
    if (value) return escapeHTML(value);
    if (state.translationStatus === "loading" || state.translationStatus === "idle") {
      return '<div class="reader-translation-skeleton"><span></span><span></span><span></span></div>';
    }
    return `<div class="reader-translate-error"><span>这一段还没有翻译成功。</span><button type="button" data-reader-action="retry-translation">重试本章</button></div>`;
  }

  function bilingualStatusMarkup() {
    const count = state.chapters[state.chapterIndex]?.blocks.length || 0;
    if (state.translationStatus === "loading") {
      const done = state.translations ? state.translations.filter(Boolean).length : 0;
      return `<div class="reader-bilingual-status" id="reader-bilingual-status">
        <div class="reader-bilingual-status-left"><i></i><span>正在翻译本章 · ${done} / ${count} 段</span></div>
        <span>${LANGUAGE_LABELS[state.translationTarget] || "中文"}</span>
      </div>`;
    }
    if (state.translationStatus === "error") {
      return `<div class="reader-bilingual-status" id="reader-bilingual-status">
        <div class="reader-bilingual-status-left"><i></i><span>有一些段落没有翻译成功</span></div>
        <button class="reader-inline-btn" type="button" data-reader-action="retry-translation">重试</button>
      </div>`;
    }
    return `<div class="reader-bilingual-status" id="reader-bilingual-status">
      <div class="reader-bilingual-status-left"><i></i><span>机器翻译 · ${escapeHTML(providerText(state.translationProviders))}</span></div>
      <span>当前章节 · ${count} 段</span>
    </div>`;
  }

  function providerText(providers) {
    const values = Array.from(new Set((providers || []).filter(Boolean)));
    if (!values.length) return "在线翻译";
    return values.map((provider) => (provider === "Google" ? "Google 翻译" : provider)).join(" · ");
  }

  function translationProfile() {
    const book = currentBook();
    const language = String(book?.ebook?.language || "").toLowerCase();
    const prefix = language.slice(0, 2);
    if (prefix === "zh") {
      return { from: "auto", to: "en", sourceLabel: "原文", targetLabel: LANGUAGE_LABELS.en };
    }
    if (SOURCE_LANGUAGE_CODES.has(prefix)) {
      return {
        from: prefix,
        to: "zh-CN",
        sourceLabel: LANGUAGE_LABELS[prefix] || "原文",
        targetLabel: LANGUAGE_LABELS["zh-CN"],
      };
    }
    return { from: "auto", to: "zh-CN", sourceLabel: "原文", targetLabel: LANGUAGE_LABELS["zh-CN"] };
  }

  function endCardMarkup(book) {
    const isFinished = book.status === "read";
    return `<div class="reader-end-card">
      <span class="reader-end-glyph">${icon(isFinished ? "check" : "book")}</span>
      <h3>${isFinished ? "这本书已经读完了" : "读到这里，就是这一本的结尾"}</h3>
      <p>${isFinished ? "谢谢你把它读完。也可以在书架里写下一句自己的话。" : "如果这是你想留下的最后一页，把它标记为读完。"}</p>
      <div class="reader-end-actions">
        <button type="button" class="is-primary" data-reader-action="finish" ${isFinished ? "disabled" : ""}>${isFinished ? "已读完" : "标记为已读完"}</button>
      </div>
    </div>`;
  }

  function pageChapterHeadMarkup(book, chapter) {
    return `<div class="reader-page-chapter-head">
      <div class="reader-chapter-kicker">CHAPTER ${String(state.chapterIndex + 1).padStart(2, "0")} / ${String(state.chapters.length).padStart(2, "0")}</div>
      <h1 class="reader-chapter-title">${escapeHTML(chapter.title)}</h1>
      <div class="reader-chapter-info">
        <span>${escapeHTML(book.author || "佚名")}</span><i></i>
        <span>${formatNumber(chapter.chars || chapter.blocks.reduce((sum, block) => sum + block.text.length, 0))} 字</span>
      </div>
    </div>`;
  }

  function resolvePageWaiters() {
    state.pageReady = true;
    const waiters = state.pageReadyWaiters.splice(0);
    waiters.forEach((resolve) => resolve());
  }

  function waitForPageReady() {
    if (!isPagedMode() || state.pageReady) return Promise.resolve();
    return new Promise((resolve) => {
      state.pageReadyWaiters.push(resolve);
      window.setTimeout(resolve, 900);
    });
  }

  function updatePageStatus() {
    if (!ui.pageControls) return;
    const paged = isPagedMode();
    ui.pageControls.classList.toggle("is-hidden", !paged);
    if (ui.scrollNote) ui.scrollNote.classList.toggle("is-hidden", paged);
    if (!paged) return;

    const total = Math.max(1, state.pageCount);
    const page = clamp(state.pageIndex + 1, 1, total);
    if (ui.pageInput && document.activeElement !== ui.pageInput) ui.pageInput.value = String(page);
    if (ui.pageInput) ui.pageInput.max = String(total);
    if (ui.pageTotal) ui.pageTotal.textContent = String(total);
    if (ui.pageFolio) ui.pageFolio.textContent = `${page} / ${total}`;

    const atStart = state.pageIndex <= 0 && state.chapterIndex <= 0;
    const atEnd = state.pageIndex >= total - 1 && state.chapterIndex >= state.chapters.length - 1;
    ui.layer.querySelectorAll('[data-reader-page="prev"]').forEach((button) => {
      button.disabled = atStart;
    });
    ui.layer.querySelectorAll('[data-reader-page="next"]').forEach((button) => {
      button.disabled = atEnd;
    });
  }

  function layoutPageFlow({ preserveRatio = null, attempt = 0 } = {}) {
    if (!isPagedMode() || !ui.pageViewport || !ui.pageFlow) {
      resolvePageWaiters();
      return;
    }
    const width = Math.round(ui.pageViewport.clientWidth);
    if (width < 120) {
      if (attempt < 12) {
        window.setTimeout(() => {
          if (state.isOpen && isPagedMode() && ui.pageFlow) {
            layoutPageFlow({ preserveRatio, attempt: attempt + 1 });
          }
        }, 50);
      } else {
        resolvePageWaiters();
      }
      return;
    }
    const gap = width < 500 ? 38 : 72;
    state.pageWidth = width;
    state.pageGap = gap;
    ui.pageViewport.scrollLeft = 0;
    ui.pageFlow.style.columnWidth = `${width}px`;
    ui.pageFlow.style.columnGap = `${gap}px`;
    void ui.pageFlow.offsetWidth;
    const scrollWidth = ui.pageViewport.scrollWidth;
    state.pageCount = Math.max(1, Math.ceil((scrollWidth + gap) / (width + gap)));
    const ratio = preserveRatio !== null ? clamp(preserveRatio, 0, 1) : 0;
    state.pageIndex = clamp(Math.round(ratio * Math.max(0, state.pageCount - 1)), 0, state.pageCount - 1);
    ui.pageViewport.scrollLeft = state.pageIndex * (width + gap);
    updatePageStatus();
    setProgressDisplay();
    resolvePageWaiters();
  }

  function goToPage(index, { animate = true, save = true } = {}) {
    if (!isPagedMode() || !ui.pageViewport) return;
    const next = clamp(Number(index) || 0, 0, Math.max(0, state.pageCount - 1));
    const changed = next !== state.pageIndex;
    state.pageIndex = next;
    const target = next * (state.pageWidth + state.pageGap);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (animate && !reduceMotion) {
      ui.pageViewport.scrollTo({ left: target, behavior: "smooth" });
    } else {
      ui.pageViewport.scrollLeft = target;
    }
    updatePageStatus();
    setProgressDisplay();
    if (save && changed) schedulePositionSave();
  }

  function turnPage(direction, { animate = true } = {}) {
    if (!isPagedMode()) return;
    if (direction > 0) {
      if (state.pageIndex < state.pageCount - 1) {
        goToPage(state.pageIndex + 1, { animate });
        return;
      }
      if (state.chapterIndex < state.chapters.length - 1) {
        loadChapter(state.chapterIndex + 1, { scrollRatio: 0 });
      }
      return;
    }
    if (state.pageIndex > 0) {
      goToPage(state.pageIndex - 1, { animate });
      return;
    }
    if (state.chapterIndex > 0) {
      loadChapter(state.chapterIndex - 1, { scrollRatio: 1 });
    }
  }

  function bindPageViewport() {
    if (!ui.pageViewport) return;
    let scrollTimer = 0;
    ui.pageViewport.addEventListener("scroll", () => {
      hideReaderSelectionTool();
      if (!isPagedMode()) return;
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        if (!isPagedMode() || !ui.pageViewport) return;
        const index = clamp(
          Math.round(ui.pageViewport.scrollLeft / Math.max(1, state.pageWidth + state.pageGap)),
          0,
          Math.max(0, state.pageCount - 1),
        );
        if (index !== state.pageIndex) {
          state.pageIndex = index;
          updatePageStatus();
          setProgressDisplay();
          schedulePositionSave();
        }
      }, 120);
    }, { passive: true });

    let lastWheel = 0;
    ui.pageViewport.addEventListener("wheel", (event) => {
      if (!isPagedMode() || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      if (Date.now() - lastWheel < 320) return;
      lastWheel = Date.now();
      turnPage(event.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    let touchStart = null;
    ui.pageViewport.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    ui.pageViewport.addEventListener("touchend", (event) => {
      if (!touchStart) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        turnPage(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  function renderPagedChapter({ preserveRatio = null } = {}) {
    const book = currentBook();
    if (!book || !ui.doc) return;
    const chapter = state.chapters[state.chapterIndex];
    if (!chapter) return;
    const initialRatio = state.initialRatio;
    const renderToken = ++state.pageRenderToken;
    state.pageReady = false;
    state.initialRatio = null;
    ui.main.classList.add("is-paged");
    ui.doc.className = "reader-doc reader-doc--paged";
    const blocks = chapter.blocks.map((block, index) => sourceBlockMarkup(block, index)).join("");
    const isLastChapter = state.chapterIndex >= state.chapters.length - 1;
    const endCard = isLastChapter ? endCardMarkup(book) : "";
    ui.doc.innerHTML = `<div class="reader-paged-stage">
      <button class="reader-page-edge is-prev" type="button" data-reader-page="prev" aria-label="上一页">${icon("chevron-left")}</button>
      <div class="reader-page-card">
        <div class="reader-page-viewport" id="reader-page-viewport">
          <div class="reader-page-flow" id="reader-page-flow">
            ${pageChapterHeadMarkup(book, chapter)}
            ${blocks}
            ${endCard}
          </div>
        </div>
        <div class="reader-page-folio" id="reader-page-folio">1 / 1</div>
      </div>
      <button class="reader-page-edge is-next" type="button" data-reader-page="next" aria-label="下一页">${icon("chevron-right")}</button>
    </div>`;
    ui.pageViewport = ui.doc.querySelector("#reader-page-viewport");
    ui.pageFlow = ui.doc.querySelector("#reader-page-flow");
    ui.pageFolio = ui.doc.querySelector("#reader-page-folio");
    applyModeUI();
    updatePageStatus();
    bindPageViewport();
    const ratio = preserveRatio !== null ? preserveRatio : (initialRatio ?? 0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (renderToken !== state.pageRenderToken) return;
        layoutPageFlow({ preserveRatio: ratio });
      });
    });
    window.setTimeout(() => {
      if (renderToken !== state.pageRenderToken || state.pageReady) return;
      layoutPageFlow({ preserveRatio: ratio });
    }, 180);
    updateBookHeader();
  }

  function setReaderMode(mode) {
    const next = mode === "scroll" ? "scroll" : "paged";
    if (next === "paged" && state.bilingual) {
      app.showToast("先关闭双语对照", "对照模式使用滚动阅读，关闭后才能切到翻页。", { icon: "languages" });
      return;
    }
    if (next === state.mode) return;
    const ratio = getScrollRatio();
    state.mode = next;
    prefs.mode = next;
    savePreferences();
    applyModeUI();
    renderChapterDoc({ preserveRatio: ratio });
  }

  function toggleReaderMode() {
    setReaderMode(state.mode === "paged" ? "scroll" : "paged");
  }

  function renderChapterDoc({ preserveRatio = null } = {}) {
    if (!ui.doc || !state.chapters.length) return;
    if (isPagedMode()) {
      renderPagedChapter({ preserveRatio });
      return;
    }
    state.totalScrollRatio = getScrollRatio();
    state.pageReady = true;
    const book = currentBook();
    if (!book) return;
    ui.main.classList.remove("is-paged");
    const chapter = state.chapters[state.chapterIndex];
    const profile = translationProfile();
    state.translationTarget = profile.to;
    const percent = overallPercent();
    const chapterCount = state.chapters.length;
    const chapterHead = `<div class="reader-chapter-head">
      <div class="reader-chapter-kicker">CHAPTER ${String(state.chapterIndex + 1).padStart(2, "0")} / ${String(chapterCount).padStart(2, "0")}</div>
      <h1 class="reader-chapter-title">${escapeHTML(chapter.title)}</h1>
      <div class="reader-chapter-info">
        <span>${escapeHTML(book.author || "佚名")}</span><i></i>
        <span>${formatNumber(chapter.chars || chapter.blocks.reduce((sum, block) => sum + block.text.length, 0))} 字</span><i></i>
        <span>${Math.round(percent)}%</span>
      </div>
    </div>`;

    let bodyMarkup = "";
    if (state.bilingual) {
      const rows = chapter.blocks.map((block, index) => {
        return `<div class="reader-bilingual-row" data-reader-block="${index}">
          ${sourceInlineMarkup(block)}
          <div class="reader-translation-text" data-reader-translation-index="${index}">${translationCellMarkup(index)}</div>
        </div>`;
      }).join("");
      bodyMarkup = `${bilingualStatusMarkup()}
        <div class="reader-columns-head"><span>原文 · ${escapeHTML(profile.sourceLabel)}</span><span>译文 · ${escapeHTML(profile.targetLabel)}</span></div>
        ${rows}`;
    } else {
      bodyMarkup = chapter.blocks.map((block, index) => sourceBlockMarkup(block, index)).join("");
    }

    const hasPrev = state.chapterIndex > 0;
    const hasNext = state.chapterIndex < chapterCount - 1;
    const chapterFooter = `<div class="reader-chapter-footer">
      <div class="reader-chapter-nav">
        <button type="button" data-reader-nav="prev" ${hasPrev ? "" : "disabled"}>${icon("chevron-left")} 上一章</button>
        <span>第 ${state.chapterIndex + 1} / ${chapterCount} 章</span>
        <button type="button" data-reader-nav="next" ${hasNext ? "" : "disabled"}>下一章 ${icon("chevron-right")}</button>
      </div>
      ${!hasNext ? endCardMarkup(book) : ""}
    </div>`;

    ui.doc.className = `reader-doc${state.bilingual ? " reader-doc--bilingual" : ""}`;
    ui.doc.innerHTML = `${chapterHead}${state.bilingual ? `<div class="reader-bilingual-body">${bodyMarkup}</div>` : bodyMarkup}${chapterFooter}`;
    applyModeUI();
    updateBookHeader();
    if (state.bilingual) {
      const cached = state.translations;
      if (!cached) {
        state.translations = new Array(chapter.blocks.length).fill(null);
      }
      ensureChapterTranslations();
    }
    resolvePageWaiters();
    const ratio = preserveRatio !== null ? preserveRatio : (state.initialRatio ?? null);
    state.initialRatio = null;
    if (ratio !== null) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const max = ui.main.scrollHeight - ui.main.clientHeight;
          ui.main.scrollTop = Math.max(0, max * clamp(ratio, 0, 1));
          setProgressDisplay();
        });
      });
    } else {
      ui.main.scrollTop = 0;
      setProgressDisplay();
    }
  }

  async function loadChapter(index, { scrollRatio = 0, initial = false, keepPanels = false } = {}) {
    if (!state.chapters.length) return;
    const chapterIndex = clamp(Number(index) || 0, 0, state.chapters.length - 1);
    state.chapterIndex = chapterIndex;
    state.translationToken += 1;
    state.translations = null;
    state.translationStatus = "idle";
    state.translationProviders = [];
    state.initialRatio = scrollRatio;
    state.pageIndex = 0;
    state.pageCount = 1;
    if (!keepPanels) closeReaderPanels();
    const book = currentBook();
    if (book) {
      book.readerChapter = chapterIndex;
      book.readerScroll = scrollRatio;
    }
    renderChapterDoc({ preserveRatio: scrollRatio });
    if (isPagedMode()) await waitForPageReady();
    if (!initial) schedulePositionSave();
    updateBookHeader();
    updateTocActive();
  }

  function buildReaderToc(record) {
    const nodeMap = new Map();
    const roots = [];
    const pathMap = new Map();
    state.chapters.forEach((chapter, index) => {
      if (chapter.path) pathMap.set(pathKey(chapter.path), index);
    });

    const makeNode = (raw, depth, parentId) => {
      const node = {
        id: raw.id || `toc-${nodeMap.size + 1}`,
        label: normalizeText(raw.label || ""),
        path: raw.path || "",
        fragment: raw.fragment || "",
        parentId: parentId || null,
        depth: Number.isFinite(Number(raw.depth)) ? Number(raw.depth) : depth,
        order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : nodeMap.size,
        children: [],
        chapterIndex: null,
        blockIndex: null,
        target: false,
      };
      if (!node.label) return null;
      const chapterIndex = node.path ? pathMap.get(pathKey(node.path)) : undefined;
      if (chapterIndex !== undefined) {
        node.chapterIndex = chapterIndex;
        node.target = true;
        node.blockIndex = 0;
        if (node.fragment) {
          const chapter = state.chapters[chapterIndex];
          if (chapter?.anchors && Object.prototype.hasOwnProperty.call(chapter.anchors, node.fragment)) {
            node.blockIndex = Number(chapter.anchors[node.fragment]) || 0;
          }
        }
      }
      nodeMap.set(node.id, node);
      return node;
    };

    const rawNodes = Array.isArray(record?.toc) ? record.toc : [];
    if (rawNodes.length) {
      const created = [];
      rawNodes.forEach((raw) => {
        const node = makeNode(raw, 0, raw.parentId || null);
        if (node) created.push(node);
      });
      created.forEach((node) => {
        const parent = node.parentId ? nodeMap.get(node.parentId) : null;
        if (parent) parent.children.push(node);
        else {
          node.parentId = null;
          roots.push(node);
        }
      });

      const usedChapters = new Set();
      nodeMap.forEach((node) => {
        if (node.chapterIndex !== null) usedChapters.add(node.chapterIndex);
      });
      const missing = state.chapters
        .map((chapter, index) => ({ chapter, index }))
        .filter(({ index }) => !usedChapters.has(index));
      if (missing.length) {
        const extraId = "toc-extra-unlisted";
        const extra = {
          id: extraId,
          label: "未列入目录",
          path: "",
          fragment: "",
          parentId: null,
          depth: 0,
          order: rawNodes.length,
          children: [],
          chapterIndex: null,
          blockIndex: null,
          target: false,
        };
        nodeMap.set(extraId, extra);
        missing.forEach(({ chapter, index }, offset) => {
          const leaf = {
            id: `toc-extra-${index}`,
            label: chapter.title || `第 ${index + 1} 章`,
            path: chapter.path || "",
            fragment: "",
            parentId: extraId,
            depth: 1,
            order: rawNodes.length + offset + 1,
            children: [],
            chapterIndex: index,
            blockIndex: 0,
            target: true,
          };
          nodeMap.set(leaf.id, leaf);
          extra.children.push(leaf);
        });
        roots.push(extra);
      }
    } else {
      state.chapters.forEach((chapter, index) => {
        const node = {
          id: `toc-flat-${index}`,
          label: chapter.title || `第 ${index + 1} 章`,
          path: chapter.path || "",
          fragment: "",
          parentId: null,
          depth: 0,
          order: index,
          children: [],
          chapterIndex: index,
          blockIndex: 0,
          target: true,
        };
        nodeMap.set(node.id, node);
        roots.push(node);
      });
    }

    const pruneEmptyGroups = (list) => list
      .map((node) => {
        node.children = pruneEmptyGroups(node.children || []);
        return node;
      })
      .filter((node) => node.target || node.children.length);
    state.tocTree = pruneEmptyGroups(roots);
    state.tocNodeMap = nodeMap;
  }

  function getActiveTocNode() {
    let active = null;
    state.tocNodeMap.forEach((node) => {
      if (node.chapterIndex !== state.chapterIndex) return;
      if (!active || node.depth > active.depth || (node.depth === active.depth && node.order >= active.order)) {
        active = node;
      }
    });
    return active;
  }

  function getActiveTocAncestors() {
    const ancestors = [];
    let node = getActiveTocNode();
    while (node?.parentId) {
      const parent = state.tocNodeMap.get(node.parentId);
      if (!parent) break;
      ancestors.push(parent);
      node = parent;
    }
    return ancestors;
  }

  function expandActiveTocPath() {
    const active = getActiveTocNode();
    if (active) state.tocCollapsed.delete(active.id);
    getActiveTocAncestors().forEach((node) => state.tocCollapsed.delete(node.id));
  }

  function updateTocActive() {
    if (!ui.tocList) return;
    const active = getActiveTocNode();
    ui.tocList.querySelectorAll(".reader-toc-node").forEach((element) => {
      element.classList.toggle("is-active", element.dataset.tocNode === active?.id);
      element.classList.remove("has-active");
    });
    getActiveTocAncestors().forEach((node) => {
      ui.tocList.querySelector(`[data-toc-node="${node.id}"]`)?.classList.add("has-active");
    });
  }

  function tocNodeMarkup(node, level = 0) {
    const hasChildren = Boolean(node.children?.length);
    const collapsed = state.tocCollapsed.has(node.id);
    const isGroup = !node.target;
    const toggle = hasChildren
      ? `<button class="reader-toc-toggle" type="button" data-toc-toggle="${node.id}" aria-expanded="${collapsed ? "false" : "true"}" aria-label="${collapsed ? "展开" : "折叠"}">${icon("chevron-right")}</button>`
      : `<span class="reader-toc-toggle-spacer" aria-hidden="true"></span>`;
    const disabled = !node.target && !hasChildren ? " disabled" : "";
    const children = hasChildren
      ? `<div class="reader-toc-children">${node.children.map((child) => tocNodeMarkup(child, level + 1)).join("")}</div>`
      : "";
    return `<div class="reader-toc-branch${collapsed ? " is-collapsed" : ""}" data-toc-branch="${node.id}">
      <div class="reader-toc-node${isGroup ? " is-group" : ""}" data-toc-node="${node.id}" style="--toc-level:${Math.min(level, 7)}">
        ${toggle}
        <button class="reader-toc-label" type="button" data-toc-open="${node.id}"${disabled}>${escapeHTML(node.label)}</button>
      </div>
      ${children}
    </div>`;
  }

  function toggleTocBranch(nodeId) {
    const branch = ui.tocList?.querySelector(`[data-toc-branch="${nodeId}"]`);
    if (!branch) return;
    const collapsed = branch.classList.toggle("is-collapsed");
    const toggle = branch.querySelector(`[data-toc-toggle="${nodeId}"]`);
    if (toggle) toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (collapsed) state.tocCollapsed.add(nodeId);
    else state.tocCollapsed.delete(nodeId);
  }

  async function openTocNode(nodeId) {
    const node = state.tocNodeMap.get(nodeId);
    if (!node) return;
    if (node.chapterIndex === null || node.chapterIndex === undefined) {
      if (node.children?.length) toggleTocBranch(node.id);
      return;
    }
    const keepOpen = window.innerWidth > 760;
    if (!keepOpen) closeReaderPanels();
    await loadChapter(node.chapterIndex, { scrollRatio: 0, keepPanels: keepOpen });
    if (node.fragment && node.blockIndex !== null) {
      if (isPagedMode()) {
        await waitForPageReady();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      revealReaderBlock(node.blockIndex);
    }
    if (keepOpen) updateTocActive();
  }

  function searchSnippet(text, query) {
    const lower = String(text || "").toLocaleLowerCase("zh-CN");
    const needle = query.toLocaleLowerCase("zh-CN");
    const index = lower.indexOf(needle);
    if (index < 0) return "";
    const start = Math.max(0, index - 30);
    const end = Math.min(text.length, index + query.length + 42);
    const before = text.slice(start, index);
    const match = text.slice(index, index + query.length);
    const after = text.slice(index + query.length, end);
    return `${start > 0 ? "…" : ""}${escapeHTML(before)}<mark>${escapeHTML(match)}</mark>${escapeHTML(after)}${end < text.length ? "…" : ""}`;
  }

  function renderBookSearchResults(query) {
    if (!ui.tocList) return;
    const needle = query.toLocaleLowerCase("zh-CN");
    const results = [];
    state.chapters.forEach((chapter, chapterIndex) => {
      if (chapter.title.toLocaleLowerCase("zh-CN").includes(needle)) {
        results.push({ chapterIndex, blockIndex: null, title: chapter.title, snippet: "章节标题命中" });
      }
      const blocks = chapter.blocks || [];
      for (let blockIndex = 0; blockIndex < blocks.length && results.length < 80; blockIndex += 1) {
        const text = blocks[blockIndex]?.text || "";
        if (!text.toLocaleLowerCase("zh-CN").includes(needle)) continue;
        results.push({
          chapterIndex,
          blockIndex,
          title: chapter.title,
          snippet: searchSnippet(text, query),
        });
        if (results.length >= 80) break;
      }
    });
    if (ui.tocSubtitle) ui.tocSubtitle.textContent = `全书搜索 · ${results.length}${results.length >= 80 ? "+" : ""} 条结果`;
    if (!results.length) {
      ui.tocList.innerHTML = `<div class="reader-search-empty">
        <span class="reader-search-empty-mark">${icon("search")}</span>
        <p>没有找到“${escapeHTML(query)}”。<br>可以换一个更短的词。</p>
      </div>`;
      return;
    }
    ui.tocList.innerHTML = `<div class="reader-search-summary">“${escapeHTML(query)}”</div>${results.map((result, index) => `
      <button class="reader-search-result" type="button" data-reader-search-chapter="${result.chapterIndex}"${result.blockIndex === null ? "" : ` data-reader-search-block="${result.blockIndex}"`}>
        <span class="reader-search-result-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="reader-search-result-copy">
          <strong>${escapeHTML(result.title)}</strong>
          <span>${result.snippet}</span>
        </span>
      </button>`).join("")}`;
  }

  function renderToc() {
    if (!ui.tocList) return;
    if (state.searchQuery) {
      renderBookSearchResults(state.searchQuery);
      return;
    }
    if (!state.tocTree.length) buildReaderToc(state.record);
    if (ui.tocSubtitle) ui.tocSubtitle.textContent = `${state.chapters.length} 章 · ${formatNumber(state.record?.totalChars || 0)} 字`;
    expandActiveTocPath();
    ui.tocList.innerHTML = state.tocTree.map((node) => tocNodeMarkup(node, 0)).join("");
    updateTocActive();
  }

  async function openSearchResult(chapterIndex, blockIndex) {
    closeReaderPanels();
    await loadChapter(chapterIndex, { scrollRatio: 0 });
    if (blockIndex === null || blockIndex === undefined) return;
    if (isPagedMode()) {
      await waitForPageReady();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    revealReaderBlock(blockIndex);
  }

  function revealReaderBlock(blockIndex) {
    const element = ui.doc?.querySelector(`[data-reader-block="${blockIndex}"]`);
    if (!element) return;
    if (isPagedMode() && ui.pageViewport) {
      ui.pageViewport.scrollLeft = 0;
      const flowRect = ui.pageFlow.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const offset = Math.max(0, elementRect.left - flowRect.left);
      const page = Math.max(0, Math.floor((offset + 6) / Math.max(1, state.pageWidth + state.pageGap)));
      goToPage(page, { animate: false });
    } else {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    element.classList.add("is-search-hit");
    window.setTimeout(() => element.classList.remove("is-search-hit"), 2400);
  }

  function updateNoteReturnUI() {
    if (!ui.noteReturnButton) return;
    ui.noteReturnButton.hidden = !state.noteReturn;
    const label = ui.noteReturnButton.querySelector("span");
    if (label) label.textContent = state.noteReturn?.label || "返回原文";
  }

  function findLinkedChapterIndex(link) {
    const targetKey = pathKey(link.path);
    if (!targetKey) return state.chapterIndex;
    const direct = state.chapters.findIndex((chapter) => pathKey(chapter.path) === targetKey);
    if (direct >= 0) return direct;
    const fragment = String(link.fragment || "");
    if (fragment) {
      const matches = [];
      state.chapters.forEach((chapter, index) => {
        if (chapter.anchors && Object.prototype.hasOwnProperty.call(chapter.anchors, fragment)) matches.push(index);
      });
      if (matches.length === 1) return matches[0];
      if (matches.includes(state.chapterIndex)) return state.chapterIndex;
    }
    return -1;
  }

  async function jumpToReaderLink(linkIndex) {
    const chapter = state.chapters[state.chapterIndex];
    const link = chapter?.links?.[linkIndex];
    if (!link) {
      app.showToast("这个链接暂时打不开", "电子书里没有找到对应的目标。", { icon: "info" });
      return;
    }
    const targetChapterIndex = findLinkedChapterIndex(link);
    if (targetChapterIndex < 0) {
      app.showToast("没有找到对应的注释", "这条注释指向的章节没有包含在电子书正文里。", { icon: "quote" });
      return;
    }
    const targetChapter = state.chapters[targetChapterIndex];
    let blockIndex = 0;
    if (link.fragment && targetChapter.anchors) {
      if (Object.prototype.hasOwnProperty.call(targetChapter.anchors, link.fragment)) {
        blockIndex = Number(targetChapter.anchors[link.fragment]) || 0;
      } else {
        const matchedKey = Object.keys(targetChapter.anchors).find((key) => key.toLowerCase() === String(link.fragment).toLowerCase());
        if (matchedKey) blockIndex = Number(targetChapter.anchors[matchedKey]) || 0;
      }
    }
    if (!state.noteReturn) {
      state.noteReturn = {
        chapterIndex: state.chapterIndex,
        scrollRatio: getScrollRatio(),
        label: link.note ? "返回原文" : "返回原处",
      };
    }
    updateNoteReturnUI();

    if (targetChapterIndex !== state.chapterIndex) {
      await loadChapter(targetChapterIndex, { scrollRatio: 0 });
    }
    if (isPagedMode()) {
      await waitForPageReady();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    revealReaderBlock(blockIndex);
    app.showToast(
      link.note ? "已定位到注释" : "已跳到链接位置",
      `点左下角「${link.note ? "返回原文" : "返回原处"}」可以回到刚才的位置。`,
      { icon: "quote", duration: 3200 },
    );
  }

  async function returnToOriginalLocation() {
    const saved = state.noteReturn;
    if (!saved) return;
    state.noteReturn = null;
    updateNoteReturnUI();
    closeReaderPanels();
    await loadChapter(saved.chapterIndex, { scrollRatio: saved.scrollRatio });
  }

  async function ensureChapterTranslations(force = false) {
    if (!state.bilingual || !state.chapters.length) return;
    if (!force && state.translationStatus === "loading") return;
    const chapter = state.chapters[state.chapterIndex];
    if (!chapter?.blocks?.length) return;
    const profile = translationProfile();
    state.translationTarget = profile.to;
    if (!force) {
      const existing = state.translations;
      if (existing && existing.some(Boolean)) return;
      const key = `translation:${state.activeBookId}:${state.chapterIndex}:${profile.to}`;
      try {
        const cached = await dbGet(TRANSLATION_STORE, key);
        if (cached && Array.isArray(cached.translations)) {
          state.translations = cached.translations.slice(0, chapter.blocks.length);
          while (state.translations.length < chapter.blocks.length) state.translations.push(null);
          state.translationProviders = cached.providers || [];
          const allDone = state.translations.every(Boolean);
          state.translationStatus = allDone ? "done" : "error";
          updateTranslationCells();
          updateBilingualStatus();
          if (allDone) return;
        }
      } catch {
        // No cache is fine.
      }
    }

    if (!state.translations) state.translations = new Array(chapter.blocks.length).fill(null);
    const pending = chapter.blocks
      .map((block, index) => (state.translations[index] ? -1 : index))
      .filter((index) => index >= 0)
      .filter((index) => chapter.blocks[index]?.text);
    if (!pending.length) {
      state.translationStatus = "done";
      updateTranslationCells();
      updateBilingualStatus();
      return;
    }

    state.translationStatus = "loading";
    const token = ++state.translationToken;
    updateTranslationCells();
    updateBilingualStatus();
    const providers = [...state.translationProviders];
    const failed = [];

    for (let cursor = 0; cursor < pending.length; cursor += TRANSLATION_BATCH_SIZE) {
      if (token !== state.translationToken || !state.bilingual || !state.isOpen) return;
      const indexes = pending.slice(cursor, cursor + TRANSLATION_BATCH_SIZE);
      const texts = indexes.map((index) => chapter.blocks[index].text);
      try {
        const result = await app.translateTextBatch(texts, profile.from, profile.to);
        result.translations.forEach((translation, offset) => {
          const blockIndex = indexes[offset];
          if (translation) state.translations[blockIndex] = translation;
          else failed.push(blockIndex);
        });
        providers.push(...(result.providers || []));
        state.translationProviders = Array.from(new Set(providers));
      } catch {
        failed.push(...indexes);
      }
      if (token !== state.translationToken) return;
      updateTranslationCells();
      state.translationStatus = "loading";
      updateBilingualStatus();
    }

    if (token !== state.translationToken) return;
    const allDone = state.translations.every(Boolean);
    state.translationStatus = failed.length || !allDone ? "error" : "done";
    updateTranslationCells();
    updateBilingualStatus();
    const key = `translation:${state.activeBookId}:${state.chapterIndex}:${profile.to}`;
    try {
      await dbPut(TRANSLATION_STORE, {
        key,
        bookId: state.activeBookId,
        chapterIndex: state.chapterIndex,
        to: profile.to,
        translations: state.translations,
        providers: state.translationProviders,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // The chapter remains readable if cache storage fails.
    }
  }

  function updateTranslationCells() {
    if (!state.bilingual || !state.translations) return;
    ui.doc.querySelectorAll("[data-reader-translation-index]").forEach((cell) => {
      const index = Number(cell.dataset.readerTranslationIndex);
      cell.innerHTML = translationCellMarkup(index);
    });
  }

  function updateBilingualStatus() {
    if (!state.bilingual) return;
    const current = ui.doc.querySelector("#reader-bilingual-status");
    if (!current) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = bilingualStatusMarkup();
    current.replaceWith(wrapper.firstElementChild);
  }

  function toggleBilingual() {
    const ratio = getScrollRatio();
    const wasPaged = isPagedMode();
    state.bilingual = !state.bilingual;
    prefs.bilingual = state.bilingual;
    if (state.bilingual) {
      if (state.mode === "paged") {
        state.mode = "scroll";
        prefs.mode = "scroll";
      }
    }
    savePreferences();
    setBilingualButton();
    applyModeUI();
    if (!state.bilingual) {
      state.translationToken += 1;
      if (state.translationStatus === "loading") {
        state.translationStatus = state.translations?.every(Boolean) ? "done" : "idle";
      }
      renderChapterDoc({ preserveRatio: ratio });
      return;
    }
    if (wasPaged) {
      app.showToast("已切换到对照滚动", "双栏译文更适合连续滚动阅读。", { icon: "languages" });
    }
    renderChapterDoc({ preserveRatio: ratio });
  }

  /* ---------- Panels ---------- */

  function openPanel(panel, { focusSearch = false } = {}) {
    if (!ui.layer) return;
    state.panel = panel;
    ui.scrim.classList.add("is-open");
    ui.toc.classList.toggle("is-open", panel === "toc");
    ui.word.classList.toggle("is-open", panel === "word");
    ui.toc.setAttribute("aria-hidden", String(panel !== "toc"));
    ui.word.setAttribute("aria-hidden", String(panel !== "word"));
    ui.settings.hidden = true;
    if (panel !== "word") state.wordLookupToken += 1;
    if (panel === "toc") {
      if (ui.tocSearchInput) ui.tocSearchInput.value = state.searchQuery;
      renderToc();
      updateTocActive();
      window.setTimeout(() => {
        if (focusSearch) {
          ui.tocSearchInput?.focus();
          ui.tocSearchInput?.select();
          return;
        }
        ui.tocList.scrollTop = 0;
        const active = ui.tocList.querySelector(".reader-toc-node.is-active");
        if (active && !active.closest('[data-toc-branch="toc-extra-unlisted"]')) {
          active.scrollIntoView({ block: "center", behavior: "auto" });
        }
      }, 120);
    }
  }

  function closeReaderPanels() {
    if (!ui.layer) return;
    state.panel = "";
    ui.scrim?.classList.remove("is-open");
    ui.toc?.classList.remove("is-open");
    ui.word?.classList.remove("is-open");
    if (ui.toc) ui.toc.setAttribute("aria-hidden", "true");
    if (ui.word) ui.word.setAttribute("aria-hidden", "true");
    if (ui.settings) ui.settings.hidden = true;
    state.wordLookupToken += 1;
  }

  function toggleToc() {
    if (state.panel === "toc") closeReaderPanels();
    else openPanel("toc");
  }

  function openBookSearch() {
    openPanel("toc", { focusSearch: true });
  }

  function runBookSearch(rawQuery) {
    state.searchQuery = String(rawQuery || "").trim();
    renderToc();
  }

  function toggleSettings() {
    if (!ui.settings) return;
    const willOpen = ui.settings.hidden;
    ui.settings.hidden = !willOpen;
    if (willOpen) closeWordPanelOnly();
  }

  function closeWordPanelOnly() {
    ui.word?.classList.remove("is-open");
    ui.word?.setAttribute("aria-hidden", "true");
    if (state.panel === "word") {
      state.panel = "";
      ui.scrim?.classList.remove("is-open");
    }
  }

  /* ---------- Selection & word lookup ---------- */

  function hideReaderSelectionTool() {
    if (!ui.selectTool) return;
    ui.selectTool.hidden = true;
    ui.selectTool.classList.remove("is-below");
    state.selectionWord = "";
    state.selectionContext = "";
  }

  function showReaderSelectionTool(word, context, rect) {
    if (!ui.selectTool) return;
    state.selectionWord = word;
    state.selectionContext = context;
    ui.selectTool.querySelector(".reader-select-word").textContent = word;
    ui.selectTool.hidden = false;
    ui.selectTool.classList.remove("is-below");
    const width = ui.selectTool.offsetWidth;
    const height = ui.selectTool.offsetHeight;
    const center = rect.left + rect.width / 2;
    const left = clamp(center, 18 + width / 2, window.innerWidth - 18 - width / 2);
    const above = rect.top > height + 20;
    ui.selectTool.style.left = `${left}px`;
    ui.selectTool.style.top = above ? `${rect.top - 7}px` : `${rect.bottom + 8}px`;
    if (!above) ui.selectTool.classList.add("is-below");
  }

  function handleReaderSelection(event) {
    if (!state.isOpen || state.panel) return;
    const source = event.target.closest?.(".reader-source-text, .reader-block");
    if (!source) return;
    window.setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        hideReaderSelectionTool();
        return;
      }
      const raw = selection.toString().replace(/\s+/g, " ").trim();
      if (!raw || raw.length > WORD_LIMIT) {
        hideReaderSelectionTool();
        return;
      }
      const word = cleanWord(raw);
      if (!word) return;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) return;
      const context = contextAroundTerm(source.textContent || "", word);
      showReaderSelectionTool(word, context, rect);
    }, 0);
  }

  function cleanWord(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, "")
      .trim()
      .slice(0, WORD_LIMIT);
  }

  function contextAroundTerm(text, term) {
    const normalized = normalizeText(text);
    if (!normalized) return "";
    const index = normalized.toLocaleLowerCase().indexOf(String(term || "").toLocaleLowerCase());
    if (index < 0) return normalized.slice(0, 220);
    let start = 0;
    for (const marker of SENTENCE_MARKERS) {
      const position = normalized.lastIndexOf(marker, Math.max(0, index - 1));
      if (position >= 0) start = Math.max(start, position + marker.length);
    }
    const endLimit = index + String(term).length;
    const ends = SENTENCE_MARKERS
      .map((marker) => normalized.indexOf(marker, endLimit))
      .filter((position) => position >= 0)
      .map((position) => position + 1);
    let end = ends.length ? Math.min(...ends) : normalized.length;
    if (end - start > 260) end = start + 260;
    return `${start > 0 ? "…" : ""}${normalized.slice(start, end).trim()}${end < normalized.length ? "…" : ""}`;
  }

  function openWordPanel(word, context = "", { focusInput = false } = {}) {
    if (!ui.word) return;
    closeReaderSelectionToolAndSelection();
    openPanel("word");
    if (ui.wordInput) ui.wordInput.value = word || "";
    if (!word) {
      ui.wordSubtitle.textContent = "输入一个词，或回到原文里选中它";
      ui.wordBody.innerHTML = `<div class="reader-word-empty"><strong>Aa</strong><span>在原文里选中一个词，<br>或者在上方输入英文 / 原文中的词组。</span></div>`;
      if (focusInput) window.setTimeout(() => ui.wordInput?.focus(), 220);
      return;
    }
    ui.wordSubtitle.textContent = context ? "来自当前章节的原句" : "输入或选中一个词来查询";
    ui.wordBody.innerHTML = `<div class="reader-word-loading"><div class="reader-word-skeleton reader-word-skeleton--title"></div><div class="reader-word-skeleton"></div><div class="reader-word-skeleton"></div></div>`;
    const token = ++state.wordLookupToken;
    lookupReaderWord(word, context, token);
  }

  function lookupFromWordInput() {
    if (!ui.wordInput) return;
    const word = cleanWord(ui.wordInput.value);
    if (!word) {
      ui.wordInput.focus();
      return;
    }
    ui.wordSubtitle.textContent = "正在查这个词…";
    ui.wordBody.innerHTML = `<div class="reader-word-loading"><div class="reader-word-skeleton reader-word-skeleton--title"></div><div class="reader-word-skeleton"></div><div class="reader-word-skeleton"></div></div>`;
    const token = ++state.wordLookupToken;
    lookupReaderWord(word, "", token);
  }

  function closeReaderSelectionToolAndSelection() {
    hideReaderSelectionTool();
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      // Selection cleanup is optional.
    }
  }

  function isEnglishWord(word) {
    return /^[A-Za-z][A-Za-z'’\- ]*$/.test(word);
  }

  async function lookupReaderWord(word, context, token) {
    const clean = cleanWord(word);
    if (!clean) return;
    const profile = translationProfile();
    if (isEnglishWord(clean)) {
      const [dictionaryResult, translationResult] = await Promise.allSettled([
        fetch("/api/define", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: clean }),
        }).then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "查词服务没有响应。");
          return data;
        }),
        app.translateTextBatch([clean], "en", "zh-CN").catch(() => null),
      ]);
      if (token !== state.wordLookupToken) return;
      const dictionary = dictionaryResult.status === "fulfilled" ? dictionaryResult.value : null;
      const translated = translationResult.status === "fulfilled" ? translationResult.value?.translations?.[0] : "";
      if (!dictionary && !translated) {
        showReaderWordError("查词服务暂时不可用，请确认已经通过 start.cmd 启动本地服务。");
        return;
      }
      const payload = dictionary || {
        word: clean,
        found: false,
        phonetic: "",
        audio: "",
        meanings: [],
        sourceUrl: "",
      };
      if (translated) {
        payload.translation = translated;
        payload.notice = payload.found ? "" : "词典里没有收录这个词形，先看看中文意思。";
      }
      renderReaderWord(payload, clean, context);
    } else {
      try {
        const result = await app.translateTextBatch([clean], profile.from, profile.to);
        if (token !== state.wordLookupToken) return;
        const translated = result?.translations?.[0];
        if (!translated) throw new Error("Empty translation");
        renderReaderWord({
          word: clean,
          found: false,
          translation: translated,
          translationProvider: providerText(result.providers),
          notice: "当前词典只提供英文释义，这里显示的是机器翻译。",
          meanings: [],
        }, clean, context);
      } catch {
        if (token !== state.wordLookupToken) return;
        showReaderWordError("这个词暂时没有查到，请检查网络后再试。");
      }
    }
  }

  function showReaderWordError(message) {
    ui.wordBody.innerHTML = `<div class="reader-word-error">${escapeHTML(message)}</div>`;
  }

  function renderReaderWord(result, fallbackWord, context) {
    const phonetic = result.phonetic
      ? `<div class="reader-word-phonetic"><span>${escapeHTML(result.phonetic)}</span>${result.audio ? `<button class="reader-word-audio" type="button" data-reader-audio="${escapeHTML(result.audio)}" aria-label="播放发音">${icon("volume")}</button>` : ""}</div>`
      : (result.audio ? `<div class="reader-word-phonetic"><button class="reader-word-audio" type="button" data-reader-audio="${escapeHTML(result.audio)}" aria-label="播放发音">${icon("volume")}</button></div>` : "");
    const meanings = (result.meanings || []).map((meaning) => {
      const definitions = (meaning.definitions || []).map((entry) => `<li>${escapeHTML(entry.definition)}${entry.example ? `<span class="reader-word-example">“${escapeHTML(entry.example)}”</span>` : ""}</li>`).join("");
      const zh = {
        noun: "名词", verb: "动词", adjective: "形容词", adverb: "副词", pronoun: "代词", preposition: "介词", conjunction: "连词", interjection: "感叹词", determiner: "限定词",
      }[meaning.partOfSpeech] || "";
      return `<div class="reader-word-sense">
        <div class="reader-word-pos">${escapeHTML(meaning.partOfSpeech || "word")}${zh ? `<span>${escapeHTML(zh)}</span>` : ""}</div>
        <ol class="reader-word-defs">${definitions}</ol>
      </div>`;
    }).join("");
    const contextMarkup = context ? `<div class="reader-word-context">“${escapeHTML(context)}”<span>原文语境</span></div>` : "";
    const notice = result.notice && !result.found ? `<div class="reader-word-error" style="background: rgba(244, 240, 231, .55); border-color: rgba(44, 48, 39, .07); color: #8d887c;">${escapeHTML(result.notice)}</div>` : "";
    ui.wordSubtitle.textContent = context ? "来自当前章节的原句" : "词语释义";
    ui.wordBody.innerHTML = `<div class="reader-word-header">
      <h3 class="reader-word">${escapeHTML(result.word || fallbackWord)}</h3>
      <span class="dict-lang">${isEnglishWord(fallbackWord) ? "EN" : "原文"}</span>
    </div>
    ${phonetic}
    ${result.translation ? `<div class="reader-word-translation">${escapeHTML(result.translation)}</div>` : '<div class="reader-word-translation" style="background: rgba(244, 240, 231, .55); color: #8d887c;">暂时没有中文翻译。</div>'}
    ${contextMarkup}
    ${meanings ? `<div class="reader-word-senses">${meanings}</div>` : notice}
    ${result.sourceUrl ? `<p class="reader-word-source">释义来自 <a href="${escapeHTML(result.sourceUrl)}" target="_blank" rel="noopener noreferrer">Wiktionary</a> · CC BY-SA 3.0</p>` : ""}`;
  }

  function playReaderAudio(url) {
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.play().catch(() => app.showToast("发音暂时无法播放", "可以检查网络后再试。", { icon: "volume" }));
    } catch {
      app.showToast("发音暂时无法播放", "这个音频源没有响应。", { icon: "volume" });
    }
  }

  /* ---------- Keyboard / focus ---------- */

  function readerFocusableElements() {
    if (!ui.layer) return [];
    return Array.from(ui.layer.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])"))
      .filter((element) => {
        if (!element.getClientRects().length) return false;
        const hiddenDrawer = element.closest(".reader-drawer");
        if (hiddenDrawer && !hiddenDrawer.classList.contains("is-open")) return false;
        const hiddenSettings = element.closest(".reader-settings");
        if (hiddenSettings && hiddenSettings.hidden) return false;
        return true;
      });
  }

  function handleReaderKeydown(event) {
    if (!state.isOpen) return;
    if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element) {
      const link = event.target.closest("[data-reader-link]");
      if (link) {
        event.preventDefault();
        link.click();
        return;
      }
    }
    if (event.key === "Escape") {
      if (state.importing) return;
      if (state.panel) {
        event.preventDefault();
        closeReaderPanels();
        return;
      }
      if (ui.settings && !ui.settings.hidden) {
        event.preventDefault();
        ui.settings.hidden = true;
        return;
      }
      event.preventDefault();
      closeReader();
      return;
    }
    if (event.key === "Tab") {
      const focusable = readerFocusableElements();
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
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openBookSearch();
      return;
    }
    if (state.panel || (ui.settings && !ui.settings.hidden) || state.importing) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, textarea, select, button, [contenteditable='true']")) return;
    if (!isPagedMode()) {
      if (!ui.main) return;
      if (["PageDown", "ArrowDown", " "].includes(event.key)) {
        event.preventDefault();
        ui.main.scrollBy({ top: Math.max(120, ui.main.clientHeight * 0.86), behavior: "smooth" });
        return;
      }
      if (["PageUp", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        ui.main.scrollBy({ top: -Math.max(120, ui.main.clientHeight * 0.86), behavior: "smooth" });
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        ui.main.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        ui.main.scrollTo({ top: ui.main.scrollHeight, behavior: "smooth" });
      }
      return;
    }
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
      if (event.key === " " && event.shiftKey) {
        event.preventDefault();
        turnPage(-1);
        return;
      }
      event.preventDefault();
      turnPage(1);
      return;
    }
    if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
      event.preventDefault();
      turnPage(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      goToPage(0, { animate: false });
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      goToPage(state.pageCount - 1, { animate: false });
    }
  }

  /* ---------- Events ---------- */

  function handleReaderClick(event) {
    if (!ui.layer) return;
    const action = event.target.closest("[data-reader-action]")?.dataset.readerAction;
    if (action) {
      switch (action) {
        case "close":
          closeReader();
          return;
        case "toc":
          toggleToc();
          return;
        case "search-book":
          openBookSearch();
          return;
        case "word-search":
          openWordPanel("", "", { focusInput: true });
          return;
        case "bilingual":
          toggleBilingual();
          return;
        case "toggle-mode":
          toggleReaderMode();
          return;
        case "settings":
          toggleSettings();
          return;
        case "close-panel":
          closeReaderPanels();
          return;
        case "retry-translation":
          ensureChapterTranslations(true);
          return;
        case "finish":
          if (currentBook()) app.markEbookFinished(currentBook().id);
          renderChapterDoc({ preserveRatio: isPagedMode() ? 1 : getScrollRatio() });
          return;
        case "return-note":
          returnToOriginalLocation();
          return;
        case "import":
          openFilePicker();
          return;
        default:
          return;
      }
    }

    const bookLink = event.target.closest("[data-reader-link]");
    if (bookLink) {
      event.preventDefault();
      const linkIndex = Number(bookLink.dataset.readerLink);
      if (Number.isInteger(linkIndex)) jumpToReaderLink(linkIndex);
      return;
    }

    const navButton = event.target.closest("[data-reader-nav]");
    if (navButton) {
      const direction = navButton.dataset.readerNav;
      const next = state.chapterIndex + (direction === "next" ? 1 : -1);
      if (next >= 0 && next < state.chapters.length) loadChapter(next, { scrollRatio: 0 });
      return;
    }

    const pageButton = event.target.closest("[data-reader-page]");
    if (pageButton) {
      turnPage(pageButton.dataset.readerPage === "next" ? 1 : -1);
      return;
    }

    const modeButton = event.target.closest("[data-reader-mode]");
    if (modeButton) {
      setReaderMode(modeButton.dataset.readerMode);
      return;
    }

    const searchResult = event.target.closest("[data-reader-search-chapter]");
    if (searchResult) {
      const chapterIndex = Number(searchResult.dataset.readerSearchChapter);
      const blockIndex = searchResult.dataset.readerSearchBlock === undefined
        ? null
        : Number(searchResult.dataset.readerSearchBlock);
      if (Number.isInteger(chapterIndex)) openSearchResult(chapterIndex, blockIndex);
      return;
    }

    const tocToggle = event.target.closest("[data-toc-toggle]");
    if (tocToggle) {
      toggleTocBranch(tocToggle.dataset.tocToggle);
      return;
    }

    const tocOpen = event.target.closest("[data-toc-open]");
    if (tocOpen) {
      openTocNode(tocOpen.dataset.tocOpen);
      return;
    }

    const tocButton = event.target.closest("[data-reader-chapter]");
    if (tocButton) {
      const index = Number(tocButton.dataset.readerChapter);
      if (Number.isInteger(index)) loadChapter(index, { scrollRatio: 0 });
      return;
    }

    const fontButton = event.target.closest("[data-reader-font]");
    if (fontButton) {
      prefs.fontSize = clamp(prefs.fontSize + Number(fontButton.dataset.readerFont), 14, 23);
      savePreferences();
      const ratio = getScrollRatio();
      applyPreferences();
      renderChapterDoc({ preserveRatio: ratio });
      return;
    }

    const lineButton = event.target.closest("[data-reader-line]");
    if (lineButton) {
      prefs.lineHeight = clamp(Number(lineButton.dataset.readerLine) || 1.9, 1.55, 2.25);
      savePreferences();
      const ratio = getScrollRatio();
      applyPreferences();
      renderChapterDoc({ preserveRatio: ratio });
      return;
    }

    const audioButton = event.target.closest("[data-reader-audio]");
    if (audioButton) {
      playReaderAudio(audioButton.dataset.readerAudio || "");
      return;
    }

    const wordButton = event.target.closest("[data-reader-word]");
    if (wordButton && state.selectionWord) {
      openWordPanel(state.selectionWord, state.selectionContext);
      return;
    }

    if (!event.target.closest("#reader-settings") && !event.target.closest('[data-reader-action="settings"]')) {
      if (ui.settings && !ui.settings.hidden) ui.settings.hidden = true;
    }
  }

  function bindReaderEvents() {
    ui.layer?.addEventListener("click", handleReaderClick);
    ui.selectTool?.addEventListener("click", (event) => {
      if (event.target.closest("[data-reader-word]") && state.selectionWord) {
        openWordPanel(state.selectionWord, state.selectionContext);
      }
    });
    ui.wordSearchForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      lookupFromWordInput();
    });
    ui.pageForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!isPagedMode()) return;
      const page = Number(ui.pageInput?.value);
      if (!Number.isFinite(page) || page < 1) {
        updatePageStatus();
        return;
      }
      goToPage(page - 1, { animate: true });
      ui.pageInput?.blur();
    });
    ui.pageInput?.addEventListener("focus", () => ui.pageInput.select());
    ui.pageInput?.addEventListener("blur", () => updatePageStatus());
    ui.tocSearchForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      runBookSearch(ui.tocSearchInput?.value || "");
    });
    let searchTimer = 0;
    ui.tocSearchInput?.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        runBookSearch(ui.tocSearchInput?.value || "");
      }, 260);
    });
    ui.layer?.addEventListener("mousedown", (event) => {
      if (!event.target.closest("#reader-select-tool")) hideReaderSelectionTool();
    });
    ui.layer?.addEventListener("mouseup", handleReaderSelection);
    ui.layer?.addEventListener("touchend", (event) => {
      window.setTimeout(() => handleReaderSelection(event), 80);
    });
    ui.main?.addEventListener("scroll", () => {
      hideReaderSelectionTool();
      if (state.scrollFrame) return;
      state.scrollFrame = requestAnimationFrame(() => {
        state.scrollFrame = 0;
        setProgressDisplay();
        const book = currentBook();
        if (book) {
          book.readerScroll = getScrollRatio();
          book.readerChapter = state.chapterIndex;
        }
        schedulePositionSave();
      });
    });
    ui.importLayer?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-import-action]")?.dataset.importAction;
      if (action === "retry") openFilePicker();
      if (action === "close") closeImportLayer();
    });
    window.addEventListener("keydown", handleReaderKeydown);
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      hideReaderSelectionTool();
      if (!state.isOpen || !isPagedMode()) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!state.isOpen || !isPagedMode()) return;
        layoutPageFlow({ preserveRatio: getScrollRatio() });
      }, 180);
    });
    window.addEventListener("scroll", hideReaderSelectionTool, true);
    document.addEventListener("visibilitychange", () => {
      if (!state.isOpen) return;
      if (document.visibilityState === "hidden") pauseReadingSession();
      else resumeReadingSession();
    });
  }

  function persistReaderOnPageHide() {
    if (!state.isOpen) return;
    persistPosition();
    flushReadingSession();
  }

  /* ---------- Global bootstrap ---------- */

  function bindGlobalEvents() {
    document.addEventListener("click", (event) => {
      const importTrigger = event.target.closest('[data-action="import-ebook"]');
      if (importTrigger) {
        event.preventDefault();
        openFilePicker();
        return;
      }
      const readTrigger = event.target.closest("[data-reader-open]");
      if (readTrigger) {
        event.preventDefault();
        const bookId = readTrigger.dataset.readerOpen;
        if (bookId) openReader(bookId);
      }
    });

    document.getElementById("ebook-file-input")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) importFile(file);
    });

    window.addEventListener("shiye:delete-ebook", (event) => {
      const bookId = event.detail?.bookId;
      if (!bookId) return;
      if (state.activeBookId === bookId) forceCloseReader();
      deleteBookContent(bookId).catch(() => {});
    });

    window.addEventListener("shiye:data-reset", () => {
      forceCloseReader();
      clearReaderData().catch(() => {});
    });

    window.addEventListener("pagehide", persistReaderOnPageHide);
    window.addEventListener("pageshow", () => {
      if (state.isOpen) resumeReadingSession();
    });

    // Drop a file almost anywhere in the library to import it.
    document.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      if (state.isOpen) return;
      event.preventDefault();
    });
    document.addEventListener("drop", (event) => {
      if (state.isOpen) return;
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      const view = document.querySelector(".view.is-active")?.dataset.viewPanel;
      if (view !== "shelf" && view !== "overview") return;
      event.preventDefault();
      importFile(file);
    });
  }

  function init() {
    if (!document.getElementById("reader-root")) return;
    ensureShell();
    bindGlobalEvents();
    if (typeof app.consumeReaderCleanupIds === "function") {
      const cleanupIds = app.consumeReaderCleanupIds();
      cleanupIds.forEach((bookId) => {
        deleteBookContent(bookId).catch(() => {});
      });
    }
    window.ShiyeReader = {
      open: openReader,
      close: closeReader,
      importFile,
      clear: clearReaderData,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
