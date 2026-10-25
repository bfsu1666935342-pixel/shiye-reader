import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/* ---------- Local app ---------- */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 4173;
const APP_URL = `http://${HOST}:${PORT}`;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".epub": "application/epub+zip",
  ".ico": "image/x-icon",
};

/* ---------- Translation & dictionary proxy ---------- */

const SOURCE_LANGS = new Set(["auto", "en", "ja", "fr", "de", "es", "ko"]);
const TARGET_LANGS = new Set(["zh-CN", "zh-TW", "en", "ja"]);
const MAX_PARAGRAPHS = 60;
const MAX_PARAGRAPH_CHARS = 1800;
const MAX_TOTAL_CHARS = 9000;
const API_CACHE_TTL = 60 * 60 * 1000;
const API_CACHE_LIMIT = 320;
const apiCache = new Map();

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new ApiError(413, "请求内容过大。");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "请求格式不正确。");
  }
}

function cacheGet(key) {
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    apiCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  if (apiCache.size >= API_CACHE_LIMIT) {
    const now = Date.now();
    for (const [cacheKey, entry] of apiCache) {
      if (entry.expiresAt <= now) apiCache.delete(cacheKey);
    }
    while (apiCache.size >= API_CACHE_LIMIT) {
      apiCache.delete(apiCache.keys().next().value);
    }
  }
  apiCache.set(key, { value, expiresAt: Date.now() + API_CACHE_TTL });
}

async function fetchJson(url, timeout = 12000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      "Accept": "application/json,text/plain,*/*",
      "User-Agent": "ShiyeReader/1.0 (local personal reading app)",
    },
  });
  if (!response.ok) {
    const error = new Error(`Upstream returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function splitForTranslation(text, maxLength) {
  const units = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const candidates = [
      remaining.lastIndexOf(". ", maxLength),
      remaining.lastIndexOf("! ", maxLength),
      remaining.lastIndexOf("? ", maxLength),
      remaining.lastIndexOf("。", maxLength),
      remaining.lastIndexOf("！", maxLength),
      remaining.lastIndexOf("？", maxLength),
      remaining.lastIndexOf("；", maxLength),
    ].filter((index) => index > maxLength * 0.4);
    let cut = candidates.length ? Math.max(...candidates) + 1 : -1;
    if (cut < 0) cut = remaining.lastIndexOf(" ", maxLength);
    if (cut < maxLength * 0.4) cut = maxLength;
    units.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) units.push(remaining);
  return units;
}

async function translateViaGoogle(text, from, to) {
  const chunks = splitForTranslation(text, 1600);
  const translated = [];
  let detected = "";

  for (const chunk of chunks) {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", from);
    url.searchParams.set("tl", to);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", chunk);

    const data = await fetchJson(url, 13000);
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error("Unexpected translation response");
    const piece = data[0]
      .map((segment) => (Array.isArray(segment) ? segment[0] : ""))
      .filter(Boolean)
      .join("")
      .trim();
    if (!piece) throw new Error("Empty translation");
    translated.push(piece);
    if (!detected && typeof data[2] === "string") detected = data[2];
  }

  return {
    text: translated.join(" ").replace(/\s+/g, " ").trim(),
    provider: "Google",
    detected,
  };
}

async function translateViaMyMemory(text, from, to) {
  const sourceLanguage = from === "auto" ? "en" : from;
  const chunks = splitForTranslation(text, 450);
  const translated = [];

  for (const chunk of chunks) {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", chunk);
    url.searchParams.set("langpair", `${sourceLanguage}|${to}`);
    const data = await fetchJson(url, 13000);
    if (data?.quotaFinished) throw new Error("Translation quota exhausted");
    const piece = String(data?.responseData?.translatedText || "").trim();
    if (!piece) throw new Error("Empty translation");
    translated.push(piece);
    if (chunks.length > 1) await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return {
    text: translated.join(" ").replace(/\s+/g, " ").trim(),
    provider: "MyMemory",
    detected: sourceLanguage,
  };
}

async function translateText(text, from, to) {
  if (from === to) return { text, provider: "Original", detected: from === "auto" ? "" : from };
  const key = `translate:${from}:${to}:${text}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  let result;
  try {
    result = await translateViaGoogle(text, from, to);
  } catch {
    result = await translateViaMyMemory(text, from, to);
  }
  if (!result.text) throw new Error("No translation returned");
  cacheSet(key, result);
  return result;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function handleTranslate(request, response) {
  const body = await readJsonBody(request);
  const from = String(body.from || "en");
  const to = String(body.to || "zh-CN");
  const inputParagraphs = Array.isArray(body.paragraphs) ? body.paragraphs : [];

  if (!SOURCE_LANGS.has(from) || !TARGET_LANGS.has(to)) {
    throw new ApiError(400, "暂不支持这组语言。");
  }
  if (!inputParagraphs.length) throw new ApiError(400, "没有需要翻译的内容。");
  if (inputParagraphs.length > MAX_PARAGRAPHS) throw new ApiError(400, "段落太多，请分段翻译。");

  const paragraphs = inputParagraphs.map((paragraph) => String(paragraph || "").trim());
  if (paragraphs.some((paragraph) => !paragraph)) throw new ApiError(400, "原文里有空白段落。");
  if (paragraphs.some((paragraph) => paragraph.length > MAX_PARAGRAPH_CHARS)) {
    throw new ApiError(400, "单段文字过长，请分段后再试。");
  }
  const totalChars = paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) throw new ApiError(413, "一次最多翻译 9,000 字，请分段翻译。");

  const providers = [];
  let detected = "";
  const translations = await mapWithConcurrency(paragraphs, 3, async (paragraph) => {
    try {
      const result = await translateText(paragraph, from, to);
      providers.push(result.provider);
      if (!detected && result.detected) detected = result.detected;
      return result.text;
    } catch {
      return null;
    }
  });

  if (translations.every((translation) => !translation)) {
    throw new ApiError(502, "翻译服务暂时不可用，请检查网络后再试。");
  }

  sendJson(response, 200, {
    translations,
    providers: Array.from(new Set(providers)),
    detected,
    from,
    to,
    totalChars,
  });
}

function parseDictionaryEntry(data, fallbackWord) {
  if (!Array.isArray(data) || !data.length) return null;
  const entry = data[0] || {};
  const phonetic = String(
    entry.phonetic
    || (entry.phonetics || []).find((item) => item?.text)?.text
    || ""
  );
  const phonetics = (entry.phonetics || []).filter((item) => item?.audio);
  const audio = String(
    phonetics.find((item) => item.audio.includes("-us"))?.audio
    || phonetics.find((item) => item.audio.includes("-uk"))?.audio
    || phonetics[0]?.audio
    || ""
  );

  const meanings = [];
  for (const meaning of entry.meanings || []) {
    if (meanings.length >= 4) break;
    const definitions = (meaning.definitions || [])
      .filter((item) => item?.definition)
      .slice(0, 3)
      .map((item) => ({
        definition: String(item.definition),
        example: item.example ? String(item.example) : "",
        synonyms: Array.isArray(item.synonyms) ? item.synonyms.slice(0, 3) : [],
      }));
    if (!definitions.length) continue;
    meanings.push({
      partOfSpeech: String(meaning.partOfSpeech || ""),
      definitions,
    });
  }

  return {
    word: String(entry.word || fallbackWord),
    phonetic,
    audio,
    meanings,
    sourceUrl: Array.isArray(entry.sourceUrls) && entry.sourceUrls[0]
      ? String(entry.sourceUrls[0])
      : `https://en.wiktionary.org/wiki/${encodeURIComponent(fallbackWord)}`,
  };
}

async function handleDefine(request, response) {
  const body = await readJsonBody(request);
  const rawWord = String(body.word || "").trim().slice(0, 60);
  const word = rawWord.replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, "").trim();
  if (!word) throw new ApiError(400, "请输入要查询的英文单词。");
  if (!/[A-Za-z]/.test(word)) throw new ApiError(400, "查词目前支持英文单词或短语。");

  const key = `define:${word.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) {
    sendJson(response, 200, cached);
    return;
  }

  const [dictionaryResult, translationResult] = await Promise.allSettled([
    fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, 9000)
      .then((data) => parseDictionaryEntry(data, word))
      .catch((error) => {
        if (error.status === 404) return null;
        throw error;
      }),
    translateText(word, "en", "zh-CN"),
  ]);

  const dictionary = dictionaryResult.status === "fulfilled" ? dictionaryResult.value : null;
  const translation = translationResult.status === "fulfilled" ? translationResult.value : null;

  if (!dictionary && !translation) {
    throw new ApiError(502, "词典和翻译服务暂时不可用，请检查网络后再试。");
  }

  const payload = {
    word,
    found: Boolean(dictionary),
    phonetic: dictionary?.phonetic || "",
    audio: dictionary?.audio || "",
    meanings: dictionary?.meanings || [],
    sourceUrl: dictionary?.sourceUrl || `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
    translation: translation?.text || "",
    translationProvider: translation?.provider || "",
    notice: !dictionary
      ? "词典里暂时没有收录这个词形，先看看它的中文意思。"
      : !translation
        ? "中文翻译暂时不可用，可以先参考英文释义。"
        : "",
  };

  cacheSet(key, payload);
  sendJson(response, 200, payload);
}

async function handleApiRequest(request, response) {
  const url = new URL(request.url, APP_URL);
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "仅支持 POST 请求。" });
    return;
  }

  try {
    if (url.pathname === "/api/translate") {
      await handleTranslate(request, response);
    } else if (url.pathname === "/api/define") {
      await handleDefine(request, response);
    } else {
      sendJson(response, 404, { error: "接口不存在。" });
    }
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "服务暂时不可用，请稍后再试。";
    sendJson(response, status, { error: message });
  }
}

/* ---------- Static server ---------- */

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, APP_URL);
    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApiRequest(request, response);
      return;
    }

    const pathname = decodeURIComponent(requestUrl.pathname);
    const requested = pathname === "/" ? "/index.html" : pathname;
    const filePath = resolve(ROOT, `.${requested}`);

    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const data = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(data);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

function openBrowser() {
  if (process.argv.includes("--no-open")) return;
  const command = process.platform === "win32"
    ? `start "" "${APP_URL}"`
    : process.platform === "darwin"
      ? `open "${APP_URL}"`
      : `xdg-open "${APP_URL}"`;
  exec(command, () => {});
}

server.on("error", async (error) => {
  if (error.code !== "EADDRINUSE") {
    console.error(error);
    process.exitCode = 1;
    return;
  }

  try {
    const response = await fetch(`${APP_URL}/`, { signal: AbortSignal.timeout(1600) });
    const html = await response.text();
    if (response.ok && html.includes("拾页")) {
      console.log(`\n  拾页已经在运行：${APP_URL}\n`);
      openBrowser();
      process.exit(0);
    }
  } catch {
    // Fall through to the helpful port message.
  }

  console.error(`\n端口 ${PORT} 已被占用。请关闭占用它的程序，或使用其他端口：`);
  console.error(`  set PORT=4174 && node server.mjs\n`);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`\n  拾页 · 阅读档案`);
  console.log(`  ${APP_URL}\n`);
  console.log(`  对照翻译与查词已就绪。数据保存在浏览器本地。`);
  console.log(`  关闭这个窗口即可停止服务。\n`);
  openBrowser();
});
