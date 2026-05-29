import { apiFetch } from "./api";
import type { Entity, Relation, SwarmSession, ValidationResult } from "../types";

export async function generateWordReport({
  modelName,
  entities,
  relations,
  swarmSessions,
  validationResults,
  includeValidation,
}: {
  modelName: string;
  entities: Entity[];
  relations: Relation[];
  swarmSessions: SwarmSession[];
  validationResults: ValidationResult[];
  includeValidation: boolean;
}): Promise<string> {
  const entityList = entities
    .map(
      (e) => `${e.name} [${e.metaclass}]: ${e.attributes.map((a) => `${a.name}(${a.type})`).join(", ")}`
    )
    .join("\n");

  const relationList = relations
    .map((r) => {
      const f = entities.find((x) => x.id === r.from);
      const t = entities.find((x) => x.id === r.to);
      return `${f?.name} --[${r.label}, ${r.card}]--> ${t?.name}`;
    })
    .join("\n");

  const swarmContext = swarmSessions
    .map((s, si) => {
      const rounds = (s.rounds || [])
        .map((r) => `[${r.persona?.short || "?"}] (${r.type}): ${r.text}`)
        .join("\n");
      return `Session ${si + 1}: "${s.topic}"\n${rounds}\nConsensus: ${s.consensus?.text || "—"}`;
    })
    .join("\n\n---\n\n");

  const validationContext =
    includeValidation && validationResults.length > 0
      ? validationResults
          .map(
            (v) =>
              `Platform: ${v.platformName}\nScore: ${v.result?.fit_score}/100\nVerdict: ${v.result?.executive_summary}\nRisks: ${(v.result?.risks || []).map((r) => `${r.severity.toUpperCase()}: ${r.issue}`).join("; ")}`
          )
          .join("\n\n")
      : "";

  const systemPrompt = `You are a senior enterprise architect writing an executive briefing document. Write in concise, decision-maker prose. No bullet-point overload — use short paragraphs. Aim for something a CTO or CDO would read in 5 minutes and understand the model, the decisions made, the trade-offs accepted, and the recommended next steps.`;

  const userMsg = `Write an executive model briefing for the following enterprise data model.

MODEL: ${modelName}
Entities and relations:
${entityList}
${relationList}

AGENT SWARM SESSIONS (modeling debates):
${swarmContext || "No swarm sessions recorded."}

${validationContext ? `PLATFORM VALIDATION RESULTS:\n${validationContext}` : ""}

Structure the document as follows:
1. EXECUTIVE SUMMARY (3-4 sentences: what is this model, why it exists, key architectural decisions)
2. MODEL OVERVIEW (brief description of the main entities and their purpose)
3. KEY DECISIONS & TRADE-OFFS (what was debated, what was decided, what was consciously traded off)
4. DISSENTING VIEWS (unresolved disagreements worth flagging to decision makers)
5. RISKS & RECOMMENDATIONS (top 3-5 risks with mitigations)
${includeValidation && validationContext ? "6. PLATFORM FIT SUMMARY (brief summary of platform evaluation results)" : ""}
${includeValidation && validationContext ? "7." : "6."} NEXT STEPS (concrete next steps for the team)

Write in plain professional prose. Be concise. Each section max 150 words.`;

  const data = await apiFetch(
    { max_tokens: 4000, system: systemPrompt, messages: [{ role: "user", content: userMsg }] },
    "assistant",
    "Generating executive briefing"
  );
  const text = data.content?.find((b: any) => b.type === "text")?.text;
  if (!text) throw new Error("No content returned from API.");
  return text;
}

/** Download content as an HTML file. Avoids popup-blocker issues with window.open. */
export function downloadReportHtml(modelName: string, content: string): void {
  const html = reportToHtml(modelName, content);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${modelName.replace(/[\s/\\:*?"<>|]+/g, "-")}-briefing.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function reportToHtml(modelName: string, content: string): string {
  const sections = content.split(/\n(?=\d+\. [A-Z])/);
  const body = sections
    .map((s) => {
      const headMatch = s.match(/^(\d+\. [A-Z &]+)\n([\s\S]*)/);
      if (headMatch) {
        return `<h2>${headMatch[1]}</h2><p>${headMatch[2].trim().replace(/\n\n/g, "</p><p>").replace(/\n/g, " ")}</p>`;
      }
      return `<p>${s.trim().replace(/\n\n/g, "</p><p>").replace(/\n/g, " ")}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${modelName} — Enterprise Model Briefing</title>
<style>
  @page { margin: 2.5cm; }
  body { font-family: Calibri, "Segoe UI", sans-serif; font-size: 11pt; color: #1a1a2e; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
  h1 { font-size: 20pt; color: #0c1445; border-bottom: 2px solid #4f8ef7; padding-bottom: 8px; margin-bottom: 4px; }
  .meta { font-size: 9pt; color: #888; margin-bottom: 32px; }
  h2 { font-size: 12pt; color: #0c1445; margin-top: 24px; margin-bottom: 6px; border-left: 3px solid #4f8ef7; padding-left: 10px; }
  p { margin: 0 0 10px; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>${modelName}<br><span style="font-size:13pt;font-weight:normal;color:#4f8ef7">Enterprise Model Briefing</span></h1>
<div class="meta">Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} &nbsp;·&nbsp; Ontology Workbench</div>
${body}
</body></html>`;
}
