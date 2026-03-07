import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "ar,en;q=0.9",
      },
    });
    const html = await res.text();

    // Title: <h1 class="project-title">...</h1>
    const titleMatch = html.match(
      /<h1[^>]*class="[^"]*project-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/
    );
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    // Budget: look for budget range in the page
    const budgetMatch = html.match(
      /(\d[\d,]*)\s*-\s*(\d[\d,]*)\s*(ر\.س|SAR|\$)/
    );
    const budgetMin = budgetMatch
      ? parseFloat(budgetMatch[1].replace(/,/g, ""))
      : null;
    const budgetMax = budgetMatch
      ? parseFloat(budgetMatch[2].replace(/,/g, ""))
      : null;

    // Category
    const categoryMatch = html.match(
      /class="[^"]*project-category[^"]*"[^>]*>([\s\S]*?)<\//
    );
    const category = categoryMatch
      ? categoryMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    // Description
    const descMatch = html.match(
      /class="[^"]*project-description[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    const description = descMatch
      ? descMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 500)
      : "";

    return NextResponse.json({
      title,
      budgetMin,
      budgetMax,
      category,
      description,
    });
  } catch {
    return NextResponse.json(
      { error: "فشل في جلب البيانات" },
      { status: 500 }
    );
  }
}
