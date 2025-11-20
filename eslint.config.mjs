import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";

const tsFiles = ["**/*.{ts,tsx,mts,cts}"];
const reactFiles = ["**/*.{jsx,tsx}"];
const ensureArray = (value) => (Array.isArray(value) ? value : [value]);
const tsRecommended = ensureArray(tseslint.configs.recommended).map((config) => ({
  ...config,
  files: config.files ?? tsFiles,
}));
const pluginReactRecommended = ensureArray(pluginReact.configs.flat.recommended);
const reactRecommended = pluginReactRecommended.map((config) => ({
  ...config,
  files: config.files ?? reactFiles,
}));

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  ...tsRecommended,
  ...reactRecommended,
  {
    files: reactFiles,
    plugins: { react: pluginReact },
    settings: { react: { version: "detect" } },
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.jsonc"],
    plugins: { json },
    language: "json/jsonc",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.json5"],
    plugins: { json },
    language: "json/json5",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/gfm",
    extends: ["markdown/recommended"],
  },
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
  },
]);
