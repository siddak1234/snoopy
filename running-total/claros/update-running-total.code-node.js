// Updated Running Total: routes each line's Amount to its GL_Account's column.
// Each GL code goes to its own column (e.g. 5105 → delivery_and_escort_fees, 5020 → food_costs).
// Negative amounts (refunds) flow naturally and reduce their category.
//
// Behavior:
// - Only columns with new lines get updated (existing + delta).
// - Columns with no new lines pass through unchanged: null stays null, 0 stays 0, numbers stay.
// - total is always recalculated.
// - invoice_count is handled upstream by Edit Fields (not touched here).

const accountToColumn = {
  // liquor
  5070: 'liquor', 5080: 'liquor', 5090: 'liquor',
  // beer
  5050: 'beer',
  // wine
  5100: 'wine',
  // non_alcoholic_drinks
  5140: 'non_alcoholic_drinks', 5210: 'non_alcoholic_drinks', 51020: 'non_alcoholic_drinks',
  // food_costs
  5015: 'food_costs', 5020: 'food_costs', 5141: 'food_costs', 5220: 'food_costs',
  51015: 'food_costs', 51016: 'food_costs', 51017: 'food_costs',
  51018: 'food_costs', 51019: 'food_costs', 51021: 'food_costs',
  // bar_supplies
  5150: 'bar_supplies',
  // paper_bar_supplies
  5155: 'paper_bar_supplies',
  // serviceware
  5021: 'serviceware', 5170: 'serviceware', 5171: 'serviceware',
  // office_supplies
  5186: 'office_supplies',
  // cleaning_janitorial_supplies
  5022: 'cleaning_janitorial_supplies', 5175: 'cleaning_janitorial_supplies',
  // non_contracted_repairs_and_maintenance
  5023: 'non_contracted_repairs_and_maintenance',
  5092: 'non_contracted_repairs_and_maintenance',
  5111: 'non_contracted_repairs_and_maintenance',
  5145: 'non_contracted_repairs_and_maintenance',
  // maintenance_agreement
  5148: 'maintenance_agreement',
  // taxes
  5024: 'taxes', 5106: 'taxes', 5107: 'taxes',
  // travel_others
  5025: 'travel_others', 5160: 'travel_others', 5165: 'travel_others',
  5166: 'travel_others', 5185: 'travel_others', 5190: 'travel_others',
  // parking
  5125: 'parking',
  // employee_morale
  5108: 'employee_morale',
  // licenses_and_permits
  5014: 'licenses_and_permits', 5026: 'licenses_and_permits', 5127: 'licenses_and_permits',
  // badging_and_training
  5120: 'badging_and_training', 5126: 'badging_and_training', 5146: 'badging_and_training',
  // network_costs
  5115: 'network_costs', 5187: 'network_costs',
  // uniforms
  5135: 'uniforms',
  // dues_and_subscriptions
  5147: 'dues_and_subscriptions',
  // delivery_and_escort_fees
  5055: 'delivery_and_escort_fees', 5105: 'delivery_and_escort_fees',
  // staffing_expense
  5009: 'staffing_expense', 5010: 'staffing_expense', 5011: 'staffing_expense',
  5012: 'staffing_expense', 5013: 'staffing_expense', 5027: 'staffing_expense',
  5180: 'staffing_expense',
  // merchant_deposit_credits
  5189: 'merchant_deposit_credits',
  // reimbursements
  5001: 'reimbursements', 5130: 'reimbursements',
  // other (catch-all)
  5000: 'other', 5028: 'other', 5087: 'other', 5099: 'other', 5110: 'other',
  5181: 'other', 5188: 'other', 5191: 'other', 5192: 'other', 5200: 'other',
  5205: 'other', 5215: 'other', 5225: 'other', 5230: 'other', 5235: 'other',
  5240: 'other'
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

const first = $input.first().json;

// Per-column deltas — only columns with new lines get touched
const deltas = {};
for (const col of categoryColumns) deltas[col] = 0;
const touched = new Set();

const existingTotal = Number(first.total) || 0;
let addedAmount = 0;

for (const item of $input.all()) {
  const amount = Number(item.json.Amount);
  if (Number.isNaN(amount)) continue;

  const glAccount = Number(item.json.GL_Account);
  const column = accountToColumn[glAccount];

  if (column) {
    deltas[column] += amount;
    touched.add(column);
  }

  addedAmount += amount;
}

// Round each touched delta to cents
for (const col of categoryColumns) {
  deltas[col] = Math.round(deltas[col] * 100) / 100;
}

// Build output: only update touched columns, preserve everything else exactly
const output = {};
for (const col of categoryColumns) {
  if (touched.has(col)) {
    const prev = Number(first[col]) || 0;
    output[col] = Math.round((prev + deltas[col]) * 100) / 100;
  } else {
    output[col] = first[col]; // null stays null, 0 stays 0, numbers stay
  }
}

const newTotal = Math.round((existingTotal + addedAmount) * 100) / 100;

return [{
  json: {
    start_date: first.start_date,
    end_date: first.end_date,
    lounge_code: first.lounge_code,
    previous_total: existingTotal,
    added_amount: Math.round(addedAmount * 100) / 100,
    total: newTotal,
    ...output
  }
}];