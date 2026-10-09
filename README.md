# Context Query Core (cqe-core)

A cost-aware, robust context query engine core extracted for AI agents and codebases.

## Overview

`cqe-core` treats agent context retrieval as a query optimization problem instead of naive full-repo grepping.

## What It Is Used For

`cqe-core` is designed for AI agents and developer tools that need to retrieve precise, high-signal context from large codebases while strictly respecting token budgets, avoiding redundant searches, and maintaining absolute provenance over every retrieved snippet.

## Tools Used

- **`tgrep`**: Ultra-fast trigram-indexed regular expression search for raw text matching.
- **`ast-grep` (`sg`)**: Abstract Syntax Tree (AST) search for structural and semantic code patterns.
- **`bm25`**: Lexical scoring and term-frequency retrieval.
- **Federated Knowledge Graph**: Structured metadata retrieval for services, dependencies, and decisions.

## Workflow

1. **Query Parsing (CQP)**: The agent expresses what it needs in declarative query syntax.
2. **Intent Detection**: The engine classifies the query type (definitions, references, implementation, pattern, concept).
3. **Hybrid Retrieval Plan**: The planner dispatches tasks across available tools (`tgrep`, `bm25`, symbol lookup, federated graph) in parallel or sequence.
4. **Candidate Fusion & Reranking**: Results are deduplicated, scored, and filtered.
5. **Budget-Aware Selection**: Candidates are packed into the target token budget.
6. **Provenance Tracking**: Every result retains metadata on source operator, query, and confidence.

## Installation & Usage

```javascript
import { createEngine } from './src/core.js';

const engine = createEngine({ repoRoot: process.cwd() });
const results = await engine.query({ query: 'find authentication middleware' });
console.log(results);
```
