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
const SETUP = "app/account/flows/[subscriptionId]/setup/SetupForm.tsx";
const STUBS = {
  "../../actions": "export const saveSetup = async () => ({ ok: true });",
  "./actions":
    "export const beginConnectionAuthorization = async () => ({ ok: false }); export const connectProviderWithKey = async () => ({ ok: false }); export const disconnectConnection = async () => ({ ok: false });",
  "./upload-actions":
    "export const openRunUpload = async () => ({ ok: false, error: 'x' }); export const completeRunUpload = async () => ({ ok: false, error: 'x' });",
};

/** A router where no app router is mounted: what a client page's hooks read here. */
const NO_ROUTER = (source) =>
  source.replace(
    /import \{ useRouter \} from "next\/navigation";/u,
    "const useRouter = () => ({ push() {}, refresh() {}, replace() {} });",
  );

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
      mutate && file === path ? mutate(NO_ROUTER(source)) : NO_ROUTER(source),
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

/** A field of Set up, in a section by `sectionId` when one is given. */
const field = (key, control, sectionId, extra = {}) => ({
  section: control === "connection" ? "connections" : "rules",
  key,
  title: key.toUpperCase(),
  description: "",
  control,
  required: false,
  ...(sectionId ? { sectionId } : {}),
  ...extra,
});

/** The same fields with no `sectionId`: a manifest that declares no sections. */
const unsectioned = (one) => {
  const copy = { ...one };
  delete copy.sectionId;
  return copy;
};

/** Each numbered step's words, in order: "01", "NPI", … */
const stepTitles = (nodes) =>
  nodes
    .filter((node) => node.attrs.role === "group")
    .map((node) => node.attrs["aria-label"]);

test("S1-B2: a manifest's sections are Set up's, in its order and by its titles, numbered, each its fields by sectionId — a vendor choice in the section it names", async () => {
  const { SetupFields } = await load(FIELDS);
  const sections = [
    { id: "npi", title: "NPI" },
    { id: "specialty", title: "Specialty" },
    { id: "integrations", title: "Connectors" },
  ];
  const setup = [
    field("learn", "toggle", "integrations"),
    field("npi", "text", "npi"),
    field("vendor", "connection", "integrations"),
    field("specialty", "text", "specialty"),
  ];
  const nodes = tree(
    draw(SetupFields, {
      setup,
      sections,
      config: {},
      hideConnections: true,
      vendors: (key) =>
        react.createElement("p", { "data-testid": `vendor-${key}` }, key),
    }),
  );
  assert.deepEqual(stepTitles(nodes), ["NPI", "Specialty", "Connectors"]);
  const groups = nodes.filter((node) => node.attrs.role === "group");
  const inside = (group) =>
    elements(group)
      .map(
        (node) =>
          node.attrs.name?.replace(/^config:/u, "") ??
          node.attrs["data-testid"],
      )
      .filter((name) => name && !name.startsWith("config-control"));
  assert.deepEqual(inside(groups[0]), ["npi"]);
  assert.deepEqual(inside(groups[1]), ["specialty"]);
  assert.deepEqual(inside(groups[2]), ["learn", "vendor-vendor"]);
  // Numbered from 1, each its own number.
  assert.match(draw(SetupFields, { setup, sections, config: {} }), /01/u);

  // Without sections, the four fixed ones, as before; no vendor drawn here.
  const fixed = tree(
    draw(SetupFields, {
      setup: setup.map(unsectioned),
      config: {},
      hideConnections: true,
      vendors: (key) =>
        react.createElement("p", { "data-testid": `vendor-${key}` }, key),
    }),
  );
  assert.deepEqual(stepTitles(fixed), ["Settings"]);
  assert.equal(
    fixed.filter((node) => node.attrs["data-testid"] === "vendor-vendor")
      .length,
    0,
  );
});

test("S1-B2: Set up with the manifest's sections draws each vendor choice in its section, and Connect only for an account the flow cannot run without", async () => {
  const { SetupForm } = await load(SETUP);
  const props = {
    workspaceId: "w",
    subscriptionId: "s",
    status: "draft",
    available: true,
    setup: [
      field("npi", "text", "npi"),
      field("vendor", "connection", "integrations"),
    ],
    sections: [
      { id: "npi", title: "NPI" },
      { id: "integrations", title: "Connectors" },
    ],
    config: {},
    vendorFields: [
      { key: "vendor", title: "Vendor", saved: "none", options: [] },
    ],
    required: [],
    connections: [],
    canManage: true,
    returnTo: "/account/flows/s/setup",
    callbackStatus: null,
  };
  const nodes = tree(draw(SetupForm, props));
  assert.deepEqual(stepTitles(nodes), ["NPI", "Connectors"]);
  const [connectors] = nodes.filter(
    (node) => node.attrs["aria-label"] === "Connectors",
  );
  assert.ok(
    elements(connectors).some(
      (node) => node.attrs["data-testid"] === "setup-vendor-vendor",
    ),
    "the vendor rows in their section",
  );
  // No sections: 1 · Connect holds the vendor rows, as before.
  const before = tree(
    draw(SetupForm, {
      ...props,
      sections: undefined,
      setup: props.setup.map(unsectioned),
    }),
  );
  assert.deepEqual(stepTitles(before), ["Connect", "Settings"]);
});
