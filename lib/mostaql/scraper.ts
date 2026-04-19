/**
 * Mostaql market scraper.
 *
 * Crawls the public projects listing on https://mostaql.com/projects/{category}
 * for one or more categories, then fetches each project's detail page and
 * extracts a structured row.
 *
 * Use from server-only code (server actions / route handlers).
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type MostaqlCategorySlug =
  | "development"
  | "ai-machine-learning"
  | (string & {});

export type MostaqlScrapedProject = {
  url: string;
  mostaqlId: string | null;
  title: string | null;
  category: string | null;
  subcategory: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: "SAR" | "USD" | null;
  description: string | null;
  skillsTags: string[];
  clientName: string | null;
  clientUrl: string | null;
  offersCount: number | null;
  /** open | closed | unknown */
  projectStatus: string | null;
  publishedAt: Date | null;
  durationDays: number | null;
};

export type CrawlOptions = {
  /** "all" walks pagination until no more `rel="next"`. Otherwise number of pages per category. */
  pages: number | "all";
  categories: MostaqlCategorySlug[];
  /** Hard ceiling on total project detail fetches (defense against runaway "all"). */
  maxProjects?: number;
  /** Listing items whose Mostaql numeric id is in this set are skipped before any detail fetch (de-duplication across runs). */
  skipMostaqlIds?: Set<string>;
  /** Listing items whose URL is in this set are skipped before any detail fetch (fallback when id is missing). */
  skipUrls?: Set<string>;
  /** Optional callback for progress reporting. */
  onProgress?: (info: {
    phase: "list" | "detail" | "done";
    category?: string;
    page?: number;
    pagesFetched?: number;
    projectsFound?: number;
    projectsScraped?: number;
    currentUrl?: string;
  }) => void;
  /** How many times to retry a single project page when rate-limited. Default 3. */
  detailRetryCount?: number;
  /** Initial back-off (ms) after a rate-limit hit; doubled per retry. Default 30000. */
  detailRetryBaseDelayMs?: number;
  /**
   * Stop the whole crawl after this many consecutive irrecoverable rate-limit
   * failures (i.e. retries exhausted). Default 3. Successful projects scraped
   * before this point are still returned/saved.
   */
  abortAfterConsecutiveFailures?: number;
};

export type CrawlResult = {
  projects: MostaqlScrapedProject[];
  pagesFetched: number;
  /** Total unique listing items found across all categories (pre-dedup). */
  projectsFound: number;
  /** How many of those were skipped because they already exist in the DB. */
  projectsSkippedDuplicate: number;
  /** Detail pages we couldn't scrape (rate-limited or fetch error). They're left
   *  unsaved so the next run can retry them via the dedup gate. */
  projectsFailedDetail: number;
  /** True if the crawl was cut short by repeated rate-limit failures. */
  abortedByRateLimit: boolean;
};

/* -------------------------------------------------------------------------- */
/* Fetch helpers                                                               */
/* -------------------------------------------------------------------------- */

const BASE_URL = "https://mostaql.com";

/** Optional logged-in cookie (see .env.example) so Mostaql returns extended HTML. */
function mostaqlFetchHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ar,en;q=0.9",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    Referer: "https://mostaql.com/",
  };
  const cookie = process.env.MOSTAQL_COOKIE?.trim();
  if (cookie) h.Cookie = cookie;
  return h;
}

/**
 * Thrown when Mostaql rate-limits us (HTTP 429/403/503 or returns a
 * Cloudflare/interstitial page that lacks the expected project markup).
 * Distinguishes "back off and retry" from "real fetch error".
 */
export class MostaqlRateLimitError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "MostaqlRateLimitError";
  }
}

const RATE_LIMIT_STATUSES = new Set([403, 429, 503]);

/** Heuristic: a real Mostaql project page always contains a meta-row table. */
function looksLikeProjectPage(html: string): boolean {
  return /class="meta-label"/i.test(html) || /id="bidsCollection-panel"/i.test(html);
}

/** Heuristic: Cloudflare / antibot interstitial. */
function looksLikeAntibotPage(html: string): boolean {
  return (
    /Just a moment\.\.\./i.test(html) ||
    /cf-browser-verification|cf-challenge|cdn-cgi\/challenge-platform/i.test(html) ||
    /Attention Required/i.test(html)
  );
}

async function fetchHtml(
  url: string,
  signal?: AbortSignal,
  opts?: { isProjectPage?: boolean }
): Promise<string> {
  const res = await fetch(url, {
    headers: mostaqlFetchHeaders(),
    signal,
    cache: "no-store",
  });
  if (RATE_LIMIT_STATUSES.has(res.status)) {
    throw new MostaqlRateLimitError(
      `Rate-limited fetching ${url} (${res.status})`,
      url,
      res.status
    );
  }
  if (!res.ok) throw new Error(`Fetch ${url} failed (${res.status})`);
  const html = await res.text();
  if (looksLikeAntibotPage(html)) {
    throw new MostaqlRateLimitError(`Antibot challenge for ${url}`, url, res.status);
  }
  if (opts?.isProjectPage && !looksLikeProjectPage(html)) {
    throw new MostaqlRateLimitError(
      `Project page body missing expected markup for ${url}`,
      url,
      res.status
    );
  }
  return html;
}

function jitterDelay(min = 1500, max = 3000): Promise<void> {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* -------------------------------------------------------------------------- */
/* Generic HTML helpers                                                        */
/* -------------------------------------------------------------------------- */

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Decode common HTML entities while preserving paragraph boundaries (uses double newlines). */
function htmlToText(html: string, maxLen = 8000): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*\/li\s*>/gi, "\n");
  return stripHtml(withBreaks)
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen);
}

/* -------------------------------------------------------------------------- */
/* URL helpers                                                                 */
/* -------------------------------------------------------------------------- */

export function buildListingUrl(category: MostaqlCategorySlug, page: number): string {
  const base = `${BASE_URL}/projects/${encodeURIComponent(category)}`;
  return page > 1 ? `${base}?page=${page}` : base;
}

export function parseMostaqlIdFromUrl(url: string): string | null {
  const m = url.match(/\/project\/(\d+)/);
  return m?.[1] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Listing-page parsing                                                        */
/* -------------------------------------------------------------------------- */

export type ListingItem = {
  url: string;
  mostaqlId: string | null;
  title: string | null;
  clientName: string | null;
  publishedAt: Date | null;
  offersCount: number | null;
  brief: string | null;
};

const PROJECT_URL_RE =
  /href="(https:\/\/mostaql\.com\/project\/\d+[^"#]*)"[^>]*class="[^"]*details-url[^"]*"/gi;

const PROJECT_TITLE_LINK_RE =
  /<a\s+href="(https:\/\/mostaql\.com\/project\/(\d+)[^"#]*)"[^>]*>([\s\S]*?)<\/a>/i;

/** Convert "5 عروض" / "عرضان" / "أضف أول عرض" / "عرض واحد" → number | null. */
function parseArabicOfferCount(text: string): number | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (/أضف أول عرض/.test(t)) return 0;
  if (/عرض واحد/.test(t)) return 1;
  if (/عرضان/.test(t)) return 2;
  const m = t.match(/(\d+)\s*(?:عرض|عروض)/);
  if (m?.[1]) return parseInt(m[1], 10);
  const just = t.match(/(\d+)/);
  return just ? parseInt(just[1]!, 10) : null;
}

function extractListingItems(html: string): ListingItem[] {
  const items: ListingItem[] = [];
  const seen = new Set<string>();

  const rowRe = /<tr\s+class="project-row"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1] ?? "";
    const titleMatch = row.match(PROJECT_TITLE_LINK_RE);
    if (!titleMatch) continue;
    const url = titleMatch[1]!.split("#")[0]!;
    const id = titleMatch[2] ?? null;
    if (seen.has(url)) continue;
    seen.add(url);
    const title = stripHtml(titleMatch[3] ?? "") || null;

    const meta = row.match(
      /<ul\s+class="project__meta[^"]*"[^>]*>([\s\S]*?)<\/ul>/i
    )?.[1] ?? "";

    const clientMatch = meta.match(/<bdi>([\s\S]*?)<\/bdi>/i);
    const clientName = clientMatch ? stripHtml(clientMatch[1] ?? "") || null : null;

    const timeMatch = meta.match(/<time\s+datetime="([^"]+)"/i);
    const publishedAt = timeMatch ? safeDate(timeMatch[1]!) : null;

    const offersLi = [...meta.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((x) => stripHtml(x[1] ?? ""))
      .find(
        (t) =>
          /عرض|عروض|عرضان/.test(t) && !/تبليغ/.test(t) && !/منذ/.test(t)
      );
    const offersCount = offersLi ? parseArabicOfferCount(offersLi) : null;

    const briefMatch = row.match(
      /<p[^>]*class="[^"]*project__brief[^"]*"[^>]*>([\s\S]*?)<\/p>/i
    );
    const brief = briefMatch ? stripHtml(briefMatch[1] ?? "") || null : null;

    items.push({ url, mostaqlId: id, title, clientName, publishedAt, offersCount, brief });
  }

  if (items.length === 0) {
    let pm: RegExpExecArray | null;
    while ((pm = PROJECT_URL_RE.exec(html)) !== null) {
      const url = pm[1]!.split("#")[0]!;
      if (seen.has(url)) continue;
      seen.add(url);
      items.push({
        url,
        mostaqlId: parseMostaqlIdFromUrl(url),
        title: null,
        clientName: null,
        publishedAt: null,
        offersCount: null,
        brief: null,
      });
    }
  }

  return items;
}

function detectHasNextPage(html: string, currentPage: number): boolean {
  if (/rel="next"/i.test(html)) return true;
  const re = new RegExp(`\\?page=${currentPage + 1}[\"&#]`, "i");
  return re.test(html);
}

function safeDate(s: string): Date | null {
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/* -------------------------------------------------------------------------- */
/* Detail-page parsing                                                         */
/* -------------------------------------------------------------------------- */

function extractTitle(html: string): string | null {
  const dataTitle = html.match(
    /<h1[^>]*class="[^"]*heada__title[^"]*"[^>]*data-page-title="([^"]+)"/i
  );
  if (dataTitle?.[1]) return stripHtml(dataTitle[1]).trim() || null;

  const span = html.match(
    /<span[^>]*data-type="page-header-title"[^>]*>([\s\S]*?)<\/span>/i
  );
  if (span?.[1]) return stripHtml(span[1]).trim() || null;

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return stripHtml(h1[1]).trim() || null;

  return null;
}

function extractBudgetRange(html: string): {
  min: number | null;
  max: number | null;
  currency: "SAR" | "USD" | null;
} {
  const usd = html.match(
    /\$\s*([\d,]+(?:\.\d+)?)\s*-\s*\$\s*([\d,]+(?:\.\d+)?)/i
  );
  if (usd) {
    return {
      min: parseFloat(usd[1]!.replace(/,/g, "")),
      max: parseFloat(usd[2]!.replace(/,/g, "")),
      currency: "USD",
    };
  }
  const suffix = html.match(
    /([\d,]+(?:\.\d+)?)\s*-\s*([\d,]+(?:\.\d+)?)\s*(ر\.س|SAR|ريال|\$)/i
  );
  if (suffix) {
    return {
      min: parseFloat(suffix[1]!.replace(/,/g, "")),
      max: parseFloat(suffix[2]!.replace(/,/g, "")),
      currency: /\$/.test(suffix[3] ?? "") ? "USD" : "SAR",
    };
  }
  return { min: null, max: null, currency: null };
}

/** Return text inside the meta-row whose label contains `labelArabic`. */
function extractMetaRowValue(html: string, labelArabic: string): string | null {
  const re = new RegExp(
    `<div[^>]*class="meta-label"[^>]*>\\s*${labelArabic}\\s*<\\/div>\\s*<div[^>]*class="meta-value"[^>]*>([\\s\\S]*?)<\\/div>`,
    "i"
  );
  const m = html.match(re);
  return m?.[1] ?? null;
}

function extractProjectStatus(html: string): string | null {
  const raw = extractMetaRowValue(html, "حالة المشروع");
  if (!raw) return null;
  const text = stripHtml(raw);
  if (/مفتوح/.test(text)) return "open";
  if (/مغلق|أغلق|مكتمل/.test(text)) return "closed";
  return text || "unknown";
}

function extractPublishedAt(html: string): Date | null {
  const raw = extractMetaRowValue(html, "تاريخ النشر");
  if (!raw) return null;
  const m = raw.match(/datetime="([^"]+)"/i);
  return m ? safeDate(m[1]!) : null;
}

function extractDurationDays(html: string): number | null {
  const raw = extractMetaRowValue(html, "مدة التنفيذ");
  if (!raw) return null;
  const text = stripHtml(raw);
  const days = text.match(/(\d+)\s*يوم/);
  if (days) return parseInt(days[1]!, 10);
  const weeks = text.match(/(\d+)\s*أسبوع/);
  if (weeks) return parseInt(weeks[1]!, 10) * 7;
  const months = text.match(/(\d+)\s*شهر/);
  if (months) return parseInt(months[1]!, 10) * 30;
  return null;
}

function extractSkills(html: string): string[] {
  const out = new Set<string>();

  for (const ulMatch of html.matchAll(
    /<ul[^>]*class="[^"]*\bskills\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi
  )) {
    const ulHtml = ulMatch[1] ?? "";
    for (const a of ulHtml.matchAll(
      /<a[^>]*class="[^"]*\btag\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
    )) {
      const inner = a[1] ?? "";
      const bdi = inner.match(/<bdi[^>]*>([\s\S]*?)<\/bdi>/i);
      const text = stripHtml(bdi?.[1] ?? inner);
      if (text && text.length <= 80) out.add(text);
    }
  }

  if (out.size === 0) {
    for (const a of html.matchAll(
      /<a[^>]*href="https:\/\/mostaql\.com\/projects\/skill\/[^"]+"[^>]*>([\s\S]*?)<\/a>/gi
    )) {
      const inner = a[1] ?? "";
      const bdi = inner.match(/<bdi[^>]*>([\s\S]*?)<\/bdi>/i);
      const text = stripHtml(bdi?.[1] ?? inner);
      if (text && text.length <= 80) out.add(text);
    }
  }

  return [...out];
}

function extractCategoryFromBreadcrumb(html: string): {
  category: string | null;
  subcategory: string | null;
} {
  const ol = html.match(/<ol[^>]*class="breadcrumb[^"]*"[^>]*>([\s\S]*?)<\/ol>/i);
  if (!ol) return { category: null, subcategory: null };
  const items = [...ol[1]!.matchAll(/<li[^>]*data-index="(\d+)"[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((x) => ({ idx: parseInt(x[1]!, 10), text: stripHtml(x[2] ?? "") }))
    .filter((x) => x.text);
  const cat = items.find((x) => x.idx === 2)?.text ?? null;
  const sub = items.find((x) => x.idx === 3)?.text ?? null;
  return { category: cat, subcategory: sub };
}

function extractClient(html: string): { name: string | null; url: string | null } {
  const panel =
    html.match(
      /<div[^>]*data-type="employer_widget"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i
    )?.[1] ?? html;
  const profile = panel.match(
    /<h5[^>]*class="[^"]*profile__name[^"]*"[^>]*>[\s\S]*?<bdi>([\s\S]*?)<\/bdi>/i
  );
  const name = profile ? stripHtml(profile[1] ?? "") || null : null;

  const linkMatch = panel.match(
    /<a[^>]*href="(https:\/\/mostaql\.com\/u\/[^"]+|https:\/\/mostaql\.com\/freelancers\/[^"]+)"/i
  );
  return { name, url: linkMatch?.[1] ?? null };
}

function extractDescription(html: string): string | null {
  const carda = html.match(
    /<div[^>]*id="projectDetailsTab"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i
  );
  const region =
    carda?.[1] ??
    html.match(
      /<div[^>]*class="[^"]*text-wrapper-div[^"]*carda__content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    )?.[1] ??
    null;
  if (!region) return null;
  return htmlToText(region, 8000) || null;
}

function extractOffersCountFromBidsPanel(html: string): number | null {
  const panel = html.match(
    /<div[^>]*id="bidsCollection-panel"[^>]*>([\s\S]*?)<div[^>]*id="bidsLoad/i
  )?.[1];
  const region =
    panel ??
    html.match(/id="bidsCollection-panel"[^>]*>([\s\S]*)/i)?.[1] ??
    null;
  if (!region) return null;
  const matches = region.match(/<div[^>]*class="bid\s+list-group-item/gi);
  return matches ? matches.length : null;
}

export function extractProjectDetails(
  html: string,
  url: string
): MostaqlScrapedProject {
  const { min, max, currency } = extractBudgetRange(html);
  const { category, subcategory } = extractCategoryFromBreadcrumb(html);
  const client = extractClient(html);
  return {
    url,
    mostaqlId: parseMostaqlIdFromUrl(url),
    title: extractTitle(html),
    category,
    subcategory,
    budgetMin: min,
    budgetMax: max,
    currency,
    description: extractDescription(html),
    skillsTags: extractSkills(html),
    clientName: client.name,
    clientUrl: client.url,
    offersCount: extractOffersCountFromBidsPanel(html),
    projectStatus: extractProjectStatus(html),
    publishedAt: extractPublishedAt(html),
    durationDays: extractDurationDays(html),
  };
}

/* -------------------------------------------------------------------------- */
/* Crawl orchestrator                                                          */
/* -------------------------------------------------------------------------- */

const HARD_PAGE_CEILING = 200;

export async function fetchListingPage(
  category: MostaqlCategorySlug,
  page: number,
  signal?: AbortSignal
): Promise<{ items: ListingItem[]; hasNext: boolean }> {
  const url = buildListingUrl(category, page);
  const html = await fetchHtml(url, signal);
  const items = extractListingItems(html);
  const hasNext = detectHasNextPage(html, page);
  return { items, hasNext };
}

/**
 * Walks listing pages for each category, then visits every project page
 * to extract details. Sequential by design (avoids rate-limit).
 */
export async function crawlMostaql(opts: CrawlOptions): Promise<CrawlResult> {
  const {
    pages,
    categories,
    maxProjects = 1500,
    skipMostaqlIds,
    skipUrls,
    onProgress,
    detailRetryCount = 3,
    detailRetryBaseDelayMs = 30_000,
    abortAfterConsecutiveFailures = 3,
  } = opts;
  const limit = pages === "all" ? HARD_PAGE_CEILING : Math.max(1, pages);

  const collected = new Map<string, ListingItem>();
  let pagesFetched = 0;

  for (const cat of categories) {
    let page = 1;
    while (page <= limit) {
      onProgress?.({ phase: "list", category: cat, page });
      let result: { items: ListingItem[]; hasNext: boolean };
      try {
        result = await fetchListingPage(cat, page);
      } catch {
        break;
      }
      pagesFetched += 1;
      for (const item of result.items) {
        if (!collected.has(item.url)) collected.set(item.url, item);
      }
      if (!result.hasNext) break;
      page += 1;
      await jitterDelay();
    }
  }

  const collectedItems = [...collected.values()];
  const projectsFound = collectedItems.length;
  let projectsSkippedDuplicate = 0;
  const allItems = collectedItems
    .filter((item) => {
      const dup =
        (item.mostaqlId && skipMostaqlIds?.has(item.mostaqlId)) ||
        skipUrls?.has(item.url);
      if (dup) projectsSkippedDuplicate += 1;
      return !dup;
    })
    .slice(0, maxProjects);
  const projects: MostaqlScrapedProject[] = [];
  let projectsFailedDetail = 0;
  let consecutiveFailures = 0;
  let abortedByRateLimit = false;

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i]!;
    onProgress?.({
      phase: "detail",
      pagesFetched,
      projectsFound: allItems.length,
      projectsScraped: i,
      currentUrl: item.url,
    });

    let detail: MostaqlScrapedProject | null = null;
    let lastErr: unknown = null;

    for (let attempt = 0; attempt <= detailRetryCount; attempt++) {
      try {
        const html = await fetchHtml(item.url, undefined, { isProjectPage: true });
        detail = extractProjectDetails(html, item.url);
        break;
      } catch (err) {
        lastErr = err;
        if (err instanceof MostaqlRateLimitError && attempt < detailRetryCount) {
          // exponential back-off: 30s → 60s → 120s …
          const delay = detailRetryBaseDelayMs * Math.pow(2, attempt);
          console.warn(
            `[mostaql] rate-limited on ${item.url} (attempt ${attempt + 1}/${detailRetryCount + 1}); sleeping ${Math.round(delay / 1000)}s`
          );
          await sleep(delay);
          continue;
        }
        // either: not a rate-limit (just a real failure) or retries exhausted
        break;
      }
    }

    if (detail) {
      const merged: MostaqlScrapedProject = {
        ...detail,
        title: detail.title ?? item.title,
        clientName: detail.clientName ?? item.clientName,
        publishedAt: detail.publishedAt ?? item.publishedAt,
        offersCount: detail.offersCount ?? item.offersCount,
        description: detail.description ?? item.brief,
      };
      projects.push(merged);
      consecutiveFailures = 0;
    } else {
      projectsFailedDetail += 1;
      const wasRateLimit = lastErr instanceof MostaqlRateLimitError;
      console.warn(
        `[mostaql] giving up on ${item.url}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`
      );
      if (wasRateLimit) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= abortAfterConsecutiveFailures) {
          console.warn(
            `[mostaql] aborting crawl after ${consecutiveFailures} consecutive rate-limit failures`
          );
          abortedByRateLimit = true;
          break;
        }
      } else {
        consecutiveFailures = 0;
      }
    }

    await jitterDelay();
  }

  onProgress?.({
    phase: "done",
    pagesFetched,
    projectsFound,
    projectsScraped: projects.length,
  });

  return {
    projects,
    pagesFetched,
    projectsFound,
    projectsSkippedDuplicate,
    projectsFailedDetail,
    abortedByRateLimit,
  };
}
