# AG Grid + Module Federation Vite reproduction

Minimal two-app reproduction for a host-provided `import: false` shared
dependency failing named-export analysis in `@module-federation/vite`.

This repository intentionally contains only one shared AG Grid package:
`ag-grid-community`. It does not use `ag-grid-react`,
`ag-grid-enterprise`, Nx, or any application-specific tooling.

## Problem summary

The documented Module Federation pattern for a large dependency that must be
provided by the host is:

```ts
// Host
shared: {
  'ag-grid-community': {
    singleton: true,
  },
}
```

```ts
// Remote
shared: {
  'ag-grid-community': {
    singleton: true,
    import: false,
  },
}
```

With `import: false`, the remote should not package a local fallback. Its
named imports should be forwarded to the host-provided shared module.

In this reproduction, the host build passes, but the remote build fails. The
failure is caused by the export scanner treating a valid class method named
`export` inside AG Grid's distributed ESM bundle as an unknown ESM export
syntax. The scanner marks the package export analysis incomplete, and the
generated `loadShare` module contains no named exports.

## Repository layout

```text
.
├── host/
│   ├── src/App.tsx             Host page and AG Grid provider
│   └── vite.config.ts          Host federation configuration
├── remote/
│   ├── src/App.tsx             Exposed React component using AG Grid Community
│   └── vite.config.ts          Remote federation configuration
├── scripts/reproduce.mjs       Expected-failure detector
├── package.json                Root commands
├── pnpm-workspace.yaml         Two-app workspace definition
└── pnpm-lock.yaml              Reproducible dependency lockfile
```

## Exact versions

These are pinned in the two app manifests and lockfile:

| Package | Version |
| --- | --- |
| `@module-federation/vite` | `1.21.2` |
| `vite` | `8.2.0` |
| `rolldown` | `1.2.6` (transitive) |
| `react` | `19.2.8` |
| `react-dom` | `19.2.8` |
| `ag-grid-community` | `36.1.0` |
| `pnpm` | `11.22.0` |

`ag-grid-community` is a normal dependency of the host and a development
dependency of the remote. The remote keeps a local development copy so the
plugin can inspect the package's exports, while `import: false` prevents that
copy from being used as a production shared fallback.

## Prerequisites

- Node.js compatible with Vite 8. The validated environment uses Node `v24.19.0`.
- pnpm `11.22.0`.
- Internet access to `https://registry.npmjs.org/`.

The root `.npmrc` selects the public npm registry because some private mirrors
do not currently serve `@module-federation/vite@1.21.2`.

## Reproduce from a clean checkout

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build:host
pnpm reproduce
```

Expected results:

1. `pnpm install --frozen-lockfile` succeeds.
2. `pnpm build:host` succeeds.
3. The remote build emits `[MISSING_EXPORT]` diagnostics for named exports
   from `ag-grid-community`.
4. `pnpm reproduce` exits with status `0` after confirming the expected bug.

The last point is intentional. `scripts/reproduce.mjs` treats detection of the
known failure as a successful reproduction. It runs the remote build beneath
the command, captures its non-zero build status, counts `[MISSING_EXPORT]`
diagnostics, and exits successfully only when at least one diagnostic is found.

To see the ordinary failing build status directly, run:

```bash
pnpm --dir remote build
```

That command exits with status `1` before the upstream fix.

## Validated output

The host build completes successfully and emits a lazy AG Grid shared chunk.
The remote build currently reports:

```text
[Module Federation] Shared dependency "ag-grid-community" has import: false
but is not installed locally.

[MISSING_EXPORT] "AllCommunityModule" is not exported by
"...loadShare...ag-grid-community...js".

[MISSING_EXPORT] "ModuleRegistry" is not exported by
"...loadShare...ag-grid-community...js".

[MISSING_EXPORT] "createGrid" is not exported by
"...loadShare...ag-grid-community...js".
```

The warning is misleading in this reproduction: `ag-grid-community` is
present in `remote/devDependencies`. The plugin emits this warning because
the named-export inspection returns an incomplete/undefined result, not
because the package is absent from the filesystem.

The remote TypeScript build and lint both pass independently:

```bash
pnpm --dir host exec tsc -b
pnpm --dir remote exec tsc -b
pnpm run lint:host
pnpm run lint:remote
```

This isolates the failure to the Module Federation production build step,
not the AG Grid imports or the React component.

## Minimal federation configuration

### Host

`host/vite.config.ts` registers the host as the provider:

```ts
federation({
  name: 'host',
  remotes: {
    remote: 'http://localhost:4173/mf-manifest.json',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
    'ag-grid-community': {
      singleton: true,
      requiredVersion: '^36.1.0',
    },
  },
})
```

The host imports and registers the Community aggregate module:

```ts
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);
```

### Remote

`remote/vite.config.ts` exposes one React component and disables the local
shared fallback:

```ts
federation({
  name: 'remote',
  filename: 'remoteEntry.js',
  manifest: true,
  dts: false,
  shareStrategy: 'loaded-first',
  exposes: {
    './App': './src/App.tsx',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
    'ag-grid-community': {
      singleton: true,
      import: false,
      requiredVersion: '^36.1.0',
    },
  },
})
```

The exposed component imports named exports normally:

```ts
import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
} from 'ag-grid-community';
```

It uses the vanilla Community grid API from inside a React component. No
enterprise package or React-specific AG Grid wrapper is involved.

## Root-cause hypothesis

The published `@module-federation/vite@1.21.2` package contains a regex-based
named-export scanner in `lib/index.js`. The relevant logic recognizes actual
ESM export declarations and then performs a final pass over remaining
`export` tokens. In simplified form, the final pass behaves like this:

```ts
const exportKeywordRegex = /\bexport\b/g;

while ((match = exportKeywordRegex.exec(source)) !== null) {
  if (recognizedExportStarts.has(match.index)) continue;

  // Member calls such as this.export(...) are ignored.
  if (source[previousCodeIndex] === '.') continue;

  scanState.complete = false;
  break;
}
```

AG Grid Community's distributed ESM entry contains a valid class method named
`export`:

```js
class BaseCreator {
  export(userParams) {
    if (this.isExportSuppressed()) {
      return;
    }
  }
}
```

This is not an ESM export declaration. However, it is a bare `export` token and
is not preceded by `.`, so the scan is marked incomplete.

The resulting chain is:

```text
AG Grid ESM entry
  -> scanner sees class method `export(...)`
  -> scanState.complete = false
  -> namedExports = undefined
  -> import:false wrapper receives no named export list
  -> Rolldown reports MISSING_EXPORT for every remote named import
```

The same behavior was reproduced in the larger application with AG Grid
Community and Enterprise. This standalone repository demonstrates that the
issue also occurs with Community alone.

## Expected behavior

The scanner should distinguish valid JavaScript identifiers used as class or
object method names from ESM export declarations. A method such as
`export(value) {}` should not invalidate the package's export analysis.

For the example in this repository, the generated `import: false` wrapper
should expose at least:

```text
AllCommunityModule
ModuleRegistry
createGrid
```

The package should then build successfully without bundling a local production
fallback into the remote.

## Upstream issue draft

This repository can be attached to an issue in
[module-federation/vite](https://github.com/module-federation/vite/issues).

### Suggested title

```text
[1.21.2] import:false named-export analysis fails when a dependency contains a class method named `export`
```

### Suggested issue body

```markdown
## Summary

With `@module-federation/vite@1.21.2`, a remote that consumes
`ag-grid-community` with `import: false` fails to build when the package is
provided by the host.

The failure occurs because the named-export scanner treats a valid JavaScript
class method named `export` as an unrecognized ESM export token. The scan is
marked incomplete, the generated `loadShare` wrapper contains no named
exports, and Rolldown reports `MISSING_EXPORT` for the remote's named imports.

## Reproduction

This repository contains a minimal two-app Vite + React reproduction:

https://github.com/<owner>/<repo>

Versions:

- `@module-federation/vite`: `1.21.2`
- `vite`: `8.2.0`
- `rolldown`: `1.2.6`
- `react`: `19.2.8`
- `react-dom`: `19.2.8`
- `ag-grid-community`: `36.1.0`
- `pnpm`: `11.22.0`

Run:

```bash
pnpm install --frozen-lockfile
pnpm build:host
pnpm reproduce
```

The host build succeeds. The remote build emits three `MISSING_EXPORT`
diagnostics for `AllCommunityModule`, `ModuleRegistry`, and `createGrid`.

The direct failing command is:

```bash
pnpm --dir remote build
```

## Federation configuration

The host provides the dependency:

```ts
shared: {
  'ag-grid-community': {
    singleton: true,
  },
}
```

The remote consumes it without a local production fallback:

```ts
shared: {
  'ag-grid-community': {
    singleton: true,
    import: false,
  },
}
```

The remote imports named exports normally:

```ts
import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
} from 'ag-grid-community';
```

## Actual output

```text
[MISSING_EXPORT] "AllCommunityModule" is not exported by
"...loadShare...ag-grid-community...js"

[MISSING_EXPORT] "ModuleRegistry" is not exported by
"...loadShare...ag-grid-community...js"

[MISSING_EXPORT] "createGrid" is not exported by
"...loadShare...ag-grid-community...js"
```

## Root cause hypothesis

AG Grid's distributed ESM entry contains a valid method definition like:

```js
class BaseCreator {
  export(userParams) {
    return userParams;
  }
}
```

The final export-token scan in `getNamedExportsViaRegex` ignores `this.export`
member calls, but does not ignore a bare method definition named `export`.
That sets `scanState.complete = false`, which causes named export inspection to
return `undefined` and the generated `import:false` wrapper to omit named
exports.

## Expected behavior

`export(...)` used as a class or object method should not invalidate ESM
named-export analysis. The remote should build successfully and resolve the
named exports from the host-provided shared package.

## Questions

Does the current `main` branch fix this case? I noticed a regression test named
`detects named exports when export appears as a method name` in the upstream
source. If so, which published release contains the fix? Could it be included
in a patch release for users on `1.21.2`?
```

## Running the apps after a fix

Before the upstream fix, the remote build is expected to fail. After applying a
fixed Module Federation Vite version, run the remote preview and host in
separate terminals:

```bash
pnpm --dir remote build
pnpm --dir remote preview --host 127.0.0.1 --port 4173
pnpm dev:host
```

The host consumes the remote through:

```text
http://localhost:4173/mf-manifest.json
```

The remote's generated manifest is used instead of hard-coding Vite's hashed
`remoteEntry` filename.
