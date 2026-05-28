# Claros — Line Item Allocation Prompt

> **Model:** Gemini (called from the n8n `Line Item Allocation` workflow's Code node, which packages this text + the PDF binary into a single Gemini API request).
>
> **Roles:** one `user` message. The text below is the `text` part; the PDF is attached as `inline_data` in the same message. No separate system prompt.
>
> **n8n binding:** the Code node loads the binary, base64-encodes it, then assigns this text to `const prompt = \`…\`` inside the same request body. When syncing edits back, escape any backticks (`` ` `` → `` \` ``) and the `${}` sequences if you add any.

---

You are extracting structured accounting line items from a PDF invoice or receipt bundle.

Read the document carefully and return EXACTLY ONE valid JSON object matching the required schema.

This is a highly sensitive accounting workflow. Accuracy is critical.

## Strict Rules

- Return ONLY a valid JSON object.
- Do NOT include markdown.
- Do NOT include `` ```json `` or `` ``` `` markers.
- Do NOT include explanations outside the JSON.
- Do NOT include extra keys.
- The only field that may be null is `line_notes`. All other fields must always be populated — use derivation rules for numeric fields and inference rules for category and subcategory.
- Return an empty array ONLY if the document contains NO financial information whatsoever (e.g., blank page, cover letter, packing slip with no prices, non-financial document). If ANY dollar amount, payment amount, total, or line item is visible anywhere on the document, you MUST extract at least one line item. See FALLBACK EXTRACTION RULE for documents that show totals but no itemized rows.

## Task

Extract all item-level financial rows from the document.

For each line item, return:

- `receipt_group`
- `line_index`
- `item`
- `qty`
- `cu_price`
- `amount`
- `currency`
- `category`
- `subcategory`
- `extraction_confidence`
- `line_notes`

## Line Item Rules

1. A line item is any explicit financial row shown on the invoice or receipt that represents:
   - a purchased product
   - a purchased service
   - a delivery/shipping/freight/courier/escort fee
   - a tax row
   - a surcharge or service fee
   - a discount or credit row
2. Ignore only document summary rows such as:
   - subtotal
   - grand total
   - total
   - amount due
   - previous balance
   - balance forward
   - payment
   - tender
   - card payment
   - change
3. Delivery fee, shipping fee, freight, courier fee, escort fee, tax, surcharge, service fee, discount, and credit should be extracted as separate line items when explicitly shown as their own rows.
4. Merge wrapped or multi-line descriptions into one line item when they belong to the same row.
5. `line_index` should restart within each `receipt_group` if needed, based on the natural order of items shown.
6. `receipt_group` should be:
   - 1 if the document contains only one receipt/invoice item section
   - 1, 2, 3, etc. if multiple distinct receipt or purchase sections appear in the same PDF
7. `qty` must be numeric and must NEVER be null. Derivation rules:
   - If the document shows an explicit quantity field, use that value.
   - If only `amount` and `cu_price` are visible, derive `qty = amount / cu_price`.
   - If only `amount` is visible with no quantity or unit price, default `qty` to 1.
   - For discount or credit rows, default `qty` to 1 unless explicitly shown otherwise.
   - For zero-amount rows, default `qty` to 1 unless explicitly shown otherwise.
8. `cu_price` must be numeric and must NEVER be null. Derivation rules:
   - If the document shows an explicit unit price, use that value.
   - If only `amount` and `qty` are visible, derive `cu_price = amount / qty`.
   - If only `amount` is visible with no unit price or quantity, set `cu_price = amount` (implies `qty = 1`).
   - For discount or credit rows with negative amounts, set `cu_price` to 0.
   - For zero-amount rows, set `cu_price` to 0.
9. `amount` must be numeric and must NEVER be null. Derivation rules:
   - If the document shows an explicit line total, use that value.
   - If `qty` and `cu_price` are both visible or determined, derive `amount = qty × cu_price`.
   - If only a single numeric value is visible on the row AND `qty` is 1 or not shown, treat the single value as the `amount`.
   - If only a single numeric value is visible on the row AND `qty` is explicitly shown as greater than 1, apply SINGLE PRICE + QUANTITY INTERPRETATION rules (see below) before assigning `amount`.
   - For zero-value rows, set `amount` to 0.
10. `currency` should be the three-letter ISO currency code identified from the document. Default to `"USD"` if the document shows `$` or no explicit currency indicator.
11. `category` and `subcategory` MUST always be assigned for every line item. If the document explicitly labels a category, use that. Otherwise, infer the most appropriate category and subcategory from the item description. Never return null for `category` or `subcategory`.
12. `extraction_confidence` must be an integer from 0 to 100 indicating how confident the extraction is for that line item. This score reflects the overall reliability of the extracted row — considering item description clarity, numeric value visibility, and whether derivation was needed. Scoring guidance:
    - **90–100:** All fields clearly visible and unambiguous on the document. No derivation needed.
    - **70–89:** Most fields visible but one or more values were derived, partially obscured, or slightly ambiguous. Category or subcategory required inference but was straightforward.
    - **50–69:** Significant uncertainty — item description unclear, numeric values guessed or derived from limited context, or category assignment was a judgment call.
    - **Below 50:** Very low confidence — row barely legible, heavily inferred, or questionable whether it is a valid line item.
13. `line_notes` may briefly explain uncertainty, merged wrapped text, missing pricing fields, derivation method used for numeric fields, or whether the row is a fee/tax/discount line. When `extraction_confidence` is below 90, `line_notes` should briefly explain why.
14. Continue extracting all rows within the itemized section until the full section is exhausted.
    - Do not stop extraction based on spacing, layout changes, or perceived table boundaries.
15. Evaluate rows consistently regardless of position.
    - Rows at the bottom of a page or near page breaks must be treated the same as rows at the top or middle.
16. A row is a valid line item if it contains a description and an associated numeric value (`qty`, price, or `amount`), even if formatting differs from other rows.
17. Tax rows are always valid line items when explicitly shown.
    - Do not treat tax rows as summary rows.
18. Discount or credit rows are always valid line items when explicitly shown.
    - Do not distribute or allocate discounts across other line items.
    - Discount and credit amounts must always be represented as negative numbers (e.g., `-60.79`), regardless of how the document displays them.
19. If a row reasonably appears to be part of the itemized section, include it.
    - Prefer including the row with appropriate `line_notes` rather than omitting it.
20. **ARITHMETIC VALIDATION:** After extracting each line item, verify that `qty × cu_price = amount` (within rounding tolerance of ±0.02). If the calculated product does not match the extracted `amount`, trust the document's explicit `amount` value first, then re-derive the other fields to make the equation consistent. If `qty` and `amount` are both explicitly shown on the document, derive `cu_price = amount / qty`. If `cu_price` and `amount` are both explicitly shown, derive `qty = amount / cu_price`. Always ensure internal consistency across `qty`, `cu_price`, and `amount`. Note any corrections in `line_notes`.

## Category and Subcategory Classification Rules

Every line item must be assigned a `category` and `subcategory`. Use the following taxonomy. If the document explicitly labels a category, use that label. Otherwise, infer from the item description.

Approved categories and their subcategories:

**Food & Non Alcoholic Beverage:**
Breads, Dairy, Dry Goods, Fruits, Vegetables, Meat & Seafood, Frozen, Condiments, Dessert, Soups, Produce, Snacks, Coffee/Tea, Juices, Soft Drink, Mixer, Other

**Alcoholic Beverages:**
Beer, Wine, Liquor, Other

**Supplies:**
Bar, Paper Goods, Servicewares, Equipment, Other

**Janitorial / Cleaning:**
Cleaning Chemicals, Paper Products, Trash / Liners, Other

**Services:**
Delivery, Courier, Escort, Maintenance, Pest Control, Telecom, Other

**Fees & Charges:**
Sales Tax, Use Tax, Surcharge, Service Fee, Other

**Discount / Credit:**
Discount, Credit, Rebate, Other

**Travel:**
Airfare, Lodging, Ground Transport, Parking, Mileage, Tolls, Other

**Licenses & Permits:**
Software / SaaS, Badges / Clearance, Liquor License, Other

**Labor:**
Contract Labor, Direct Labor, Payroll, Uniforms, Other

**Other:**
Other

### Classification guidance

- Classify based on what the item actually is, not what vendor it came from.
- Food items that are edible (bread, meat, cheese, vegetables, snacks) belong in `Food & Non Alcoholic Beverage` with the appropriate food subcategory.
- Beverages that are non-alcoholic (coffee, tea, juice, soda, water, syrup, mixer) belong in `Food & Non Alcoholic Beverage` with a beverage subcategory (`Coffee/Tea`, `Juices`, `Soft Drink`, `Mixer`).
- Alcoholic items must be classified by type: `Beer`, `Wine`, or `Liquor`.
- Tax lines → `Fees & Charges` / `Sales Tax`.
- Discount or credit lines → `Discount / Credit` / `Discount` or `Credit`.
- Delivery fee lines → `Services` / `Delivery`.
- Cups, lids, napkins, plates, cutlery, to-go containers → `Supplies` / `Servicewares`.
- Bar tools, garnish supplies, bar consumables → `Supplies` / `Bar`.
- Cleaning chemicals, sanitizer, soap, trash bags → `Janitorial / Cleaning` / appropriate subcategory.
- When uncertain between two categories, choose the most reasonable one and note the ambiguity briefly in `line_notes`.
- If the item could reasonably belong to two different categories or subcategories, choose the broader or more common one and note "category uncertain" briefly in `line_notes`. Do not force a narrow subcategory when the item description is ambiguous.

### Examples

- `"TEA 6 FLAVOR ASSORTMENT BAGS 28ct"` → category: `"Food & Non Alcoholic Beverage"`, subcategory: `"Coffee/Tea"`
- `"egg hard boiled 25lb"` → category: `"Food & Non Alcoholic Beverage"`, subcategory: `"Dairy"`
- `"BREAD FRENCH BAGUETTE"` → category: `"Food & Non Alcoholic Beverage"`, subcategory: `"Breads"`
- `"CARROT SHRD FRESH 1lb"` → category: `"Food & Non Alcoholic Beverage"`, subcategory: `"Vegetables"`
- `"TURKEY BREAST SLICED"` → category: `"Food & Non Alcoholic Beverage"`, subcategory: `"Meat & Seafood"`
- `"SYRUP HZLNT ITLN STYL"` → category: `"Food & Non Alcoholic Beverage"`, subcategory: `"Mixer"`
- `"CREAMER HALF & HALF"` → category: `"Food & Non Alcoholic Beverage"`, subcategory: `"Dairy"`
- `"SMIRNOFF VODKA 1.75L"` → category: `"Alcoholic Beverages"`, subcategory: `"Liquor"`
- `"CABERNET SAUVIGNON 750ML"` → category: `"Alcoholic Beverages"`, subcategory: `"Wine"`
- `"SIERRA NEVADA PALE ALE"` → category: `"Alcoholic Beverages"`, subcategory: `"Beer"`
- `"Sales Tax"` → category: `"Fees & Charges"`, subcategory: `"Sales Tax"`
- `"Delivery Fee"` → category: `"Services"`, subcategory: `"Delivery"`
- `"Discount -10%"` → category: `"Discount / Credit"`, subcategory: `"Discount"`
- `"CUPS 16OZ CLEAR PLASTIC"` → category: `"Supplies"`, subcategory: `"Servicewares"`
- `"SANITIZER HAND GEL"` → category: `"Janitorial / Cleaning"`, subcategory: `"Cleaning Chemicals"`

## Quantity Interpretation Rules

1. Use the document's primary row quantity field as the default `qty`.
2. If the invoice shows a dedicated quantity column such as `Qty`, `Quantity`, `Units`, `Ordered`, `Delivered`, `Ord`, `Dlv`, `CS`, `EA`, or another explicit row-level quantity field, use that row quantity as `qty`.
3. Do NOT automatically replace the row quantity with an embedded pack count, bottle count, case count, inner pack count, or size metadata found inside the description.
4. Pack information such as `PACK:12`, `12 x 750ML`, `24 CT`, `CASE OF 6`, `6/1.75L`, or similar packaging notation should be treated as packaging detail unless the document clearly uses that number as the actual row quantity being sold.
5. If the row quantity reflects cases, packs, boxes, or another selling unit, preserve that row quantity in `qty` rather than converting it to inner units.
6. If the document clearly presents both a row quantity and packaging metadata, preserve the row quantity in `qty` and mention the packaging detail briefly in `line_notes` when helpful.
7. Only use the embedded pack count as `qty` when the document clearly indicates that the pack count itself is the sold row quantity and there is no separate row-level quantity field that governs the line.
8. Do NOT multiply `qty` by pack size unless the document explicitly requires that interpretation.
9. If the unit price shown is per inner unit rather than per row selling unit, still preserve the document's visible `qty` and `amount`, and use `line_notes` to note the quantity or pricing ambiguity when necessary.
10. If a row shows ordered/delivered style quantities such as `1/1`, use the delivered or row-level explicit quantity shown by the document as `qty` unless the invoice clearly indicates another numeric field is the operative line quantity.
11. When quantity interpretation is ambiguous, prefer the invoice-native row quantity over a normalized inferred quantity and briefly note the ambiguity in `line_notes`.

## Single Price + Quantity Interpretation Rules

When a document shows only ONE dollar value per product row alongside a quantity field, you must determine whether the displayed price represents the per-unit price or the line total. Misinterpreting this leads to incorrect `cu_price` and `amount` values.

Decision process:

1. If the document shows BOTH a clearly labeled unit price column AND a clearly labeled line total or extended price column, use each value directly. No interpretation is needed.

2. If only ONE dollar value is shown per product row alongside a quantity greater than 1, determine the price type using these steps:
   a. Check whether the document labels the price column. Labels such as `Unit Price`, `Price Each`, `Each`, or `Per Unit` indicate per-unit pricing. Labels such as `Amount`, `Total`, `Ext Price`, `Line Total`, or `Extended` indicate line total pricing.
   b. If no clear label exists, cross-validate against the document's order total, subtotal, or grand total if one is visible:
      - Compute `candidate_line_total = displayed_price × qty`.
      - Sum `candidate_line_total` across all product rows plus any visible tax, shipping, fee, or discount rows.
      - If the sum ≈ order total (within ±$0.10), then the displayed price is the PER-UNIT price. Set `cu_price = displayed_price` and `amount = qty × cu_price`.
      - If instead the sum of `displayed_price` values (without multiplication) plus tax/shipping/fees ≈ order total, then the displayed price is the LINE TOTAL. Set `amount = displayed_price` and derive `cu_price = amount / qty`.
   c. If no order total or subtotal is available for cross-validation, apply vendor format heuristics:
      - Amazon, Walmart, Target, Best Buy, and similar retail order confirmations that show a single dollar amount per product row with a separate `Qty` field almost always display the PER-UNIT price. Default to treating the displayed price as `cu_price` and derive `amount = qty × cu_price`.
      - Foodservice distributors (Sysco, US Foods, etc.) that show a single dollar amount per row with a case quantity almost always display the LINE TOTAL (extended price). Default to treating the displayed price as `amount` and derive `cu_price = amount / qty`.
   d. If the vendor is unrecognized and no cross-validation is possible, default to treating the displayed price as the PER-UNIT price when `qty > 1`, and note `"price interpretation uncertain — defaulted to per-unit"` in `line_notes`.

3. After determining the price type and assigning `cu_price` and `amount`, apply ARITHMETIC VALIDATION (LINE ITEM RULE 20) to confirm `qty × cu_price = amount`. If inconsistent, re-derive using the hierarchy: trust the document's explicit values first, then derive the missing field.

4. Always note the interpretation method briefly in `line_notes` when the price type was inferred rather than explicitly labeled (e.g., `"single price treated as per-unit based on order total cross-validation"` or `"Amazon format — displayed price treated as per-unit"`).

## Fallback Extraction Rule

This rule applies when the document contains NO itemized product or service rows but DOES show any financial amount such as a total, subtotal, amount charged, payment amount, or balance. You MUST still extract at least one line item. NEVER return an empty array when any dollar amount is visible on the document.

1. Create a single line item using the most specific pre-tax, pre-tip amount visible on the document. Prefer subtotal or base amount over grand total. If only a grand total is visible, use that.
2. Set `item` to the vendor or merchant name if visible on the document (e.g., `"Blue Goose"`, `"Walmart"`, `"Shell Gas Station"`). If no vendor name is visible, set `item` to `"Unitemized Purchase"`.
3. Set `qty` to 1, `cu_price` to the chosen amount, and `amount` to the same value.
4. If a tip is shown as a separate printed or handwritten value, extract it as an additional line item with `item` set to `"Tip"`, category `"Fees & Charges"`, subcategory `"Service Fee"`.
5. If tax is shown as a separate value, extract it as an additional line item with `item` set to `"Sales Tax"`, category `"Fees & Charges"`, subcategory `"Sales Tax"`.
6. If shipping or delivery is shown as a separate value, extract it as an additional line item with `item` set to `"Shipping"` or `"Delivery Fee"`, category `"Services"`, subcategory `"Delivery"`.
7. Infer category and subcategory for the primary line item from the vendor name or any contextual clues on the document:
   - Restaurant, bar, cafe, grill, diner, bistro, pub, tavern, brewery, or food-related vendor names → `"Food & Non Alcoholic Beverage"` / `"Other"`.
   - Gas station or fuel stop → `"Travel"` / `"Ground Transport"`.
   - Hotel or motel → `"Travel"` / `"Lodging"`.
   - If no vendor context is available, use `"Other"` / `"Other"`.
8. Set `extraction_confidence` between 50 and 69 for the primary line item and note `"no itemized rows — extracted from document total"` in `line_notes`.
9. This rule applies to credit card slips, payment receipts, merchant copies, signed receipts, and any document that shows a payment or charge amount without an itemized breakdown of individual products or services.

## Important

- Do not invent items.
- Always infer category and subcategory from the item description when not explicitly provided by the document. Never return null for these fields.
- `qty`, `cu_price`, and `amount` must NEVER be null. If a value is not explicitly shown on the document, derive it from the other two fields using the derivation rules in LINE ITEM RULES 7, 8, and 9. If only one numeric value is visible, treat it as the `amount` and default `qty` to 1 and `cu_price` to that `amount`. If the row is a discount, credit, or zero-value line, set `cu_price` to 0. A reasonable derivation is always better than null in this accounting workflow. If a derivation was applied, note it briefly in `line_notes`.
- `extraction_confidence` must NEVER be null. Always assign an integer from 0 to 100 based on the scoring guidance in LINE ITEM RULE 12.
- Do not duplicate the same line item multiple times.
- If an item row has description only but no visible numeric values at all, set `qty` to 1, `cu_price` to 0, and `amount` to 0, and note `"no numeric values visible"` in `line_notes`.
- If a fee or tax is explicitly shown as a row, extract it as its own line item.
- If a discount or credit is explicitly shown as a row, extract it as its own line item and always represent the `amount` as a negative number (e.g., `-60.79`).
- Use the document itself as the ground source of truth.
- Prefer explicit row structure over inferred normalization.
- Preserve invoice-native quantity semantics unless the document clearly indicates the quantity should be interpreted another way.
- Do not convert case quantities to bottle quantities, pack quantities to unit quantities, or box quantities to inner counts unless the document explicitly presents the inner count as the actual row quantity.
- If packaging metadata is important to understanding the line, include it briefly in `line_notes` rather than replacing the row quantity with it.
- If a line includes both a quantity field and packaging notation, the quantity field is usually the primary `qty` and the packaging notation is usually supporting detail.
- For receipts that show quantity patterns like `"8 @ 33.88"`, use the explicit multiplier quantity as `qty` when clearly shown.
- For invoices that show case-style rows with packaging details in the description, keep the case or row quantity as `qty` unless the document clearly states the individual-unit quantity is the operative row quantity.
- Do not exclude rows based on position in the document.
- Do not treat tax, discount, or fee rows as summary rows.
- Any row in the itemized section with a description and numeric value must be evaluated as a line item.

## Required JSON Output Format

```json
{
  "line_items": [
    {
      "receipt_group": 1,
      "line_index": 1,
      "item": null,
      "qty": null,
      "cu_price": null,
      "amount": null,
      "currency": "USD",
      "category": null,
      "subcategory": null,
      "extraction_confidence": null,
      "line_notes": null
    }
  ]
}
```
