import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Nocturne design-system adherence (ported from the design project's
  // _adherence.oxlintrc.json). Colors, fonts and sizes come from the token
  // sheet in app/globals.css — not from literals scattered through TSX.
  // Severity is `warn` while legacy code migrates; marketing + ui trees are
  // flipped to `error` below once clean.
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(/]",
          message:
            "Raw color in className — use a Nocturne token (e.g. text-[var(--color-accent)] or a generated utility).",
        },
        {
          selector:
            "Property[key.name=/^(color|background|backgroundColor|fill|stroke|borderColor|boxShadow|outlineColor)$/] > Literal[value=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(/]",
          message: "Raw color in a style object — use var(--color-*).",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(fill|stroke|stopColor)$/] > Literal[value=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(/]",
          message:
            "Raw color on an SVG attribute — use currentColor or var(--color-*).",
        },
        {
          selector:
            "Property[key.name='fontFamily'] > Literal[value!=/Inter|var\\(--font/]",
          message:
            "Font not provided by the design system. Available: Inter (var(--font-heading) / var(--font-body)).",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/\\[\\d{2,}px\\]/]",
          message:
            "Raw px arbitrary value — prefer a --space-*/--radius-* token (1px hairlines are exempt).",
        },
      ],
    },
  },
  // The rebuilt marketing + shared-UI trees are token-clean: hold the line.
  // Note: flat config replaces rule options wholesale, so the raw-px warn
  // selector deliberately does NOT apply in these trees — their type scale
  // (clamp(), 13px kickers) and SVG geometry carry px by design. It keeps
  // warning everywhere else.
  {
    files: [
      "app/(marketing)/**/*.tsx",
      "components/ui/**/*.tsx",
      "components/marketing/**/*.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(/]",
          message:
            "Raw color in className — use a Nocturne token (e.g. text-[var(--color-accent)] or a generated utility).",
        },
        {
          selector:
            "Property[key.name=/^(color|background|backgroundColor|fill|stroke|borderColor|boxShadow|outlineColor)$/] > Literal[value=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(/]",
          message: "Raw color in a style object — use var(--color-*).",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(fill|stroke|stopColor)$/] > Literal[value=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(/]",
          message:
            "Raw color on an SVG attribute — use currentColor or var(--color-*).",
        },
        {
          selector:
            "Property[key.name='fontFamily'] > Literal[value!=/Inter|var\\(--font/]",
          message:
            "Font not provided by the design system. Available: Inter (var(--font-heading) / var(--font-body)).",
        },
      ],
    },
  },
]);

export default eslintConfig;
