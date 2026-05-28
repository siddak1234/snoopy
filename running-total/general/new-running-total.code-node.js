// New Running Total (General): creates fresh totals from input lines for a brand-new row.
// Routes each line's Amount to its GL_Account's column.
// Negative amounts (refunds) flow naturally and reduce their category.
//
// Behavior:
// - Columns with new lines get populated with the sum of those lines.
// - Columns with no lines this run → output as null (no zero clutter for untouched categories).
// - total is the sum of all line amounts.
//
// IMPORTANT: This routes the general v2 GL codes (prompts/general/gl-code-allocation-v2.md)
// to the EXISTING 26 category columns in the gl_code_allocations table. Some general
// categories don't have a perfect Claros-flavored column; those route to the closest fit
// and ultimately to 'other' when no semantic match exists.
// Parent codes (5000/5200/5300/5400/5500/5600/5700) are never supposed to be returned by
// the classifier per the prompt's strict guardrails — they fall through to the parent's
// primary bucket as a defensive catch-all.

const accountToColumn = {
  // ===== Travel =====
  5000: 'travel_others',                          // parent — defensive
  5010: 'travel_others',                          // Airfare
  5011: 'travel_others',                          // Lodging
  5012: 'travel_others',                          // Ground Transport (taxi, rideshare, rental, train)
  5013: 'travel_others',                          // Mileage
  5014: 'parking',                                // Parking & Tolls (Claros has dedicated column)
  5015: 'travel_others',                          // Travel Meals (matches Claros 5185)
  5016: 'travel_others',                          // Auto Fuel
  5017: 'non_contracted_repairs_and_maintenance', // Auto Maintenance & Repair

  // ===== Office & Supplies =====
  5200: 'office_supplies', // parent — defensive
  5210: 'office_supplies', // Office Supplies (direct match)
  5211: 'office_supplies', // Equipment (laptops, peripherals) — best-fit single column
  5212: 'office_supplies', // Furniture — best-fit single column

  // ===== Software & Subscriptions =====
  5300: 'dues_and_subscriptions', // parent — defensive
  5310: 'dues_and_subscriptions', // Software / SaaS (recurring subscriptions)
  5311: 'dues_and_subscriptions', // Professional Dues & Memberships (direct match)
  5312: 'badging_and_training',   // Publications & Education (courses, cert exams)

  // ===== Utilities & Communication =====
  5400: 'network_costs',                          // parent — defensive
  5410: 'network_costs',                          // Phone / Cellular (matches Claros 5115)
  5411: 'network_costs',                          // Internet (matches Claros 5187)
  5412: 'non_contracted_repairs_and_maintenance', // Other Utilities (Claros 5092 routes here)

  // ===== Marketing & Advertising =====
  5500: 'other',                  // parent — defensive
  5510: 'other',                  // Advertising — no Claros equivalent
  5511: 'other',                  // Marketing Materials — no Claros equivalent
  5512: 'badging_and_training',   // Conferences & Trade Shows (professional development)

  // ===== Professional Services =====
  5600: 'other',              // parent — defensive
  5610: 'other',              // Legal & Accounting — no Claros equivalent
  5611: 'staffing_expense',   // Consulting & Contractors (matches Claros 5009 Contract Labor)

  // ===== Other Operating =====
  5700: 'other',                       // parent — defensive
  5710: 'merchant_deposit_credits',    // Bank & Merchant Fees (matches Claros 5189)
  5711: 'other',                       // Insurance — Claros splits across other/staffing
  5712: 'licenses_and_permits',        // Taxes & Licenses (mostly licenses; sales tax loses granularity)
  5713: 'other',                       // Other (catch-all → catch-all)

  // ===== Standalones =====
  5800: 'other',  // Rent / Office / Coworking — no Claros equivalent
  5900: 'other'   // Personal / Non-Business — catch-all (review-needed flag)
};

const categoryColumns = [
  'liquor', 'beer', 'wine', 'non_alcoholic_drinks', 'food_costs',
  'bar_supplies', 'office_supplies', 'serviceware', 'paper_bar_supplies',
  'cleaning_janitorial_supplies', 'non_contracted_repairs_and_maintenance',
  'maintenance_agreement', 'taxes', 'travel_others',
  'parking', 'employee_morale', 'licenses_and_permits',
  'badging_and_training', 'network_costs',
  'uniforms', 'dues_and_subscriptions', 'delivery_and_escort_fees',
  'staffing_expense', 'merchant_deposit_credits', 'reimbursements', 'other'
];

// Per-column sums — only columns with lines get populated
const sums = {};
for (const col of categoryColumns) sums[col] = 0;
const touched = new Set();

let total = 0;
let count = 0;

for (const item of $input.all()) {
  const amount = Number(item.json.Amount);
  if (Number.isNaN(amount)) continue;

  const glAccount = Number(item.json.GL_Account);
  const column = accountToColumn[glAccount];

  if (column) {
    sums[column] += amount;
    touched.add(column);
  }

  total += amount;
  count += 1;
}

// Round each touched sum to cents
for (const col of categoryColumns) {
  sums[col] = Math.round(sums[col] * 100) / 100;
}

// Build output: only populate touched columns, leave others as null
const output = {};
for (const col of categoryColumns) {
  output[col] = touched.has(col) ? sums[col] : null;
}

total = Math.round(total * 100) / 100;

const first = $input.first().json;

return [{
  json: {
    start_date: first.start_date,
    end_date: first.end_date,
    lounge_code: first.lounge_code,
    total,
    line_count: count,
    ...output
  }
}];
