# Adding a converter

OmniConvert is “wide” by design: it supports many file types by delegating to external tools when present.

## How it works

- Formats are declared in `src/engine/formats.ts`.
- Converters implement the `Converter` interface in `src/engine/types.ts`.
- The server exposes runtime support at `GET /api/capabilities`.

## Steps

1. Create `src/engine/converters/<name>.ts` exporting a `Converter`.
2. Add it to `src/engine/converters/index.ts` (`ALL_CONVERTERS` order matters: earlier = preferred).
3. (Optional) Add tests in `test/` for conversions that do not require external binaries.

## Converter guidelines

- `availability()` should check for required executables via `findExecutable()` and return `{ ok: false, reason }` if missing.
- `supports(from, to)` should be conservative and explicit.
- `convert()` should:
  - Write exactly one output file (return `outputPath` + `outputFilename`)
  - Use `execLogged()` (no shell) for safety
  - Respect `ctx.signal` for cancellation

## Example skeleton

```ts
import type { Converter } from "../types.js";
import { findExecutable } from "../tooling.js";
import { execLogged } from "../exec.js";

export const myConverter: Converter = {
  id: "my-tool",
  label: "My Tool",
  description: "Does X -> Y",
  availability: async () => {
    const exe = await findExecutable(["my-tool"]);
    return exe ? { ok: true, executables: { "my-tool": exe } } : { ok: false, reason: "Missing my-tool" };
  },
  supports: (from, to) => from === "a" && to === "b",
  convert: async ({ inputPath, originalFilename, to, outputDir, ctx }) => {
    // run your tool, write outputPath, return it
    const { code } = await execLogged({ cmd: "my-tool", argv: [inputPath], signal: ctx.signal, log: ctx.log });
    if (code !== 0) throw new Error(`my-tool failed: ${code}`);
    return { outputPath: "…", outputFilename: "…" };
  }
};
```

