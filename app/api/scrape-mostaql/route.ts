import { NextRequest, NextResponse } from "next/server";

/** Optional session cookie so Mostaql returns HTML that includes your bid amount (see .env.example). */
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

function isNoiseSkillLabel(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 72) return true;
  if (/^[\d.,\s]+$/.test(t)) return true;
  return /^(المهارات|خيارات|مستقل|تبليغ|عن محتوى)$/i.test(t);
}

/** Skill / tag labels posted by the client on the project page. */
function extractProjectSkills(html: string): string[] {
  const seen = new Set<string>();
  const add = (raw: string) => {
    const s = stripHtml(raw).replace(/\s+/g, " ").trim();
    if (!s || isNoiseSkillLabel(s)) return;
    seen.add(s);
  };

  for (const m of html.matchAll(
    /<a[^>]*class="[^"]*(?:skill|tag|label|badge)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  )) {
    add(m[1] ?? "");
  }

  const headingIdx = html.search(/المهارات/i);
  if (headingIdx !== -1) {
    const slice = html.slice(headingIdx, headingIdx + 12000);
    const ulMatch = slice.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
    if (ulMatch) {
      for (const m of ulMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
        add(m[1] ?? "");
      }
    }
  }

  return [...seen].slice(0, 60);
}

/** Budget row uses e.g. `<span dir="rtl">$2500.00 - $5000.00</span>` (prefix $), not `2500 - 5000 $`. */
function extractBudgetRange(html: string): {
  min: number | null;
  max: number | null;
  currency: "SAR" | "USD";
} {
  const usdBothSides = html.match(
    /\$\s*([\d,]+(?:\.\d+)?)\s*-\s*\$\s*([\d,]+(?:\.\d+)?)/i
  );
  if (usdBothSides) {
    return {
      min: parseFloat(usdBothSides[1]!.replace(/,/g, "")),
      max: parseFloat(usdBothSides[2]!.replace(/,/g, "")),
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

  return { min: null, max: null, currency: "SAR" };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Current Mostaql uses `heada__title`, not `project-title`. */
function extractProjectTitle(html: string): string {
  const dataTitle = html.match(
    /<h1[^>]*class="[^"]*heada__title[^"]*"[^>]*data-page-title="([^"]+)"/i
  );
  if (dataTitle?.[1]) {
    return stripHtml(dataTitle[1]).trim();
  }

  const spanTitle = html.match(
    /<span[^>]*data-type="page-header-title"[^>]*>([\s\S]*?)<\/span>/i
  );
  if (spanTitle?.[1]) {
    return stripHtml(spanTitle[1]).trim();
  }

  const legacy = html.match(
    /<h1[^>]*class="[^"]*project-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i
  );
  if (legacy?.[1]) {
    return stripHtml(legacy[1]).trim();
  }

  const anyH1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (anyH1?.[1]) {
    return stripHtml(anyH1[1]).trim();
  }

  const og = html.match(/property="og:title"\s+content="([^"]+)"/i);
  if (og?.[1]) {
    return stripHtml(og[1].replace(/\s*\|\s*مستقل\s*$/i, "")).trim();
  }

  return "";
}

/** One bid block in the offers list (`data-bid-item` / `id="bid…"`). */
function extractBidCardHtml(html: string, bidId: string): string | null {
  const idDouble = `id="bid${bidId}"`;
  const idSingle = `id='bid${bidId}'`;
  let anchor = html.indexOf(idDouble);
  if (anchor === -1) anchor = html.indexOf(idSingle);
  if (anchor === -1) {
    const escaped = bidId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const dm = html.match(new RegExp(`data-bid-item="${escaped}"`, "i"));
    if (dm?.index == null) return null;
    anchor = dm.index;
  }

  const cardOpen = html.lastIndexOf('<div class="bid list-group-item', anchor);
  if (cardOpen === -1) return null;

  const tail = html.slice(cardOpen);
  const re = /<div\s+class="bid\s+list-group-item\b/gi;
  re.exec(tail);
  const next = re.exec(tail);
  const cardEnd = next ? cardOpen + next.index : html.length;
  return html.slice(cardOpen, cardEnd);
}

function parseOfferAmountFromPlainText(text: string): number | null {
  const patterns: RegExp[] = [
    /بمبلغ\s*([\d,]+(?:\.\d+)?)/i,
    /(?:^|[\s،.])([\d,]+(?:\.\d+)?)\s*(?:ر\.س|ريال|SAR)\b/i,
    /أقترح\s*(?:مبلغ\s*)?([\d,]+(?:\.\d+)?)/i,
    /قيمة\s*(?:العرض|عرضي)\s*[:\s]*([\d,]+(?:\.\d+)?)/i,
    /(?:سعر|تكلفة)\s*(?:العرض)?\s*[:\s]*([\d,]+(?:\.\d+)?)/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(?:دولار|USD)\b/i,
    /(?:offer|bid|price)\s*[:]\s*([\d,]+(?:\.\d+)?)/i,
    /\$\s*([\d,]+(?:\.\d+)?)(?!\s*-\s*\$)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const g = m?.[1];
    if (g) {
      const n = parseFloat(g.replace(/,/g, ""));
      if (!Number.isNaN(n) && n >= 1 && n < 1e9) return n;
    }
  }
  return null;
}

/** Logged-in / extended markup may include a labeled price row in the bid card. */
function extractLabeledBidPriceFromCard(cardHtml: string): number | null {
  const tries = [
    cardHtml.match(
      /(?:قيمة العرض|مبلغ العرض|العرض بمبلغ|السعر المقترح)[\s\S]{0,220}?([\d,]+(?:\.\d+)?)\s*(?:ر\.س|ريال|SAR)/i
    ),
    cardHtml.match(
      /(?:قيمة العرض|Offer amount|Bid amount)[\s\S]{0,220}?\$\s*([\d,]+(?:\.\d+)?)/i
    ),
    cardHtml.match(
      /<div[^>]*class="[^"]*meta-value[^"]*"[^>]*>[\s\S]*?([\d,]+(?:\.\d+)?)\s*(?:ر\.س|ريال|SAR)/i
    ),
  ];
  for (const m of tries) {
    if (m?.[1]) {
      const n = parseFloat(m[1].replace(/,/g, ""));
      if (!Number.isNaN(n) && n >= 1 && n < 1e9) return n;
    }
  }
  return null;
}

function parseOfferAmountFromCardFragment(cardHtml: string): number | null {
  if (/\$\s*[\d,]+(?:\.\d+)?\s*-\s*\$\s*[\d,]+/i.test(cardHtml)) {
    // ignore project-style range inside card
  }
  const sar = cardHtml.match(
    /(?:^|[^\d.])([\d,]+(?:\.\d+)?)\s*(?:ر\.س|ريال|SAR)(?!\s*-\s*[\d,])/i
  );
  if (sar) return parseFloat(sar[1]!.replace(/,/g, ""));
  if (!/\$\s*[\d,]+(?:\.\d+)?\s*-\s*\$/i.test(cardHtml)) {
    const usd = cardHtml.match(/\$\s*([\d,]+(?:\.\d+)?)(?!\s*-\s*\$)/);
    if (usd) return parseFloat(usd[1]!.replace(/,/g, ""));
  }
  return null;
}

function extractFreelancerNameFromBidCard(cardHtml: string): string | null {
  const bdi = cardHtml.match(
    /<h5[^>]*class="[^"]*profile__name[^"]*"[^>]*>[\s\S]*?<bdi>([\s\S]*?)<\/bdi>/i
  );
  if (bdi?.[1]) {
    const name = stripHtml(bdi[1]).trim();
    return name.length > 0 && name.length <= 80 ? name : null;
  }
  return null;
}

/**
 * When the URL includes ?bid=ID (offer permalink), extract that offer's text,
 * optional proposed amount, and freelancer display name from Mostaql HTML.
 */
function extractOfferByBidId(html: string, bidId: string): {
  offerText: string;
  offerAmount: number | null;
  freelancerName: string | null;
} | null {
  const card = extractBidCardHtml(html, bidId);

  let section: string;
  let freelancerName: string | null = null;

  if (card) {
    section = card;
    freelancerName = extractFreelancerNameFromBidCard(card);
  } else {
    const escaped = bidId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`[?&]bid=${escaped}(?:&|"|'|\\s|#)`, "i"),
      new RegExp(`[?&]bid%3D${escaped}(?:&|"|'|\\s)`, "i"),
    ];
    let pos = -1;
    for (const p of patterns) {
      const i = html.search(p);
      if (i !== -1) {
        pos = i;
        break;
      }
    }
    if (pos === -1) return null;

    const before = html.slice(Math.max(0, pos - 4500), pos);
    const headings = [...before.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
    if (headings.length > 0) {
      const raw = stripHtml(headings[headings.length - 1]![1] ?? "");
      freelancerName =
        raw.replace(/\s*خيارات.*$/i, "").replace(/تبليغ عن محتوى/g, "").trim() || null;
      if (freelancerName && freelancerName.length > 80) {
        freelancerName = freelancerName.slice(0, 80);
      }
    }

    const after = html.slice(pos, pos + 14000);
    const nextOfferIdx = after.slice(20).search(/\?bid=\d+/);
    section = nextOfferIdx === -1 ? after : after.slice(0, nextOfferIdx + 20 + 400);
  }

  const detailsIdx = section.search(/class="[^"]*bid__details/i);
  const textRegion =
    detailsIdx === -1 ? section : section.slice(detailsIdx, detailsIdx + 12000);

  const paragraphs: string[] = [];
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(textRegion)) !== null) {
    const t = stripHtml(m[1] ?? "").trim();
    if (t.length > 20 && !/^[\d.]+$/.test(t)) paragraphs.push(t);
  }

  let offerText = paragraphs.join("\n\n").trim();
  if (!offerText) {
    offerText = stripHtml(textRegion)
      .replace(/خيارات/g, "")
      .replace(/تبليغ عن محتوى/g, "")
      .trim()
      .slice(0, 12000);
  } else {
    offerText = offerText.slice(0, 12000);
  }

  if (!offerText || offerText.length < 15) return null;

  let offerAmount = parseOfferAmountFromCardFragment(section);
  if (offerAmount == null && card) {
    offerAmount = extractLabeledBidPriceFromCard(card);
  }
  if (offerAmount == null) {
    offerAmount = extractLabeledBidPriceFromCard(section);
  }
  if (offerAmount == null) {
    offerAmount = parseOfferAmountFromPlainText(offerText);
  }

  return { offerText, offerAmount, freelancerName };
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

  let bidId: string | null = null;
  try {
    const u = new URL(url);
    bidId = u.searchParams.get("bid");
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, { headers: mostaqlFetchHeaders() });
    const html = await res.text();

    const title = extractProjectTitle(html);

    const { min: budgetMin, max: budgetMax, currency: budgetCurrency } =
      extractBudgetRange(html);

    const categoryMatch = html.match(
      /class="[^"]*project-category[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const category = categoryMatch ? stripHtml(categoryMatch[1] ?? "") : "";

    const descMatch = html.match(
      /class="[^"]*project-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
    const description = descMatch
      ? stripHtml(descMatch[1] ?? "")
          .trim()
          .slice(0, 8000)
      : "";

    const skillsTags = extractProjectSkills(html);

    const payload: Record<string, unknown> = {
      title,
      budgetMin,
      budgetMax,
      budgetCurrency,
      category,
      description,
      skillsTags,
      bidId,
    };

    if (bidId) {
      const offer = extractOfferByBidId(html, bidId);
      if (offer) {
        payload.offerText = offer.offerText;
        payload.freelancerName = offer.freelancerName;
        let offerAmount = offer.offerAmount;
        let offerAmountIsEstimate = false;
        if (
          offerAmount == null &&
          budgetMin != null &&
          budgetMax != null &&
          !Number.isNaN(budgetMin) &&
          !Number.isNaN(budgetMax)
        ) {
          offerAmount = (budgetMin + budgetMax) / 2;
          offerAmountIsEstimate = true;
        }
        payload.offerAmount = offerAmount;
        payload.offerAmountIsEstimate = offerAmountIsEstimate;
      }
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "فشل في جلب البيانات" },
      { status: 500 }
    );
  }
}
