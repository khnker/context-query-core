# Context Query Core (cqe-core)

A cost-aware, robust context query engine core extracted for AI agents and codebases.

## Overview

`cqe-core` treats agent context retrieval as a query optimization problem. Instead of performing naive full-repo grepping, it uses intent detection, logical query planning, hybrid retrieval (`tgrep`, `bm25`, symbols, federated), cost-aware selection, and strict budget limits.

## Robustness and Resilience

1. **Repository Isolation**: Each instance operates on an explicit `repoRoot` without contaminating global state or depending on `process.cwd()`.
2. **Cross-Platform Resilience (`tgrep` + `bm25`)**: Automatic binary detection (`tgrep` for trigram search) with graceful fallback to standard lexical and structural search (`bm25` / `ast-grep`) across Windows, Linux, and macOS.
3. **Deterministic Budget Management**: Candidate selection constrained by token budget and time cost without network dependencies or external services.
4. **Guaranteed Provenance**: Each retrieval result preserves metadata regarding source, operator, query, and confidence level.

## Installation & Usage

```javascript
import { createEngine } from './src/core.js';

const engine = createEngine({ repoRoot: process.cwd() });
const results = await engine.query({ query: 'find authentication middleware' });
console.log(results);
```

## Architecture

- **CQP (Context Query Parser)**: Parses structured search and retrieval intent.
- **Retrievers**: Hybrid execution (`tgrep` trigram regex, lexical BM25, symbol lookup, federated knowledge graph).
- **Optimizer & Selector**: Ranks candidates using token budgets and relevance scoring.
- **Adapters**: Clean MCP and programmatic interfaces.
