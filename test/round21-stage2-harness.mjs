import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { elements, loadModules, parse } from "./blocks-harness.mjs";

/**
 * What Round 21, Stage 2's two test files share (`round21-stage2-c3.test.mjs`,
 * `round21-stage2-d1-s1.test.mjs`): the sources as read, a module loaded as
 * written or as a bite makes it, and the platform as these modules meet it.
 * Not a test file itself.
 */

export const root = resolve(import.meta.dirname, "..");
export const read = (path) => readFileSync(resolve(root, path), "utf8");
/** A source's code, without its comments — which may name what is gone. */
export const code = (path) =>
  read(path)
    .replace(/\{\/\*[\s\S]*?\*\/\}/gu, "")
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^\s*\/\/.*$/gmu, "");

/**
 * The platform as these modules meet it: `platformServerJson` answers from
 * `globalThis.__platform` by path (an Error is thrown), and every path asked
 * is kept in `__asked`, every request in `__sent`; `listWorkspaces` answers
 * `globalThis.__workspaces`, and the workspace a page showed is the active
 * one unless `__active` says otherwise. One error class for every copy
 * loaded, so a test's error is the one each copy checks.
 */
globalThis.__PlatformServerError ??= class PlatformServerError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
};
export const STUBS = {
  "@/components/ui/Modal":
    "export default function Modal({ children }) { return children; }",
  "./agreement-actions":
    "export const acceptHealthAgreement = async () => ({ ok: true });",
  "@/lib/platform-server": `
    export const PlatformServerError = globalThis.__PlatformServerError;
    export class PlatformNotConfiguredError extends Error {}
    export const workspacePath = (id) => "/v1/workspaces/" + id;
    export const newIdempotencyKey = (prefix) => prefix + "-key";
    export async function platformServerJson(path, init = {}) {
      globalThis.__asked.push(path);
      globalThis.__sent?.push({ path, ...init });
      const answer = globalThis.__platform[path];
      if (answer instanceof Error) throw answer;
      return answer;
    }`,
  "@/lib/tenancy": `
    export const WORKSPACE_CHANGED = "WORKSPACE_CHANGED";
    export async function activeWorkspaceIfShown(shown) {
      return shown === (globalThis.__active ?? shown) ? shown : null;
    }
    export async function listWorkspaces() {
      globalThis.__asked.push("/v1/workspaces");
      return globalThis.__workspaces;
    }`,
};

/** A server action's `revalidatePath`, kept in `__revalidated` (no Next request here). */
const NO_CACHE = (source) =>
  source.replace(
    /import \{ revalidatePath \} from "next\/cache";/u,
    "const revalidatePath = (...path) => globalThis.__revalidated.push(path);",
  );

const loaded = [];
/** Removes every copy loaded: each test file's `after`. */
export function cleanupLoaded() {
  for (const cleanup of loaded.splice(0)) cleanup();
}

/** One module, loaded as written, or as `mutate` makes it (a bite). */
export async function load(path, mutate) {
  const { modules, cleanup } = await loadModules([path], {
    stubs: STUBS,
    mutate: (file, source) =>
      NO_CACHE(mutate && file === path ? mutate(source) : source),
  });
  loaded.push(cleanup);
  return modules[path];
}

const react = await import("react");
const server = await import("react-dom/server");
export const draw = (component, props) =>
  server.renderToStaticMarkup(react.createElement(component, props));
export const tree = (markup) => elements(parse(markup));

/** The platform's refusal, of the one class every copy reads. */
export const platformError = (status, details, message = "Forbidden") =>
  new globalThis.__PlatformServerError(message, status, undefined, details);

/**
 * A fresh platform for one call: its answers by path, the workspace list
 * (this person's `role` in "w1", Acme Clinic), and nothing asked yet.
 */
export function platform(answers = {}, { role = "owner", active } = {}) {
  globalThis.__asked = [];
  globalThis.__sent = [];
  globalThis.__revalidated = [];
  globalThis.__active = active;
  globalThis.__workspaces = [
    { id: "w1", name: "Acme Clinic", type: "organization", role },
  ];
  globalThis.__platform = answers;
}
