#!/usr/bin/env node
/**
 * engine/context-pack-pipeline.js — ContextPack pipeline orchestration (group 2).
 * Stages: IntentAnalysis → CandidateGeneration → Normalization →
 *         ConflictResolution → Ranking → BudgetAllocation → Assembly → Rendering
 *
 * Cada stage produce un tipo intermedio. El orchestrator ejecuta en secuencia
 * y pasa el output de cada stage al siguiente.
 *
 * Uso:
 *   import { runPipeline } from './context-pack-pipeline.js';
 *   const pack = await runPipeline({ text: "user request", intent: "..." });
 */

import { createContextPack, estimateTokens, sortByPriority } from "./context-pack.js";

// ── Types (JSDoc) ──

/**
 * @typedef {import("./context-pack.js").ContextPack} ContextPack
 * @typedef {import("./context-pack.js").SelectionEntry} SelectionEntry
 * @typedef {import("./context-pack.js").Topic} Topic
 * @typedef {import("./context-pack.js").Entity} Entity
 * @typedef {import("./context-pack.js").Constraint} Constraint
 * @typedef {import("./context-pack.js").Decision} Decision
 * @typedef {import("./context-pack.js").SpecRef} SpecRef
 * @typedef {import("./context-pack.js").MemoryEntry} MemoryEntry
 * @typedef {import("./context-pack.js").CodeRef} CodeRef
 * @typedef {import("./context-pack.js").Conflict} Conflict
 */

/**
 * Input del pipeline.
 * @typedef {{ text: string; intent?: string }} PipelineInput
 */

/**
 * @typedef {{ intent: string; topics: Topic[]; entities: Entity[] }} IntentOutput
 */

/**
 * Candidate crudo antes de normalización.
 * @typedef {{ source: string; path: string; score: number; match_type: string; snippet?: string; span?: { start: number; end: number }; metadata?: Record<string, any> }} RawCandidate
 */

/**
 * @typedef {{ candidates: RawCandidate[] }} CandidateOutput
 */

/**
 * @typedef {{ items: NormalizedItem[] }} NormalizedOutput
 */

/**
 * @typedef {{ id: string; content: string; source: string; type: "constraint"|"decision"|"spec"|"memory"|"code"; relevance: number; status?: string; path?: string }} NormalizedItem
 */

/**
 * @typedef {{ items: NormalizedItem[]; conflicts: Conflict[] }} ConflictOutput
 */

/**
 * @typedef {{ items: RankedItem[] }} RankedOutput
 */

/**
 * @typedef {{ item: NormalizedItem; score: number; reasons: string[]; strategy: string }} RankedItem
 */

/**
 * @typedef {{ items: RankedItem[]; token_budget: number }} BudgetInput
 */

/**
 * @typedef {{ selected: RankedItem[]; excluded: number; truncated: boolean }} BudgetOutput
 */

// ── Stage Runner ──

/**
 * @template T, U
 * @param {string} name
 * @param {(input: T) => U | Promise<U>} fn
 * @param {T} input
 * @returns {Promise<{ output: U; trace: { stage: string; ok: boolean; error?: string } }>}
 */
async function runStage(name, fn, input) {
  try {
    const output = await fn(input);
    return { output, trace: { stage: name, ok: true } };
  } catch (e) {
    return { output: null, trace: { stage: name, ok: false, error: e.message } };
  }
}

// ── Stages ──

/**
 * 2.2 IntentAnalysis: parse request → extract intent + topics + entities.
 * @param {PipelineInput} input
 * @returns {IntentOutput}
 */
function intentAnalysis(input) {
  const text = input.text;
  const intent = input.intent || text.split(/\s+/).slice(0, 10).join(" ");

  // topics: extract meaningful ngrams (2-3 word phrases, skip stopwords)
  const stopwords = new Set(["de", "el", "la", "en", "y", "a", "que", "del", "los", "las", "un", "una", "para", "por", "con", "se", "no", "es", "lo", "como", "más", "pero", "sus", "le", "ya", "este", "entre", "porque", "todo", "esta", "tipo", "usar", "hace", "find", "the", "and", "of", "in", "to", "is", "for", "on", "with", "at"]);
  const tokens = text.toLowerCase().split(/[^a-z0-9áéíóúñü]+/).filter((t) => t.length >= 3 && !stopwords.has(t));
  const seenTopics = new Set();
  /** @type {Topic[]} */
  const topics = [];
  for (const t of tokens) {
    if (!seenTopics.has(t)) {
      seenTopics.add(t);
      topics.push({ id: t, relevance: 1 / (1 + tokens.filter((x) => x === t).length) });
    }
  }
  topics.sort((a, b) => b.relevance - a.relevance);

  // entities: capitalize words = proper nouns
  /** @type {Entity[]} */
  const entities = [];
  const entitiesSeen = new Set();
  for (const w of text.split(/\s+/)) {
    const clean = w.replace(/[^a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ_-]/g, "");
    if (clean.length >= 3 && /^[A-ZÁÉÍÓÚÑ]/.test(clean) && !stopwords.has(clean.toLowerCase())) {
      if (!entitiesSeen.has(clean)) {
        entitiesSeen.add(clean);
        entities.push({ id: clean, type: "proper_noun", relevance: 0.7 });
      }
    }
  }

  return { intent, topics, entities };
}

/**
 * 2.3 CandidateGeneration: retrieve candidates from sources.
 * Por ahora: stub que retorna candidates desde OpenSpec specs y filesystem.
 * @param {IntentOutput & { cwd?: string; openspecRoot?: string }} input
 * @returns {CandidateOutput}
 */
function candidateGeneration(input) {
  /** @type {RawCandidate[]} */
  const candidates = [];
  return { candidates };
}

/**
 * 2.4 Normalization: unify candidates to NormalizedItem[].
 * @param {CandidateOutput} input
 * @returns {NormalizedOutput}
 */
function normalization(input) {
  /** @type {NormalizedItem[]} */
  const items = input.candidates.map((c) => ({
    id: `${c.source}:${c.path}`,
    content: c.snippet || c.path,
    source: c.path,
    type: inferType(c),
    relevance: c.score,
    path: c.path,
  }));
  return { items };
}

/**
 * Inferir tipo de un candidato raw.
 * @param {RawCandidate} c
 * @returns {NormalizedItem["type"]}
 */
function inferType(c) {
  const path = c.path || "";
  if (c.match_type === "constraint" || /constraint/i.test(path)) return "constraint";
  if (c.match_type === "decision" || /decision/i.test(path)) return "decision";
  if (/spec/i.test(path)) return "spec";
  if (/memory/i.test(path)) return "memory";
  if (/\.(ts|js|py|rs|go|java|kt|swift|c|cpp|h|hpp)$/i.test(path)) return "code";
  return "spec";
}

/**
 * 2.5 ConflictResolution: detect superseded decisions, contradictory constraints.
 * @param {NormalizedOutput} input
 * @returns {ConflictOutput}
 */
function conflictResolution(input) {
  /** @type {Conflict[]} */
  const conflicts = [];
  const decisions = input.items.filter((i) => i.type === "decision");
  const constraints = input.items.filter((i) => i.type === "constraint");

  // Superseded decisions: same source topic, different status
  for (const d of decisions) {
    if (d.status === "superseded") {
      // la decision superseded no debe pasar — se filtra abajo
    }
  }

  return { items: input.items.filter((i) => !(i.type === "decision" && i.status === "superseded")), conflicts };
}

/**
 * 2.6 Ranking: score candidates by relevance.
 * @param {ConflictOutput} input
 * @returns {RankedOutput}
 */
function ranking(input) {
  const ranked = input.items.map((item) => {
    const reasons = [];
    const strategy = inferStrategy(item);

    // Si el item tiene source, incluir razón de source-based
    if (item.source) reasons.push("source_match");

    // Si es decision activa, razón de tipo
    if (item.type === "decision" && item.status !== "superseded") reasons.push("active_decision");

    // Relevance-based reason
    if (item.relevance > 0.5) reasons.push("high_relevance");

    // Fallback reason
    if (reasons.length === 0) reasons.push("candidate");

    return {
      item,
      score: item.relevance,
      reasons,
      strategy,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return { items: ranked };
}

/**
 * Infer strategy from item type or path.
 * @param {NormalizedItem} item
 * @returns {string}
 */
function inferStrategy(item) {
  if (item.type === "spec") return "openspec";
  if (item.type === "code") return "lexical";
  if (item.type === "memory") return "llm";
  return "structural";
}

// ── BudgetAllocation stage (3.x) ──

const PRIORITY_ORDER = ["constraint", "decision", "spec", "code", "memory"];

/**
 * 3.1 BudgetAllocation: select candidates within token budget.
 * @param {BudgetInput} input
 * @returns {BudgetOutput}
 */
function budgetAllocation(input) {
  const budget = input.token_budget || 4000;
  const items = [...input.items];

  // 3.2 priority ordering
  items.sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.item.type);
    const pb = PRIORITY_ORDER.indexOf(b.item.type);
    if (pa !== pb) return pa - pb;
    return b.score - a.score;
  });

  const selected = [];
  let total = 0;
  let excluded = 0;

  for (const item of items) {
    const est = estimateTokens(JSON.stringify(item.item));
    if (total + est <= budget) {
      selected.push(item);
      total += est;
    } else {
      excluded++;
    }
  }

  // 3.3 truncation indicator
  const truncated = excluded > 0;

  return { selected, excluded, truncated };
}

/**
 * 3.4 Progressive disclosure: 3 phases — metadata → selected → full content.
 * Por ahora: metadata = selection trace items, selected = ranked items.
 * @param {RankedItem[]} allItems
 * @param {number} budget
 * @returns {{ metadata: any[]; selected: RankedItem[]; full: RankedItem[] }}
 */
function progressiveDisclosure(allItems, budget) {
  // Phase 1: metadata (all candidates, path + score + type only)
  const metadata = allItems.map((r) => ({
    source: r.item.source,
    score: r.score,
    type: r.item.type,
  }));

  // Phase 2: selected (top-K within budget)
  const budgetResult = budgetAllocation({ items: allItems, token_budget: budget });
  const selected = budgetResult.selected;

  // Phase 3: full content for selected only (los items ya tienen content)
  const full = selected;

  return { metadata, selected, full };
}

// ── Assembly stage (prepara struct para createContextPack) ──

/**
 * Assembly: build ContextPack from ranked items + trace.
 * @param {RankedOutput & { input: PipelineInput; stageTraces: Array<{ stage: string; ok: boolean; error?: string }> }} input
 * @returns {ContextPack}
 */
function assembly(input) {
  const decisions = [];
  /** @type {Constraint[]} */
  const constraints = [];
  /** @type {CodeRef[]} */
  const codeContext = [];
  /** @type {SpecRef[]} */
  const specifications = [];
  /** @type {MemoryEntry[]} */
  const memories = [];
  /** @type {SelectionEntry[]} */
  const selectionTrace = [];

  for (const ranked of input.items) {
    const item = ranked.item;
    const trace = {
      source: item.source,
      score: ranked.score,
      reasons: ranked.reasons,
      strategy: ranked.strategy,
    };
    selectionTrace.push(trace);

    switch (item.type) {
      case "constraint":
        constraints.push({ id: item.id, content: item.content, priority: Math.round(item.relevance * 10), source: item.source });
        break;
      case "decision":
        decisions.push({ id: item.id, content: item.content, status: "active", source: item.source });
        break;
      case "spec":
        specifications.push({ path: item.path || item.source, sections: [item.content], relevance: item.relevance });
        break;
      case "memory":
        memories.push({ id: item.id, type: "fact", content: item.content, relevance: item.relevance, source: item.source });
        break;
      case "code":
        codeContext.push({ path: item.path || item.source, reason: ranked.reasons.join(", "), relevance: item.relevance });
        break;
    }
  }

  // Validate scores have at least one reason (spec 5.3)
  for (const t of selectionTrace) {
    if (t.reasons.length === 0) {
      console.warn(`selection_trace: score without reason for source "${t.source}" — excluded`);
    }
  }
  const validTrace = selectionTrace.filter((t) => t.reasons.length > 0);

  // Mapeo a snake_case (createContextPack espera esos nombres)
  return createContextPack({
    text: input.input.text,
    intent: input.input.intent || "",
    constraints,
    decisions,
    specifications,
    memories,
    code_context: codeContext,
    selection_trace: validTrace,
    retrieval_strategy: input.stageTraces.every((t) => t.ok) ? "tier-0" : "tier-0",
  });
}

// ── Rendering stage ──

/**
 * 4.1 Default rendering template.
 * @param {ContextPack} pack
 * @param {string} [customTemplate]
 * @returns {string}
 */
export function renderContext(pack, customTemplate) {
  if (customTemplate) {
    return applyTemplate(customTemplate, pack);
  }
  return renderDefault(pack);
}

function renderDefault(pack) {
  const lines = ["<project-context>", ""];

  lines.push("## Intent");
  lines.push(pack.request.intent || pack.request.text);
  lines.push("");

  if (pack.constraints.length) {
    lines.push("## Active constraints");
    for (const c of pack.constraints) {
      lines.push(`- ${c.content} (source: ${c.source})`);
    }
    lines.push("");
  }

  if (pack.decisions.length) {
    lines.push("## Relevant decisions");
    for (const d of pack.decisions) {
      lines.push(`- ${d.content} (source: ${d.source})`);
    }
    lines.push("");
  }

  if (pack.specifications.length) {
    lines.push("## Relevant specifications");
    for (const s of pack.specifications) {
      lines.push(`- ${s.path}: ${s.sections.join(", ")}`);
    }
    lines.push("");
  }

  if (pack.memories.length) {
    lines.push("## Relevant project knowledge");
    for (const m of pack.memories) {
      lines.push(`- ${m.content} (source: ${m.source})`);
    }
    lines.push("");
  }

  if (pack.code_context.length) {
    lines.push("## Relevant code");
    for (const c of pack.code_context) {
      lines.push(`- ${c.path}: ${c.reason}`);
    }
    lines.push("");
  }

  lines.push("</project-context>");
  return lines.join("\n");
}

function applyTemplate(template, pack) {
  const fieldMap = {
    intent: () => pack.request.intent || pack.request.text,
    "constraints as bullet list with source": () =>
      pack.constraints.map((c) => `- ${c.content} (source: ${c.source})`).join("\n"),
    "active decisions as bullet list with source": () =>
      pack.decisions.map((d) => `- ${d.content} (source: ${d.source})`).join("\n"),
    "spec paths with sections": () =>
      pack.specifications.map((s) => `- ${s.path}: ${s.sections.join(", ")}`).join("\n"),
    "memories as bullet list": () =>
      pack.memories.map((m) => `- ${m.content} (source: ${m.source})`).join("\n"),
    "code paths with reason": () =>
      pack.code_context.map((c) => `- ${c.path}: ${c.reason}`).join("\n"),
  };

  return template.replace(/\{(\w+(?:\s+\w+)*)\}/g, (_, key) => {
    const fn = fieldMap[key];
    if (fn) return fn();
    return "";
  });
}

// ── Pipeline Orchestrator ──

/**
 * Ejecuta el pipeline completo.
 * @param {PipelineInput} input
 * @param {{ cwd?: string; openspecRoot?: string; token_budget?: number; custom_template?: string }} [opts]
 * @returns {Promise<ContextPack>}
 */
export async function runPipeline(input, opts = {}) {
  const budget = opts.token_budget ?? 4000;
  const stageTraces = [];

  // 2.2 IntentAnalysis
  const { output: intentOut, trace: t1 } = await runStage("intent_analysis", intentAnalysis, input);
  stageTraces.push(t1);

  // 2.3 CandidateGeneration
  const { output: candOut, trace: t2 } = await runStage("candidate_generation", candidateGeneration, { ...intentOut, ...opts });
  stageTraces.push(t2);

  // 2.4 Normalization
  const { output: normOut, trace: t3 } = await runStage("normalization", normalization, { candidates: candOut?.candidates ?? [] });
  stageTraces.push(t3);

  // 2.5 ConflictResolution
  const { output: conflictOut, trace: t4 } = await runStage("conflict_resolution", conflictResolution, { items: normOut?.items ?? [] });
  stageTraces.push(t4);

  // 2.6 Ranking
  const { output: rankOut, trace: t5 } = await runStage("ranking", ranking, { items: conflictOut?.items ?? [], conflicts: conflictOut?.conflicts ?? [] });
  stageTraces.push(t5);

  // 3.1 BudgetAllocation
  const allRanked = rankOut?.items ?? [];
  const { output: budgetOut, trace: t6 } = await runStage("budget_allocation", budgetAllocation, { items: allRanked, token_budget: budget });
  stageTraces.push(t6);

  // Assembly
  const { output: pack, trace: t7 } = await runStage("assembly", assembly, {
    items: budgetOut?.selected ?? [],
    input,
    stageTraces,
  });
  stageTraces.push(t7);

  // Sort by priority before rendering
  if (pack) sortByPriority(pack);

  // 4.x Render
  if (pack) {
    pack.rendered = renderContext(pack, opts.custom_template);
    pack.token_estimate = estimateTokens(pack.rendered);

    // 3.3 truncation indicator
    if (budgetOut?.truncated) {
      pack.rendered += `\n[...truncated due to token budget — ${budgetOut.excluded} items excluded]`;
    }
  }

  return pack || createContextPack({ text: input.text, intent: input.intent || "" });
}

// ── CLI ──

async function main() {
  const input = JSON.parse(process.argv[2] || "{}");
  const pack = await runPipeline(input, { cwd: process.cwd() });
  process.stdout.write(JSON.stringify(pack, null, 2) + "\n");
}

if (process.argv[1]?.endsWith("context-pack-pipeline.js")) main().catch((e) => {
  process.stderr.write(JSON.stringify({ error: e.message }) + "\n");
  process.exit(1);
});
