## [t2] Registry and context compatibility seams
- Codebase/domain discoveries: `main.ts` owned all tab initialization and rendering; insurance was self-contained enough to pilot context injection without changing its UI contract.
- Wrong assumptions and corrections: the first registry draft needed asynchronous rejection handling so module mount exceptions reach the existing shell error path.
- Debugging dead-ends and what actually worked: no build or test failures; `git diff --stat` omits newly added untracked files, so artifact verification must include explicit file paths.
- Techniques/patterns worth reusing: keep `appState` as the default context adapter, wrap persistence overloads in a narrow repository method, and preserve legacy feature exports while migrating callers.
- Learnings consumed: [(none)]

## [t4.1] Feature boundary conformance
- Codebase/domain discoveries: all remaining feature singleton/persistence access could use the existing repository adapter; sibling imports clustered around pure calculations, dashboard widgets, UI primitives, and NAV refresh.
- Wrong assumptions and corrections: the first build caught one post-render dashboard call still using a removed direct KPI symbol; the same context port fixed it without changing behavior.
- Debugging dead-ends and what actually worked: no runtime failures; editor diagnostics plus build exposed the only missed call after the initial patch.
- Techniques/patterns worth reusing: keep optional context parameters on legacy entry points, store the active context per feature, and centralize compatibility adapters in `src/core/feature-ports.ts`.
- Learnings consumed: [frontend/feature-context-ports]