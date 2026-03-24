import globals from "globals";
import js from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";

// Plugins
import _import from "eslint-plugin-import";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import markdown from "@eslint/markdown";
import json from "@eslint/json";
import jsonc from "eslint-plugin-jsonc";
import jsoncParser from "jsonc-eslint-parser";
import html from "@html-eslint/eslint-plugin";
import node from "eslint-plugin-node";
import yml from "eslint-plugin-yml";
import yamlParser from "yaml-eslint-parser";

export default [
  js.configs.recommended,
  eslintPluginPrettierRecommended,

  {
    plugins: {
      import: fixupPluginRules(_import),
      node,
      json,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.amd,
        // Cloudflare Workers runtime globals
        FixedLengthStream: "readonly",
        caches: "readonly",
      },

      ecmaVersion: "latest",
      sourceType: "module",

      parserOptions: {
        ecmaFeatures: {
          impliedStrict: true,
          classes: true,
        },
      },
    },
    rules: {
      "no-irregular-whitespace": "off",
      "no-undef": "error",
      "class-methods-use-this": "off",
      "no-throw-literal": "off",
      "no-debugger": "warn",
      "no-alert": "warn",
      "no-await-in-loop": "off",
      "no-return-assign": ["error", "except-parens"],
      "no-restricted-syntax": ["error", "ForInStatement", "LabeledStatement", "WithStatement"],
      "no-unreachable": "warn",
      "no-unused-vars": [
        "warn",
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: "res|next|^err",
        },
      ],
      "prefer-const": [
        "error",
        {
          destructuring: "all",
        },
      ],
      "arrow-body-style": ["error", "as-needed"],
      "no-unused-expressions": [
        "error",
        {
          allowTaggedTemplates: true,
        },
      ],
      "no-const-assign": "warn",
      "no-param-reassign": "off",
      "no-console": "warn",
      "space-before-function-paren": "off",
      "comma-dangle": "off",
      "max-len": [
        "error",
        {
          code: 132,
        },
      ],
      "no-underscore-dangle": "off",
      "consistent-return": "off",
      radix: "warn",
      "no-shadow": [
        "error",
        {
          hoist: "all",
          allow: ["resolve", "reject", "done", "next", "err", "error"],
        },
      ],
      quotes: [
        "error",
        "double",
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],
    },
  },
  {
    name: "html",
    ...html.configs["flat/recommended"],
    files: ["**/*.html", "**/*.hbs"],
    plugins: {
      html,
    },
    language: "html/html",
    languageOptions: {
      // This tells the parser to treat {{ ... }} as template syntax,
      // so it won't try to parse contents inside as regular HTML
      templateEngineSyntax: {
        "{{": "}}",
      },
    },
    rules: {
      "html/indent": ["error", 2],
      "html/quotes": ["error", "double"],
      "html/no-self-closing": "off",
      "html/no-mixed-html": "off",
      "html/require-img-alt": "error",
    },
  },
  {
    name: "markdown",
    files: ["**/*.md"],
    plugins: {
      markdown,
    },
    language: "markdown/gfm",
    rules: {
      "markdown/no-html": "error",
      "markdown/heading-increment": "error",
      "markdown/fenced-code-language": "error",
    },
  },
  // Added for JSONC
  {
    name: "jsonc",
    files: ["**/*.jsonc", "**/tsconfig.json", "**/.vscode/**.json"],
    languageOptions: {
      parser: jsoncParser,
    },
    plugins: {
      jsonc,
    },
    rules: {
      ...jsonc.configs.base.overrides[0].rules, // Base rules
      ...jsonc.configs["recommended-with-jsonc"].rules, // Recommended JSONC rules
    },
  },
  // Added for YAML
  {
    name: "yaml",
    files: ["**/*.yaml", "**/*.yml"],
    languageOptions: {
      parser: yamlParser,
    },
    plugins: {
      yml,
    },
    rules: {
      ...yml.configs.base.overrides[0].rules, // Base rules
      ...yml.configs.standard.rules, // Standard YAML rules (includes recommended)
    },
  },
];
