import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { elements, loadModules, parse } from "./blocks-harness.mjs";

/**
 * Round 21, stage 1, C2 on the website (the client half of the backend's
 * stage-1 contract, commit 35d0695; the same words as the app): each item's
 * screen, drawn from the generated shapes.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const FIELDS = "app/account/flows/ManifestFields.tsx";
const STUBS = {
  "./upload-actions":
    "export const openRunUpload = async () => ({ ok: false, error: 'x' }); export const completeRunUpload = async () => ({ ok: false, error: 'x' });",
  "next/navigation":
    "export const useRouter = () => ({ push() {}, refresh() {}, replace() {} });",
};

let react;
let server;
const loaded = [];
before(async () => {
  react = await import("react");
  server = await import("react-dom/server");
});
after(() => {
  for (const cleanup of loaded) cleanup();
});

/** One module, loaded as written, or as `mutate` makes it (a bite, or a state). */
async function load(path, mutate) {
  const { modules, cleanup } = await loadModules([path], {
    stubs: STUBS,
    mutate: (file, source) =>
      mutate && file === path ? mutate(source) : source,
  });
  loaded.push(cleanup);
  return modules[path];
}

const draw = (component, props) =>
  server.renderToStaticMarkup(react.createElement(component, props));
const tree = (markup) => elements(parse(markup));

test("S1-B1: a text setup field's example is its box's placeholder; a field without one, or another control, has none", async () => {
  const { SetupFields } = await load(FIELDS);
  const nodes = tree(
    draw(SetupFields, {
      setup: [
        {
          section: "rules",
          key: "npi",
          title: "NPI",
          description: "",
          control: "text",
          required: false,
          example: "1234567890",
        },
        {
          section: "rules",
          key: "note",
          title: "Note",
          description: "",
          control: "text",
          required: false,
        },
        {
          section: "rules",
          key: "limit",
          title: "Limit",
          description: "",
          control: "money",
          required: false,
          example: "500",
        },
      ],
      config: {},
    }),
  );
  const box = (key) =>
    nodes.find((node) => node.attrs.name === `config:${key}`);
  assert.equal(box("npi").attrs.placeholder, "1234567890");
  assert.equal(box("note").attrs.placeholder, undefined);
  assert.equal(box("limit").attrs.placeholder, undefined);
});
