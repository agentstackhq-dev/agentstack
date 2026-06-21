# Theming

`packages/theme/tokens.json` is the structured source of truth for generated token validation.
`packages/theme/src/index.ts` is the typed app-facing wrapper agents import from code; it must import `../tokens.json` rather than duplicating token values.
Run `pnpm run theme:validate` after changing tokens.

UI should start from `@app/ui` primitive definitions. These primitives are unstyled: they encode required states, accessibility expectations, and token roles, while web and mobile choose platform-native rendering. The generated `workspace status` vertical is the reference example for using primitive metadata without turning `@app/ui` into a styled component library.

Use token role names such as `colors.surface`, `colors.foreground`, and `colors.focusRing` in shared primitive metadata. Keep raw color values inside the theme package so product screens do not drift into one-off palettes.
