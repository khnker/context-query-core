# Context Query Core (cqe-core)

A cost-aware, robust context query engine core extracted from context-query-engine.

## Grado de Robustez y Resiliencia

1. **Aislamiento por Repositorio**: Cada instancia de `context-query-core` opera sobre un `repoRoot` explícito sin contaminar estado global ni depender de `process.cwd()`.
2. **Resiliencia Multiplataforma (`tgrep` + `bm25`)**: Detección automática de herramientas binarias (como `tgrep` para búsqueda por trigramas) con degradación silenciosa a búsqueda léxica y estructural estándar (`bm25` / `ast-grep`) en Windows, Linux y macOS.
3. **Gestión Determinista de Presupuesto**: Selección de candidatos acotada por presupuesto de tokens y coste temporal sin dependencias de red ni servicios externos.
4. **Procedencia Garantizada**: Cada resultado de recuperación conserva metadatos de origen, operador, consulta y nivel de confianza.
