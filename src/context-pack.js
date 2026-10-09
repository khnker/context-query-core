#!/usr/bin/env node
/**
 * engine/context-pack.js — ContextPack contract.
 * Contrato de salida único, determinista y trazable para CQE.
 * Reemplaza EvidencePacket como output público (legacy como opt-in).
 */

// ── Types ──

/** @typedef {"lexical"|"semantic"|"structural"|"openspec"|"llm"} Strategy */

/**
 * @typedef {{ source: string; score: number; reasons: string[]; strategy: Strategy }} SelectionEntry
 */

/**
 * @typedef {{ id: string; relevance: number }} Topic
 * @typedef {{ id: string; type: string; relevance: number }} Entity
 * @typedef {{ id: string; content: string; priority: number; source: string }} Constraint
 * @typedef {{ id: string; content: string; status: "active"|"superseded"; source: string }} Decision
 * @typedef {{ path: string; sections: string[]; relevance: number }} SpecRef
 * @typedef {{ id: string; type: "fact"|"convention"|"observation"|"decision"; content: string; relevance: number; source: string }} MemoryEntry
 * @typedef {{ path: string; reason: string; relevance: number }} CodeRef
 * @typedef {{ sources: string[]; resolution: string }} Conflict
 */

/**
 * @typedef {{
 *   version: "1";
 *   request: { text: string; intent: string };
 *   topics: Topic[];
 *   entities: Entity[];
 *   constraints: Constraint[];
 *   decisions: Decision[];
 *   specifications: SpecRef[];
 *   memories: MemoryEntry[];
 *   code_context: CodeRef[];
 *   conflicts: Conflict[];
 *   rendered: string;
 *   token_estimate: number;
 *   metadata: {
 *     generated_at: string;
 *     engine_version: string;
 *     retrieval_strategy: string;
 *   };
 *   selection_trace: SelectionEntry[];
 * }} ContextPack
 */

// ── Create ──

/** Sello de versión del engine */
const ENGINE_VERSION = "1.0.0";

/**
 * @param {{
 *   text: string;
 *   intent: string;
 *   topics?: Topic[];
 *   entities?: Entity[];
 *   constraints?: Constraint[];
 *   decisions?: Decision[];
 *   specifications?: SpecRef[];
 *   memories?: MemoryEntry[];
 *   code_context?: CodeRef[];
 *   conflicts?: Conflict[];
 *   selection_trace?: SelectionEntry[];
 *   retrieval_strategy?: string;
 *   rendered?: string;
 *   token_estimate?: number;
 * }} input
 * @returns {ContextPack}
 */
export function createContextPack(input) {
  const now = new Date().toISOString();
  return {
    version: "1",
    request: { text: input.text, intent: input.intent },
    topics: input.topics ?? [],
    entities: input.entities ?? [],
    constraints: input.constraints ?? [],
    decisions: input.decisions ?? [],
    specifications: input.specifications ?? [],
    memories: input.memories ?? [],
    code_context: input.code_context ?? [],
    conflicts: input.conflicts ?? [],
    rendered: input.rendered ?? "",
    token_estimate: input.token_estimate ?? 0,
    metadata: {
      generated_at: now,
      engine_version: ENGINE_VERSION,
      retrieval_strategy: input.retrieval_strategy ?? "tier-0",
    },
    selection_trace: input.selection_trace ?? [],
  };
}

// ── Token estimation ──

/**
 * Estima tokens de un string.
 * Promedio: ~4 chars por token (antropico), pero usamos 4.5 para margen.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4.5);
}

/**
 * Estima tokens totales del ContextPack (rendered + metadata overhead estimado).
 * @param {ContextPack} pack
 * @returns {number}
 */
export function estimatePackTokens(pack) {
  const rendered = pack.rendered?.length ?? 0;
  const metadata = JSON.stringify({
    version: pack.version,
    request: pack.request,
    topics: pack.topics,
    entities: pack.entities,
    constraints: pack.constraints,
    decisions: pack.decisions,
    specifications: pack.specifications,
    memories: pack.memories,
    code_context: pack.code_context,
    conflicts: pack.conflicts,
    selection_trace: pack.selection_trace,
  }).length;
  return estimateTokens(rendered) + estimateTokens(metadata);
}

// ── Serialization ──

export function packToJSON(pack) {
  return JSON.stringify(pack, null, 2);
}

export function packFromJSON(json) {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  // validate version
  if (data.version !== "1") {
    throw new Error(`Unsupported ContextPack version: ${data.version}`);
  }
  return /** @type {ContextPack} */ (data);
}

// ── Helpers ──

/**
 * Filtra decisiones superseded del pack (in-place).
 */
export function filterSuperseded(pack) {
  pack.decisions = pack.decisions.filter((d) => d.status === "active");
  return pack;
}

/**
 * Reordena arrays según prioridad: constraints > decisions > specs > code > memories.
 */
export function sortByPriority(pack) {
  const priority = { constraints: 0, decisions: 1, specifications: 2, code_context: 3, memories: 4 };
  for (const [key, _pri] of Object.entries(priority)) {
    const arr = pack[key];
    if (Array.isArray(arr)) {
      arr.sort((a, b) => (b.relevance ?? b.priority ?? 0) - (a.relevance ?? a.priority ?? 0));
    }
  }
  return pack;
}
