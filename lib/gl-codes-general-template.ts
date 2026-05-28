// Canonical 28-row chart of accounts for the general / non-Claros flow.
// Seeded into gl_account_map for every new non-Claros project at creation
// time (see lib/gl-codes.ts).
//
// Edit this file → re-run the seed script (or write a sync task) to propagate
// changes to existing projects. The same 28 codes are also the default list
// baked into prompts/general/gl-code-allocation-v2.md and the v2 n8n code
// node — if you add/remove a code here, mirror it there.
//
// Schema matches gl_account_map columns (project_id is added per-project at
// insert time):
//   - code (text, PK with project_id)
//   - full_name (text)
//   - parent_code (text, nullable for standalones + parents)
//   - level (int, 0 = parent/standalone, 1 = child)
//   - is_selectable (boolean, false for parents only)
//   - allocation_column (text, one of the 26 gl_code_allocations category
//     columns — nullable for parents; matches the routing in
//     running-total/general/*.code-node.js)

export type GlAccountTemplateRow = {
  code: string;
  full_name: string;
  parent_code: string | null;
  level: number;
  is_selectable: boolean;
  allocation_column: string | null;
};

export const GENERAL_GL_CODES_TEMPLATE: ReadonlyArray<GlAccountTemplateRow> = [
  // ===== Travel =====
  { code: "5000", full_name: "Travel",                              parent_code: null,   level: 0, is_selectable: false, allocation_column: null },
  { code: "5010", full_name: "Travel:Airfare",                      parent_code: "5000", level: 1, is_selectable: true,  allocation_column: "travel_others" },
  { code: "5011", full_name: "Travel:Lodging",                      parent_code: "5000", level: 1, is_selectable: true,  allocation_column: "travel_others" },
  { code: "5012", full_name: "Travel:Ground Transport",             parent_code: "5000", level: 1, is_selectable: true,  allocation_column: "travel_others" },
  { code: "5013", full_name: "Travel:Mileage",                      parent_code: "5000", level: 1, is_selectable: true,  allocation_column: "travel_others" },
  { code: "5014", full_name: "Travel:Parking & Tolls",              parent_code: "5000", level: 1, is_selectable: true,  allocation_column: "parking" },
  { code: "5015", full_name: "Travel:Travel Meals",                 parent_code: "5000", level: 1, is_selectable: true,  allocation_column: "travel_others" },
  { code: "5016", full_name: "Travel:Auto Fuel",                    parent_code: "5000", level: 1, is_selectable: true,  allocation_column: "travel_others" },
  { code: "5017", full_name: "Travel:Auto Maintenance & Repair",    parent_code: "5000", level: 1, is_selectable: true,  allocation_column: "non_contracted_repairs_and_maintenance" },

  // ===== Office & Supplies =====
  { code: "5200", full_name: "Office & Supplies",                   parent_code: null,   level: 0, is_selectable: false, allocation_column: null },
  { code: "5210", full_name: "Office & Supplies:Office Supplies",   parent_code: "5200", level: 1, is_selectable: true,  allocation_column: "office_supplies" },
  { code: "5211", full_name: "Office & Supplies:Equipment",         parent_code: "5200", level: 1, is_selectable: true,  allocation_column: "office_supplies" },
  { code: "5212", full_name: "Office & Supplies:Furniture",         parent_code: "5200", level: 1, is_selectable: true,  allocation_column: "office_supplies" },

  // ===== Software & Subscriptions =====
  { code: "5300", full_name: "Software & Subscriptions",            parent_code: null,   level: 0, is_selectable: false, allocation_column: null },
  { code: "5310", full_name: "Software & Subscriptions:Software / SaaS",                  parent_code: "5300", level: 1, is_selectable: true, allocation_column: "dues_and_subscriptions" },
  { code: "5311", full_name: "Software & Subscriptions:Professional Dues & Memberships",  parent_code: "5300", level: 1, is_selectable: true, allocation_column: "dues_and_subscriptions" },
  { code: "5312", full_name: "Software & Subscriptions:Publications & Education",         parent_code: "5300", level: 1, is_selectable: true, allocation_column: "badging_and_training" },

  // ===== Utilities & Communication =====
  { code: "5400", full_name: "Utilities & Communication",           parent_code: null,   level: 0, is_selectable: false, allocation_column: null },
  { code: "5410", full_name: "Utilities & Communication:Phone / Cellular",   parent_code: "5400", level: 1, is_selectable: true, allocation_column: "network_costs" },
  { code: "5411", full_name: "Utilities & Communication:Internet",           parent_code: "5400", level: 1, is_selectable: true, allocation_column: "network_costs" },
  { code: "5412", full_name: "Utilities & Communication:Other Utilities",    parent_code: "5400", level: 1, is_selectable: true, allocation_column: "non_contracted_repairs_and_maintenance" },

  // ===== Marketing & Advertising =====
  { code: "5500", full_name: "Marketing & Advertising",             parent_code: null,   level: 0, is_selectable: false, allocation_column: null },
  { code: "5510", full_name: "Marketing & Advertising:Advertising",                parent_code: "5500", level: 1, is_selectable: true, allocation_column: "other" },
  { code: "5511", full_name: "Marketing & Advertising:Marketing Materials",        parent_code: "5500", level: 1, is_selectable: true, allocation_column: "other" },
  { code: "5512", full_name: "Marketing & Advertising:Conferences & Trade Shows",  parent_code: "5500", level: 1, is_selectable: true, allocation_column: "badging_and_training" },

  // ===== Professional Services =====
  { code: "5600", full_name: "Professional Services",               parent_code: null,   level: 0, is_selectable: false, allocation_column: null },
  { code: "5610", full_name: "Professional Services:Legal & Accounting",        parent_code: "5600", level: 1, is_selectable: true, allocation_column: "other" },
  { code: "5611", full_name: "Professional Services:Consulting & Contractors",  parent_code: "5600", level: 1, is_selectable: true, allocation_column: "staffing_expense" },

  // ===== Other Operating =====
  { code: "5700", full_name: "Other Operating",                     parent_code: null,   level: 0, is_selectable: false, allocation_column: null },
  { code: "5710", full_name: "Other Operating:Bank & Merchant Fees",  parent_code: "5700", level: 1, is_selectable: true, allocation_column: "merchant_deposit_credits" },
  { code: "5711", full_name: "Other Operating:Insurance",             parent_code: "5700", level: 1, is_selectable: true, allocation_column: "other" },
  { code: "5712", full_name: "Other Operating:Taxes & Licenses",      parent_code: "5700", level: 1, is_selectable: true, allocation_column: "licenses_and_permits" },
  { code: "5713", full_name: "Other Operating:Other",                 parent_code: "5700", level: 1, is_selectable: true, allocation_column: "other" },

  // ===== Standalones (no parent — direct classification targets) =====
  { code: "5800", full_name: "Rent / Office / Coworking",   parent_code: null, level: 0, is_selectable: true, allocation_column: "other" },
  { code: "5900", full_name: "Personal / Non-Business",     parent_code: null, level: 0, is_selectable: true, allocation_column: "other" }
];
