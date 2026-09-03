# Title

[1.21.2] `import: false` named-export analysis fails when a dependency contains a class method named `export`

# Description

## Summary

With `@module-federation/vite@1.21.2`, a remote that consumes
`ag-grid-community` with `import: false` fails to build when the package is
provided by the host.

The failure appears to come from the named-export scanner treating a valid
JavaScript class method named `export` as an unrecognized ESM export token.
The scan is marked incomplete, the generated `loadShare` wrapper contains no
named exports, and Rolldown reports `MISSING_EXPORT` for the remote's named
imports.

## Reproduction

Minimal reproduction repository:

https://github.com/ak274/ag-grid-mf-repro

Validated versions:

- `@module-federation/vite`: `1.21.2`
- `vite`: `8.2.0`
- `rolldown`: `1.2.6`
- `react`: `19.2.8`
- `react-dom`: `19.2.8`
- `ag-grid-community`: `36.1.0`
- `pnpm`: `11.22.0`
- Node.js: `v24.19.0`

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build:host
pnpm reproduce
```

The host build succeeds. The reproduction script then runs the remote build
and confirms three `MISSING_EXPORT` diagnostics. To see the ordinary failing
build status directly, run:

```bash
pnpm --dir remote build
```

That command exits with status `1`.

## Relevant configuration

The host provides `ag-grid-community`:

```ts
shared: {
  'ag-grid-community': {
    singleton: true,
    requiredVersion: '^36.1.0',
  },
}
```

The remote consumes it without a local production fallback:

```ts
shared: {
  'ag-grid-community': {
    singleton: true,
    import: false,
    requiredVersion: '^36.1.0',
  },
}
```

The remote imports named exports normally:

```ts
import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
} from 'ag-grid-community'
```

`ag-grid-community` is present in the remote's `devDependencies`, so the
warning that it is not installed locally is misleading in this case.

## Actual result

The remote build reports:

```text
[MISSING_EXPORT] "AllCommunityModule" is not exported by
"...loadShare...ag-grid-community...js"

[MISSING_EXPORT] "ModuleRegistry" is not exported by
"...loadShare...ag-grid-community...js"

[MISSING_EXPORT] "createGrid" is not exported by
"...loadShare...ag-grid-community...js"
```

The build also emits:

```text
[Module Federation] Shared dependency "ag-grid-community" has import: false but
is not installed locally.
```

## Root-cause hypothesis

The distributed ESM entry from AG Grid contains a valid class method like:

```js
class BaseCreator {
  export(userParams) {
    if (this.isExportSuppressed()) {
      return
    }
  }
}
```

The final export-token pass in the named-export scanner recognizes ESM export
declarations and ignores member calls such as `this.export(...)`, but it does
not ignore a bare class or object method named `export`. The scanner therefore
marks the analysis incomplete, which causes named export inspection to return
no result and the generated `import: false` wrapper to omit named exports.

This is valid JavaScript syntax and is not an ESM export declaration.

## Expected result

The scanner should distinguish JavaScript identifiers used as class or object
method names from ESM export declarations. A method such as `export(value) {}`
should not invalidate named-export analysis.

The remote should build successfully, and the generated shared wrapper should
expose at least:

```text
AllCommunityModule
ModuleRegistry
createGrid
```

The remote should continue to use the host-provided shared package without
bundling a local production fallback.

## Questions

1. Does the current `main` branch contain a fix for this case?
2. Which published release includes the fix?
3. Could the fix be included in a patch release for users on `1.21.2`?

There appears to be an upstream regression test named
`detects named exports when export appears as a method name`; confirmation of
the corresponding release would be appreciated.