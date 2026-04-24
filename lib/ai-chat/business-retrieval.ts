import { shouldSkipRetrieval } from "@/lib/ai-chat/intent-skip";
import { buildMostaqlDatasetSection, searchMostaqlProjectsFullColumns } from "@/lib/ai-chat/mostaql-full-context";
import {
  cleanLikeToken,
  executeAiChatTool,
  getProjectStatusCounts,
  getProposalStatusCounts,
  getSettingsSnapshot,
  listProposalsByOutcomeStatus,
  recentInvoices,
  searchClients,
  searchProjects,
  searchProposals,
  searchTasks,
  type ProposalOutcomeStatus,
  type WhitelistedToolName,
} from "@/lib/ai-chat/retrieval-tools";
import { retrieveUnstructuredSnippets } from "@/lib/ai-chat/vector-context";

function maxContextChars(): number {
  const n = Number(process.env.AI_CHAT_CONTEXT_MAX_CHARS ?? "72000");
  return Number.isFinite(n) && n >= 12000 ? Math.min(n, 250000) : 72000;
}

const BROAD =
  /overview|summary|dashboard|snapshot|organization|agency|كل شيء|نظرة|ملخص|لوحة|إحصائ|احصائ|الوضع|ماذا لدينا|what do we have|how many|كم عدد/i;

function extractKeywords(text: string): string[] {
  const parts = text
    .trim()
    .split(/[\s,.;:!?،؛؟()\[\]{}'"«»\-_/\\]+/u)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.slice(0, 64);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= 10) break;
  }
  return out;
}

function isBroadOverview(message: string): boolean {
  return BROAD.test(message);
}

/** Detect which job-proposal outcome the user is asking about (table `proposals`, not Mostaql scrape rows). */
function proposalOutcomeFocus(message: string): ProposalOutcomeStatus | null {
  const m = message.toLowerCase();
  if (/\blost\b|خاسر|خسارة|مرفوض|فشل/i.test(message)) return "lost";
  if (/\bwon\b|فاز|مقبول|رابح/i.test(message)) return "won";
  if (/shortlist|مرشح|قائمة مختصرة/i.test(message)) return "shortlisted";
  if (/\bviewed\b|مشاهد|تمت مشاهدته/i.test(message)) return "viewed";
  if (/\bcancelled\b|ملغي|إلغاء/i.test(message)) return "cancelled";
  if (/\bapplied\b|تقديم|مقدم\b/i.test(m)) return "applied";
  return null;
}

type ToolIntent = { name: WhitelistedToolName; args?: unknown };

function planToolIntents(message: string): ToolIntent[] {
  const intents: ToolIntent[] = [];
  if (/invoice|فاتور|invoices|الفواتير/i.test(message)) {
    intents.push({ name: "recent_invoices", args: {} });
  }
  if (/active project|نشط|المشاريع النشطة|مشاريع نشطة|ongoing project/i.test(message)) {
    intents.push({ name: "list_projects", args: { status: "active" } });
  }
  if (/search client|find client|عميل|العملاء|client named|company named/i.test(message)) {
    const kw = extractKeywords(message).find((k) => cleanLikeToken(k));
    if (kw) intents.push({ name: "list_clients", args: { query: kw } });
  }
  return intents.slice(0, 3);
}

function truncate(s: string): string {
  const cap = maxContextChars();
  if (s.length <= cap) return s;
  return `${s.slice(0, cap)}\n\n…[context truncated at ${cap} chars; raise AI_CHAT_CONTEXT_MAX_CHARS]`;
}

/**
 * Builds Markdown context for the model from the latest user message (admin DB read-only).
 */
export async function buildBusinessContext(lastUserText: string): Promise<string> {
  if (shouldSkipRetrieval(lastUserText)) return "";

  const sections: string[] = [];
  const keywords = extractKeywords(lastUserText);
  const likeTokens = keywords.map((k) => cleanLikeToken(k)).filter((x): x is string => Boolean(x));

  if (process.env.AI_CHAT_MOSTAQL_FULL_EXPORT !== "false") {
    let mostaqlExport = "";
    try {
      mostaqlExport = await buildMostaqlDatasetSection();
    } catch (e) {
      mostaqlExport = `## Mostaql scrape export (error)\n${e instanceof Error ? e.message : "failed"}`;
    }
    if (mostaqlExport) sections.push(mostaqlExport);
  }

  const [settingsRow, statusCounts, proposalStatusCounts] = await Promise.all([
    getSettingsSnapshot(),
    getProjectStatusCounts(),
    getProposalStatusCounts(),
  ]);

  sections.push("## Agency snapshot");
  if (settingsRow) {
    sections.push(
      `- Agency: ${settingsRow.agencyName ?? "(unset)"} | email: ${settingsRow.agencyEmail ?? "-"} | site: ${settingsRow.agencyWebsite ?? "-"} | default currency: ${settingsRow.defaultCurrency ?? "-"}`
    );
  } else {
    sections.push("- Settings row not found.");
  }
  sections.push(
    `- Project counts by status: ${statusCounts.map((r) => `${r.status}=${r.total}`).join(", ") || "none"}`
  );
  const proposalLine =
    proposalStatusCounts.length > 0
      ? proposalStatusCounts.map((r) => `${r.status}=${r.total}`).join(", ")
      : "no proposal rows";
  sections.push(
    `- **Job proposal counts by status** (rows in \`proposals\`: Mostaql-style bids; enum includes applied, viewed, shortlisted, won, lost, cancelled): ${proposalLine}`
  );

  const outcome = proposalOutcomeFocus(lastUserText);
  if (outcome) {
    const sample = await listProposalsByOutcomeStatus(outcome, 20);
    sections.push(`## Sample proposals (status=${outcome}, up to 20 by most recent applied date)`);
    sections.push(
      sample.length
        ? sample
            .map(
              (r) =>
                `- ${r.id} | ${r.title} | status=${r.status} | ${r.platform} | applied ${r.appliedAt}${r.myBid != null ? ` | bid ${r.myBid}` : ""}${r.url ? ` | ${r.url}` : ""}`
            )
            .join("\n")
        : "- (no rows for this status — total for this status is still in the counts line above)"
    );
  }

  const intents = planToolIntents(lastUserText);
  for (const it of intents) {
    try {
      const json = await executeAiChatTool(it.name, it.args ?? {});
      sections.push(`## Tool: ${it.name}\n\`\`\`json\n${json}\n\`\`\``);
    } catch (e) {
      sections.push(`## Tool: ${it.name} (error)\n${e instanceof Error ? e.message : "failed"}`);
    }
  }

  if (isBroadOverview(lastUserText) || /invoice|فاتور/i.test(lastUserText)) {
    const inv = await recentInvoices(8);
    sections.push("## Recent invoices");
    sections.push(
      inv.length
        ? inv
            .map(
              (r) =>
                `- ${r.invoiceNumber} | ${r.status} | ${r.total} ${r.currency} | ${r.issueDate} | client: ${r.clientName}`
            )
            .join("\n")
        : "- (none)"
    );
  }

  if (likeTokens.length) {
    sections.push("## Keyword matches (structured)");

    const seen = new Set<string>();
    for (const token of likeTokens.slice(0, 5)) {
      const [cRows, pRows, tRows, prRows, mqRows] = await Promise.all([
        searchClients(token, 8),
        searchProjects(token, 8),
        searchTasks(token, 8),
        searchProposals(token, 6),
        searchMostaqlProjectsFullColumns(token, 10),
      ]);

      const block = [
        `### token "${token}"`,
        cRows.length ? `Clients:\n${cRows.map((r) => `- ${r.id} | ${r.companyName} (${r.status})`).join("\n")}` : "",
        pRows.length ? `Projects:\n${pRows.map((r) => `- ${r.id} | ${r.name} (${r.status}) | client: ${r.clientName}`).join("\n")}` : "",
        tRows.length
          ? `Tasks:\n${tRows.map((r) => `- ${r.id} | ${r.title} (${r.status}) | project: ${r.projectName}`).join("\n")}`
          : "",
        prRows.length
          ? `Proposals:\n${prRows.map((r) => `- ${r.id} | ${r.title} (${r.status}, ${r.platform})`).join("\n")}`
          : "",
        mqRows.length
          ? `Mostaql scraped projects (full columns, JSON per row):\n${mqRows
              .map((r) => {
                const row = {
                  id: r.id,
                  run_id: r.runId,
                  mostaql_id: r.mostaqlId,
                  url: r.url,
                  title: r.title,
                  category: r.category,
                  subcategory: r.subcategory,
                  budget_min: r.budgetMin != null ? String(r.budgetMin) : null,
                  budget_max: r.budgetMax != null ? String(r.budgetMax) : null,
                  currency: r.currency,
                  description: r.description,
                  skills_tags: r.skillsTags,
                  client_name: r.clientName,
                  client_url: r.clientUrl,
                  offers_count: r.offersCount,
                  project_status: r.projectStatus,
                  published_at:
                    r.publishedAt instanceof Date ? r.publishedAt.toISOString() : r.publishedAt,
                  duration_days: r.durationDays,
                  scraped_at: r.scrapedAt instanceof Date ? r.scrapedAt.toISOString() : r.scrapedAt,
                };
                return `- ${JSON.stringify(row)}`;
              })
              .join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      if (block.length > 20 && !seen.has(block)) {
        seen.add(block);
        sections.push(block);
      }
    }
  }

  const snippets = await retrieveUnstructuredSnippets(likeTokens.length ? likeTokens : keywords, 3);
  if (snippets.length) {
    sections.push("## Long text snippets (keyword match, not semantic search)");
    sections.push(snippets.join("\n"));
  }

  const body = sections.join("\n\n");
  return truncate(`The following is read-only data from the agency database for this question. It may be incomplete.\n\n${body}`);
}
