# Context Query Core (cqe-core)

A cost-aware, robust context query engine core extracted for AI agents and codebases.

## Overview

`cqe-core` treats agent context retrieval as a query optimization problem. Instead of performing naive full-repo grepping, it uses intent detection, logical query planning, hybrid retrieval (`tgrep`, `bm25`, symbols, federated), cost-aware selection, and strict budget limits.

## Grado de Robustez y Resiliencia

1. **Aislamiento por Repositorio**: Cada instancia opera sobre un `repoRoot` explícito sin contaminar estado global ni depender de `process.cwd()`.
2. **Resiliencia Multiplataforma (`tgrep` + `bm25`)**: Detección automática de binarios (`tgrep` para búsqueda por trigramas) con degradación silenciosa a búsqueda léxica y estructural estándar (`bm25` / `ast-grep`) en Windows, Linux y macOS.
3. **Gestión Determinista de Presupuesto**: Selección de candidatos acotada por presupuesto de tokens y coste temporal sin dependencias de red ni servicios externos.
4. **Procedencia Garantizada**: Cada resultado conserva metadatos de origen, operador, consulta y nivel de confianza.

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
