// From snoopy-backend docs/openapi/automations.yaml, sha256 b1ba58ec450021cbfa83fc21ba569e126cd7136c23158835dedfac4904ea4a95.
// Regenerate with `npm run generate:platform-contracts`; never edit by hand.
/** A JSON value's basic type, as `typeof` names it, with "array" and "null" told apart. */
export type BlockKind =
  "string" | "number" | "boolean" | "object" | "array" | "null";

/** A required field: the basic types it may have; its one value, where the schema gives a `const`; an object's own required fields; an array's items. */
export type BlockField = {
  kinds: readonly BlockKind[];
  value?: string | number | boolean;
  fields?: { readonly [name: string]: BlockField };
  items?: BlockField;
};

/** Each block type's required fields, `type` among them (the `Block` union's `required`). */
export const BLOCK_REQUIRED: {
  readonly [type: string]: { readonly [name: string]: BlockField };
} = {
  text: {
    type: { kinds: ["string"], value: "text" },
    text: { kinds: ["string"] },
  },
  metric: {
    type: { kinds: ["string"], value: "metric" },
    items: {
      kinds: ["array"],
      items: {
        kinds: ["object"],
        fields: { label: { kinds: ["string"] }, value: { kinds: ["string"] } },
      },
    },
  },
  badge: {
    type: { kinds: ["string"], value: "badge" },
    text: { kinds: ["string"] },
  },
  table: {
    type: { kinds: ["string"], value: "table" },
    columns: { kinds: ["array"], items: { kinds: ["object"] } },
    rows: {
      kinds: ["array"],
      items: {
        kinds: ["object"],
        fields: { cells: { kinds: ["array"], items: { kinds: ["string"] } } },
      },
    },
  },
  list: {
    type: { kinds: ["string"], value: "list" },
    items: {
      kinds: ["array"],
      items: { kinds: ["object"], fields: { title: { kinds: ["string"] } } },
    },
  },
  section: {
    type: { kinds: ["string"], value: "section" },
    title: { kinds: ["string"] },
    blocks: { kinds: ["array"], items: { kinds: ["object"] } },
  },
  file: {
    type: { kinds: ["string"], value: "file" },
    title: { kinds: ["string"] },
    open: { kinds: ["object"], fields: { target: { kinds: ["string"] } } },
  },
  link: {
    type: { kinds: ["string"], value: "link" },
    title: { kinds: ["string"] },
    url: { kinds: ["string"] },
  },
  timeline: {
    type: { kinds: ["string"], value: "timeline" },
    items: {
      kinds: ["array"],
      items: {
        kinds: ["object"],
        fields: { title: { kinds: ["string"] }, state: { kinds: ["string"] } },
      },
    },
  },
  questions: {
    type: { kinds: ["string"], value: "questions" },
    form: { kinds: ["object"], fields: { kind: { kinds: ["string"] } } },
  },
  image: {
    type: { kinds: ["string"], value: "image" },
    alt: { kinds: ["string"] },
    open: { kinds: ["object"], fields: { target: { kinds: ["string"] } } },
    file: {
      kinds: ["object"],
      fields: {
        id: { kinds: ["string"] },
        filename: { kinds: ["string"] },
        contentType: { kinds: ["string"] },
        format: { kinds: ["string"] },
        sizeBytes: { kinds: ["number"] },
        pages: { kinds: ["number", "null"] },
      },
    },
  },
  chart: {
    type: { kinds: ["string"], value: "chart" },
    kind: { kinds: ["string"] },
    title: { kinds: ["string"] },
    alt: { kinds: ["string"] },
    points: {
      kinds: ["array"],
      items: {
        kinds: ["object"],
        fields: {
          label: { kinds: ["string"] },
          value: { kinds: ["number"] },
          text: { kinds: ["string"] },
        },
      },
    },
  },
  group: {
    type: { kinds: ["string"], value: "group" },
    title: { kinds: ["string"] },
    sections: {
      kinds: ["array"],
      items: {
        kinds: ["object"],
        fields: {
          type: { kinds: ["string"], value: "section" },
          title: { kinds: ["string"] },
          blocks: { kinds: ["array"], items: { kinds: ["object"] } },
        },
      },
    },
  },
};
