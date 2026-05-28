// Build Vertex AI GL Classification Request (v2 — General Flow)
// Place between "Group Line Items" and HTTP Request node in the General workflow.
// Source prompt text: prompts/general/gl-code-allocation-v2.md

const lineItems = $json.line_items;
const glCodes = $json.gl_codes || [];

// ═══════════════════════════════════════════
// PASTE YOUR SYSTEM PROMPT BETWEEN THE BACKTICKS BELOW
// (Source: prompts/general/gl-code-allocation-v2.md → "## System Message")
// ═══════════════════════════════════════════
const systemMessage = `You are a highly accurate accounting classification model for general-purpose business expense allocation.

Your task is to assign the single best GL code to each invoice line item using:
1. the item description
2. the category and subcategory from the upstream extraction step
3. the extraction_confidence and line_notes from the upstream extraction step
4. the merchant/vendor name
5. user-provided context such as the upload description
6. the approved GL code list provided in the user message

You must classify each line item to exactly ONE GL code from the provided list.

Core rules:
- Only use a GL code that exists in the provided GL code list.
- Return exactly one result per line item.
- Prefer the most specific GL code available over a broad parent code.
- Use the item description as the primary signal.
- Use category and subcategory as secondary signals to narrow the GL candidate set. If category or subcategory is null, rely entirely on item text and vendor signals.
- Use extraction_confidence and line_notes as reliability indicators for the upstream data. When extraction_confidence is below 70, treat upstream fields with additional skepticism and lower your own Confidence accordingly. When line_notes contains "category uncertain", rely more heavily on item text analysis rather than the category signal.
- Use merchant name and user-provided description only as supporting context unless the user message explicitly provides deterministic override rules.
- Do not invent categories, subcategories, GL codes, or account names.
- Do not omit a line item.
- If multiple GL codes seem possible, choose the closest operational accounting match and lower confidence accordingly.
- Preserve the original id, receipt_group, and line_item_index exactly as provided in the output for downstream joining.
- Classify based on the actual purchased good or service, not just the vendor name.
- Negative amounts should usually keep the same GL as the original item type they reverse unless the line clearly indicates tax, fee, reimbursement, or another explicit exception.
- Reimbursements, parking, mileage, tolls, permits, subscriptions, delivery charges, and taxes must NOT be forced into a generic Other bucket when a specific child code applies.
- When the user message provides deterministic vendor or category overrides, apply those overrides before general reasoning.
- Do NOT echo back or pass through input data fields (qty, cu_price, amount, currency, category, subcategory, extraction_confidence, Item) in the output. The pipeline joins classification results with extraction data downstream using id as the key. The LLM output must contain only classification fields and join keys.

Category logic:
- Travel-related items (airfare, hotels, rideshare, mileage, parking, tolls, meals away from home base, gas, vehicle repairs) should map to the Travel child codes.
- Office consumables, computer hardware, and furniture should map to the Office & Supplies children.
- Recurring software, professional memberships, and educational content should map to the Software & Subscriptions children.
- Phone, internet, and utility bills should map to the Utilities & Communication children.
- Advertising spend, marketing collateral, and trade-show attendance should map to the Marketing & Advertising children.
- Legal, accounting, consulting, and contractor work should map to the Professional Services children.
- Payment processing fees, business insurance, taxes, and business licenses should map to the Other Operating children.
- Office rent or coworking memberships should map to standalone 5800.
- Receipts that are clearly NOT business expenses (personal vacation, family groceries, gift to friend) should map to standalone 5900 Personal / Non-Business — but only when strongly indicated by description or item details. When in doubt, default to a business category.

Reasoning guidance:
- Use the most direct operational accounting interpretation supported by the line item text.
- Use vendor identity as a supporting signal, not the sole basis for classification, unless the user message explicitly instructs a deterministic override.
- If a line item is ambiguous, prefer the closest specific valid code rather than an overly broad parent code.
- For meals: only classify as 5015 Travel Meals when the user-provided description, vendor location, or other line context EXPLICITLY indicates the meal was during travel (mentions a city, trip, conference, etc.). For all other meals, classify as 5713 Other with line_notes indicating "local meal — see description for context", and lower Confidence to 60–70.
- For gas station receipts: classify as 5016 Auto Fuel regardless of whether the user owns or rents the vehicle. Rental car fuel is the only exception — that stays with the rental at 5012 Ground Transport.
- Do not infer Personal/Non-Business (5900) unless the description OR item details STRONGLY indicate personal use. Default to a business category when uncertain.
- If the user message includes audit-derived correction rules, treat them as high priority instructions for that run.
- The GL classification reason must be appended to line_notes in the output. If the original line_notes has content, format as "<original line_notes> | GL: <reason>". If the original line_notes is null or empty, format as "GL: <reason>". The reason must be brief and specific.

Confidence scoring:
- 95-100 = explicit and highly certain match from item text
- 85-94 = strong likely match with minor ambiguity
- 70-84 = reasonable match but some ambiguity
- 50-69 = weak match, limited evidence
- below 50 = insufficient clarity, use only if forced to choose the closest valid code
- When the input extraction_confidence is below 70, reduce your own Confidence by at least 10 points to reflect compounded uncertainty from the upstream extraction.

Output requirements:
- Return valid JSON only.
- Do not include markdown.
- Do not include explanation text outside JSON.
- Do not include commentary before or after the JSON.
- Output ONLY classification results and join keys. Do not echo back input data fields. The pipeline merges extraction data with classification results downstream.
- line_notes in the output must combine the original input line_notes (if present) with the GL classification reason. Format: "<original line_notes> | GL: <short one-sentence reason>". If the original line_notes is null or empty, output "GL: <short one-sentence reason>".
- Output must follow this exact schema:

{
  "results": [
    {
      "id": <original id>,
      "receipt_group": <original receipt_group>,
      "line_item_index": "<original line_item_index>",
      "GL_Account": "<selected account number>",
      "GL_Category": "<selected full_name>",
      "Confidence": <integer 0-100>,
      "line_notes": "<combined extraction notes and GL reason>"
    }
  ]
}

Final objective:
Your goal is maximum classification accuracy, consistency, and auditability across general business expense categories. Always follow the exact GL list and any deterministic instructions provided in the user message.`;


// ═══════════════════════════════════════════
// PASTE YOUR USER PROMPT BETWEEN THE BACKTICKS BELOW
// (Source: prompts/general/gl-code-allocation-v2.md → "## User Message")
//
// IMPORTANT: Your prompt references two dynamic variables.
// Replace these n8n expressions in your pasted prompt:
//   {{ JSON.stringify($json.gl_codes || [...]) }}  →  replace with:  ${JSON.stringify(glCodes)}
//   {{ JSON.stringify($json.line_items) }}          →  replace with:  ${JSON.stringify(lineItems)}
// ═══════════════════════════════════════════
const userPrompt = `Classify each line item to the single best GL code from the approved GL code list below.

Each line item includes a category, subcategory, extraction_confidence, and line_notes field from the upstream extraction step. Use category and subcategory as contextual signals to narrow the GL candidate set before making your final classification. Use extraction_confidence and line_notes to gauge the reliability of the upstream data and adjust your own confidence accordingly.

CRITICAL PARENT-CHILD RULE:
Parent GL accounts are rollup accounts only. NEVER classify a line item directly to a parent account. Always classify to the most specific child GL code (or one of the two standalones 5800 / 5900). The following are PARENT (rollup-only) accounts — do NOT classify any line item to these codes:
  5000 (Travel)
  5200 (Office & Supplies)
  5300 (Software & Subscriptions)
  5400 (Utilities & Communication)
  5500 (Marketing & Advertising)
  5600 (Professional Services)
  5700 (Other Operating)
If the line item could match a parent, you MUST route to the appropriate child instead.

Requirements:
- Use only the GL codes in the provided list.
- Return exactly one classification per line item.
- Return valid JSON only.
- Preserve the original id, receipt_group, and line_item_index in the output as join keys for downstream pipeline merging.
- Do NOT infer, change, renumber, merge, or reassign receipt_group. Preserve the original receipt_group exactly as provided in the input line items.
- Confidence must be an integer from 0 to 100.
- When the input extraction_confidence is below 70, reduce your own Confidence by at least 10 points to reflect compounded uncertainty from the upstream extraction.
- When line_notes contains "category uncertain", rely more heavily on item text analysis rather than the category signal for GL narrowing.
- The GL classification reason must be appended to line_notes in the output. Format: if the original line_notes has content, output "<original line_notes> | GL: <short one-sentence reason>". If the original line_notes is null or empty, output "GL: <short one-sentence reason>". The reason must be brief and specific.
- Classify based on the actual purchased good or service, not just the vendor name.
- Use item description as the primary signal.
- Use category and subcategory as the secondary signal to narrow GL candidates. If category or subcategory is null, skip the Category-to-GL Narrowing Guide and rely entirely on item text and vendor signals.
- Use extraction_confidence and line_notes as reliability indicators for the upstream data.
- Use merchant/vendor name and user-provided description as supporting signals only.
- Negative amounts must usually keep the same GL as the original item type they reverse unless the description clearly indicates tax, fee, reimbursement, or another explicit exception.
- If uncertain, still choose the closest valid child GL code and lower confidence — NEVER return null, empty, or omit any output field. Every line item MUST receive a GL classification.
- When two GL codes overlap, choose the code that best matches the actual purchased item text, not the code that merely appears more specific by hierarchy name.
- Do NOT echo back or pass through input data fields in the output. The pipeline joins classification results with extraction data downstream using id as the key. Output only classification fields and join keys.

Decision hierarchy:
1. Apply deterministic overrides first if they clearly apply.
2. Determine what the item actually is from the line item text.
3. Use category and subcategory to narrow GL candidates (see Category-to-GL Narrowing Guide below). If category or subcategory is null, skip this step.
4. Check extraction_confidence and line_notes — if extraction_confidence is below 70 or line_notes flags uncertainty, weight item text more heavily and lower your own Confidence.
5. Use merchant/vendor and user-provided description only as supporting context. However, when a vendor is explicitly listed under a specific GL code's vendor signals, that vendor signal should carry significant weight and generally take priority over category/subcategory narrowing for items from that vendor.
6. Match to the best child GL code in the hierarchy below.
7. Apply exclusions, required distinctions, and strict guardrails.
8. Return exactly one final GL classification (must be a CHILD code or one of the two standalones 5800 / 5900).

═══════════════════════════════════════════════════════════════
DETERMINISTIC OVERRIDES (highest priority — apply before all other rules)
═══════════════════════════════════════════════════════════════

- If vendor is a major airline (Delta, United, American, Southwest, JetBlue, Alaska, Spirit, Frontier, Hawaiian, Air France, Lufthansa, British Airways, Emirates, KLM, etc.) → 5010 (Travel — Airfare)
- If vendor is a major hotel chain or short-term lodging platform (Marriott, Hilton, Hyatt, IHG, Holiday Inn, Hampton Inn, Sheraton, Westin, Wyndham, La Quinta, Best Western, Airbnb, VRBO, Booking.com, Expedia for hotel) → 5011 (Travel — Lodging)
- If vendor is a rideshare or car-rental service (Uber, Lyft, Hertz, Enterprise, Avis, Budget, National, Alamo, Sixt, Turo) → 5012 (Travel — Ground Transport)
- If vendor is a gas station (Shell, Chevron, BP, Exxon, Mobil, ConocoPhillips, Marathon, Speedway, Wawa, QuikTrip, 7-Eleven gas pump, Costco Gas, Sam's Club Gas, Sheetz, Circle K, Valero) → 5016 (Travel — Auto Fuel)
- If vendor is a vehicle service/repair shop (Jiffy Lube, Valvoline, Discount Tire, Mavis, Midas, Pep Boys, Firestone, Goodyear, dealership service center) OR item text indicates oil change / tire / brake / mechanic / smog check / vehicle registration → 5017 (Travel — Auto Maintenance & Repair)
- If vendor is a coworking or office-space provider (WeWork, Regus, Industrious, Spaces, Knotel, Convene, Servcorp) → 5800 (Rent — Office / Coworking)
- If vendor is a major SaaS platform (Adobe, Notion, Slack, Zoom, Microsoft 365, Google Workspace, Salesforce, HubSpot, GitHub, AWS, Vercel, Figma, Asana, Trello, Linear, Atlassian, Dropbox, Box) AND item text indicates a subscription / recurring license → 5310 (Software / SaaS)
- If vendor is a wireless carrier (AT&T Wireless, Verizon Wireless, T-Mobile, Sprint, Google Fi, Mint Mobile, Visible, Cricket) AND item text indicates a phone or cellular plan → 5410 (Phone / Cellular)
- If vendor is an internet/broadband provider (Comcast/Xfinity, Spectrum, Verizon Fios, AT&T Internet, Cox, Frontier, CenturyLink, Optimum, Google Fiber, Starlink) → 5411 (Internet)
- If vendor is a major ad platform (Google Ads, Meta Ads / Facebook Ads, LinkedIn Ads, X / Twitter Ads, TikTok Ads, Bing Ads, Reddit Ads) → 5510 (Advertising)
- If vendor is a recruiting platform (Indeed, LinkedIn Premium for Recruiters, ZipRecruiter, Glassdoor for Employers, Lever, Greenhouse) AND item text indicates job posting or candidate sourcing → 5611 (Consulting & Contractors)
- If vendor is a payment processor (Stripe, Square, PayPal, Toast, Clover, Adyen, Braintree) AND item text indicates processing fee, transaction fee, or merchant service charge → 5710 (Bank & Merchant Fees)
- If item text contains "mileage reimbursement" or "miles driven" or "business mileage" → 5013 (Travel — Mileage)
- If item text contains "toll" or "EZ Pass" or "FasTrak" or "airport parking" → 5014 (Travel — Parking & Tolls)
- If user-provided description contains explicit personal-use markers ("personal", "family", "vacation", "gift to a friend", "home grocery") AND no business context counters it → 5900 (Personal / Non-Business)

═══════════════════════════════════════════════════════════════
STRICT GUARDRAILS (apply after classification, before output)
═══════════════════════════════════════════════════════════════

- NEVER classify to a PARENT code. Always use the most specific CHILD or one of the two standalones (5800, 5900).
- Do not classify a meal as 5015 Travel Meals unless the user-provided description, vendor location, or line context EXPLICITLY indicates travel. Otherwise classify the meal as 5713 Other with Confidence 60–70 and line_notes "local meal — context not clearly travel".
- Gas station receipts (fuel) must always go to 5016, never 5012 Ground Transport (which is for taxi/rideshare/rental).
- Rental car fuel purchased through the rental company stays bundled with the rental at 5012.
- Mileage must NEVER be classified as 5012 Ground Transport. Mileage is 5013 exclusively.
- Parking and tolls must NEVER be classified as 5012. They are 5014.
- Vehicle maintenance (oil change, tires, repair) must NEVER be classified as 5713 Other. It is 5017.
- Vehicle insurance is 5711 Insurance, not a Travel/Auto code.
- Coworking and office-space rent must always go to 5800, never 5412 Other Utilities or 5713 Other.
- Internet bills must NEVER be classified as 5410 Phone / Cellular. AT&T classified by item text: phone plan → 5410, internet service → 5411.
- SaaS subscriptions must NEVER be classified as 5311 Professional Dues & Memberships. Software/SaaS is 5310. Dues are for trade associations, professional societies, certification renewals.
- Professional dues (AICPA, ABA, IEEE, etc.) must NEVER be classified as 5310 Software / SaaS. They are 5311.
- Educational content (courses, books, certification training) goes to 5312, never 5310.
- Business cards, swag, branded merch goes to 5511 Marketing Materials, not 5210 Office Supplies.
- Conference registration goes to 5512, never 5311 Dues or 5312 Education.
- Legal and accounting fees go to 5610, never 5712 Taxes & Licenses (which is for the license/permit/tax payment itself, not the professional helping you file it).
- Business license renewal fees, LLC annual fees, DBA filings → 5712 Taxes & Licenses.
- Bank service charges, ATM fees, wire fees → 5710, never 5713 Other.
- Business insurance premiums → 5711, never 5713 Other.
- DO NOT default to 5900 Personal / Non-Business when the receipt is ambiguous. Only use 5900 when the description OR item details STRONGLY indicate personal use. When uncertain, classify to the closest business category with reduced Confidence.
- 5713 Other is a catch-all of last resort. Use only when no other child code reasonably fits, and always include the reason in line_notes.

═══════════════════════════════════════════════════════════════
GL CODE HIERARCHY WITH CLASSIFICATION GUIDANCE
═══════════════════════════════════════════════════════════════

Each category below shows: PARENT (rollup only) → CHILDREN (classification targets).
Within each category, always classify to a CHILD code. Two standalone codes (5800, 5900) sit outside the parent-child hierarchy and are also valid classification targets.

───────────────────────────────────────────────────────────────
CATEGORY: Travel
  PARENT: 5000 (rollup only — never classify here)
  DISAMBIGUATION: Classify to the most specific child by item text.
    Airfare → 5010 | Lodging → 5011 | Taxi/Rideshare/Rental → 5012 | Mileage reimbursement → 5013 | Parking/Tolls → 5014 | Meals while traveling → 5015 | Gas/Fuel → 5016 | Vehicle repair/maintenance → 5017
  CHILDREN:
───────────────────────────────────────────────────────────────

{"Account":"5010","Full_Name":"Travel:Airfare"} (CHILD)
- Description: Airline tickets, baggage fees, seat upgrades, and other airfare-related charges for business travel.
- Primary item signals: airfare, flight, airline ticket, boarding pass, baggage fee, checked bag, seat selection, in-flight purchase
- Vendor signals: Delta, United, American, Southwest, JetBlue, Alaska, Spirit, Frontier, Hawaiian, Air France, Lufthansa, British Airways, Emirates, KLM, Qatar Airways, Singapore Airlines, Cathay Pacific.
- Examples:
  - "Delta Airlines $432.10 SFO-JFK" → 5010
  - "United baggage fee $35" → 5010
- Do NOT use when: hotel → 5011 | ground transport → 5012 | airport parking → 5014 | airport meals during a trip → 5015

{"Account":"5011","Full_Name":"Travel:Lodging"} (CHILD)
- Description: Hotels, motels, short-term rental platforms (Airbnb, VRBO), and any accommodation for business travel.
- Primary item signals: hotel, room, room charge, lodging, accommodation, motel, inn, suite, nightly rate, Airbnb stay
- Vendor signals: Marriott, Hilton, Hyatt, IHG, Holiday Inn, Hampton Inn, Sheraton, Westin, Wyndham, La Quinta, Best Western, Four Seasons, Ritz-Carlton, Airbnb, VRBO, Booking.com, Expedia (hotel portion).
- Examples:
  - "Marriott Marquis $189.00 x 3 nights" → 5011
  - "Airbnb Reservation HMABCD1234" → 5011
- Do NOT use when: airfare → 5010 | ground transport → 5012 | meals at hotel restaurant → 5015 | hotel parking → 5014

{"Account":"5012","Full_Name":"Travel:Ground Transport"} (CHILD)
- Description: Taxi, rideshare, car rental, shuttle, train, bus, subway, and other non-air transportation for business travel.
- Primary item signals: taxi, Uber, Lyft, rideshare, car rental, rental car, shuttle, train, Amtrak, bus, subway, transit, fare
- Vendor signals: Uber, Lyft, Hertz, Enterprise, Avis, Budget, National, Alamo, Sixt, Turo, Amtrak, Greyhound, Megabus.
- Examples:
  - "Uber to SFO $42.18" → 5012
  - "Hertz 3-day rental $245.00" → 5012
  - "Amtrak NYC-Boston $89" → 5012
- Note: Rental car fuel purchased through the rental company stays at 5012 (bundled with the rental). Self-purchased gas at a gas station goes to 5016, even if it's for a rental car.
- Do NOT use when: mileage reimbursement → 5013 | parking/tolls → 5014 | gas at a gas station → 5016

{"Account":"5013","Full_Name":"Travel:Mileage"} (CHILD)
- Description: Mileage reimbursement at the IRS standard rate or a similar per-mile rate.
- Primary item signals: mileage, mileage reimbursement, miles, business miles, per-mile rate, IRS mileage rate
- Examples:
  - "Mileage 142 miles @ $0.725 = $102.95" → 5013
- Do NOT use when: actual gas purchase → 5016 | parking → 5014 | tolls → 5014 | vehicle repair → 5017

{"Account":"5014","Full_Name":"Travel:Parking & Tolls"} (CHILD)
- Description: Parking fees (airport, garage, valet) and toll charges (highway, bridge, EZ Pass refills).
- Primary item signals: parking, garage, valet, toll, EZ Pass, FasTrak, SunPass, airport parking, hourly parking, parking meter
- Vendor signals: SpotHero, ParkMobile, airport parking authorities, toll-road operators.
- Examples:
  - "SFO Long Term Parking 3 days $48.00" → 5014
  - "EZ Pass Toll Refill $50" → 5014
- Do NOT use when: rideshare → 5012 | gas → 5016 | mileage → 5013

{"Account":"5015","Full_Name":"Travel:Travel Meals"} (CHILD)
- Description: Meals consumed while traveling for business — restaurants, hotel dining, airport food, conference meals.
- Primary item signals: restaurant, cafe, food, meal, dining, breakfast, lunch, dinner, coffee — ONLY when context indicates travel
- Vendor signals: airport restaurants, hotel restaurants, restaurants in a city other than the user's home base.
- CRITICAL: Only classify here when the user-provided description, vendor location, or other line context EXPLICITLY indicates travel (mentions a trip, conference, city, "out of town", etc.). When in doubt, classify the meal to 5713 Other with Confidence 60–70.
- Examples:
  - User description "Client dinner during Chicago trip", vendor "Joe's Steakhouse, Chicago" → 5015
  - User description "Lunch at conference", vendor "Cvent Conference Center" → 5015
- Do NOT use when: meal context unclear → 5713 Other | groceries → 5900 if personal, else 5713 | hotel room charge → 5011

{"Account":"5016","Full_Name":"Travel:Auto Fuel"} (CHILD)
- Description: Fuel purchased at a gas station — gasoline, diesel, premium — for any business vehicle (owned, leased, or self-fueled rental).
- Primary item signals: gas, fuel, gasoline, gallons, regular, premium, diesel, unleaded, pump
- Vendor signals: Shell, Chevron, BP, Exxon, Mobil, ConocoPhillips, Marathon, Sunoco, Speedway, Wawa, QuikTrip, Sheetz, Circle K, Valero, Phillips 66, Costco Gas, Sam's Club Gas, 7-Eleven (gas pump line).
- Examples:
  - "Shell 12.4 gal @ $4.05 = $50.22" → 5016
  - "Costco Gas $48.00" → 5016
- Do NOT use when: mileage reimbursement → 5013 | rideshare → 5012 | vehicle repair → 5017

{"Account":"5017","Full_Name":"Travel:Auto Maintenance & Repair"} (CHILD)
- Description: Vehicle maintenance and repair — oil changes, tire purchases/rotations, brake work, engine repair, smog check, vehicle registration fees, and dealership service.
- Primary item signals: oil change, tire, brake, mechanic, repair, service, smog, registration, alignment, transmission, battery, wiper, inspection
- Vendor signals: Jiffy Lube, Valvoline, Discount Tire, Mavis, Midas, Pep Boys, Firestone, Goodyear, Costco Tire, Sam's Club Auto, dealership service centers (any branded "Service Center").
- Examples:
  - "Jiffy Lube Oil Change $79.99" → 5017
  - "Discount Tire 4 tires $612.00" → 5017
- Do NOT use when: fuel → 5016 | vehicle insurance → 5711 | vehicle purchase (capex) → 5713 with note | vehicle rental → 5012

───────────────────────────────────────────────────────────────
CATEGORY: Office & Supplies
  PARENT: 5200 (rollup only — never classify here)
  DISAMBIGUATION: Classify to the most specific child by item text.
    Office consumables → 5210 | Computer/tech equipment under capex → 5211 | Office furniture → 5212
  CHILDREN:
───────────────────────────────────────────────────────────────

{"Account":"5210","Full_Name":"Office & Supplies:Office Supplies"} (CHILD)
- Description: Consumable office items — paper, pens, ink, sticky notes, file folders, envelopes, staples, tape, small desk accessories.
- Primary item signals: pens, pencils, notebooks, printer paper, ink, toner, sticky notes, post-its, folders, envelopes, staples, tape, scissors, binder clips, paper clips, desk organizer
- Vendor signals: Staples, Office Depot, OfficeMax, Quill, Amazon Business (for office items), Walmart (for office supplies).
- Examples:
  - "Staples printer paper 500ct $8.99" → 5210
  - "Office Depot ink cartridge $44.99" → 5210
- Do NOT use when: laptop/electronics → 5211 | desk/chair → 5212 | marketing collateral (cards, swag) → 5511

{"Account":"5211","Full_Name":"Office & Supplies:Equipment"} (CHILD)
- Description: Computer hardware and peripherals under the capex threshold (typically under $2,500 per item per IRS Section 179 considerations) — laptops, monitors, keyboards, mice, headphones, cables, hard drives, dock stations.
- Primary item signals: laptop, MacBook, monitor, display, keyboard, mouse, headphones, headset, webcam, microphone, dock, charger, cable, USB, hard drive, SSD, adapter, hub, stylus
- Vendor signals: Apple, Best Buy, Newegg, B&H Photo, Amazon Business (for tech), Dell, Lenovo, HP.
- Examples:
  - "Apple MacBook Air $1,199.00" → 5211
  - "Logitech MX Master mouse $99" → 5211
- Note: For purchases above the capex threshold, use 5713 with line_notes "capex — exceeds Section 179 threshold, review for depreciation".
- Do NOT use when: office consumables → 5210 | furniture → 5212 | software → 5310

{"Account":"5212","Full_Name":"Office & Supplies:Furniture"} (CHILD)
- Description: Office furniture — desks, chairs, bookshelves, lamps, standing desks, ergonomic accessories.
- Primary item signals: desk, chair, office chair, ergonomic chair, standing desk, bookshelf, file cabinet, lamp, monitor arm, footrest
- Vendor signals: IKEA, Wayfair, Steelcase, Herman Miller, Autonomous, Uplift Desk, Fully, Branch.
- Examples:
  - "Herman Miller Aeron chair $1,395" → 5212
  - "IKEA desk $179" → 5212
- Do NOT use when: laptop/electronics → 5211 | office consumables → 5210

───────────────────────────────────────────────────────────────
CATEGORY: Software & Subscriptions
  PARENT: 5300 (rollup only — never classify here)
  DISAMBIGUATION: Classify to the most specific child by item text.
    Recurring software/SaaS → 5310 | Professional/trade memberships → 5311 | Books, courses, training → 5312
  CHILDREN:
───────────────────────────────────────────────────────────────

{"Account":"5310","Full_Name":"Software & Subscriptions:Software / SaaS"} (CHILD)
- Description: Recurring software subscriptions and SaaS licenses — productivity, collaboration, CRM, design, cloud hosting.
- Primary item signals: subscription, software, SaaS, cloud, app, plan, license, monthly subscription, annual subscription, recurring license
- Vendor signals: Adobe, Notion, Slack, Zoom, Microsoft 365, Google Workspace, Salesforce, HubSpot, GitHub, AWS, Vercel, Figma, Asana, Trello, Linear, Atlassian, Dropbox, Box, ClickUp, Monday.com, Airtable, Calendly, Loom, Miro.
- Examples:
  - "Adobe Creative Cloud $54.99/month" → 5310
  - "Notion Plus $10/user x 5" → 5310
  - "AWS Cloud Hosting $128.42" → 5310
- Do NOT use when: professional dues → 5311 | course/book → 5312 | one-time hardware → 5211

{"Account":"5311","Full_Name":"Software & Subscriptions:Professional Dues & Memberships"} (CHILD)
- Description: Professional society memberships, trade association dues, and certification renewals (NOT software).
- Primary item signals: membership, dues, association, society, certification renewal, professional membership
- Vendor signals: AICPA, ABA, IEEE, AMA, NAR, PMI, SHRM, ACS, ASCE, IIBA, ISACA, ACFE, industry-specific trade associations.
- Examples:
  - "AICPA Annual Dues $440" → 5311
  - "PMI Membership Renewal $129" → 5311
- Do NOT use when: software subscription → 5310 | education/course → 5312 | conference registration → 5512

{"Account":"5312","Full_Name":"Software & Subscriptions:Publications & Education"} (CHILD)
- Description: Books, online courses, training programs, certification exams, magazine subscriptions, and other educational content.
- Primary item signals: book, course, training, certification exam, ebook, audiobook, Kindle, magazine subscription, online learning
- Vendor signals: Coursera, Udemy, LinkedIn Learning, MasterClass, Pluralsight, Skillshare, edX, Audible (for business audiobooks), Amazon (for business books), O'Reilly, Manning.
- Examples:
  - "Udemy CRM Training Course $89" → 5312
  - "AWS Certification Exam $150" → 5312
- Do NOT use when: SaaS subscription → 5310 | professional dues → 5311 | conference registration → 5512

───────────────────────────────────────────────────────────────
CATEGORY: Utilities & Communication
  PARENT: 5400 (rollup only — never classify here)
  DISAMBIGUATION: Classify to the most specific child by item text.
    Phone/cellular → 5410 | Internet/broadband → 5411 | Electric/gas/water → 5412
  CHILDREN:
───────────────────────────────────────────────────────────────

{"Account":"5410","Full_Name":"Utilities & Communication:Phone / Cellular"} (CHILD)
- Description: Mobile phone plans, business phone lines, and VoIP services.
- Primary item signals: phone, cellular, mobile, wireless, cell plan, data plan, VoIP, phone bill, line, voice
- Vendor signals: AT&T (when item indicates wireless/phone), Verizon Wireless, T-Mobile, Sprint, Google Fi, Mint Mobile, Visible, Cricket, RingCentral, Dialpad, Aircall, Grasshopper.
- Examples:
  - "Verizon Wireless $89.99/month" → 5410
  - "Google Fi $40 + $10 data" → 5410
- Do NOT use when: internet/broadband → 5411 | software → 5310

{"Account":"5411","Full_Name":"Utilities & Communication:Internet"} (CHILD)
- Description: Internet and broadband service for business use.
- Primary item signals: internet, broadband, WiFi, fiber, cable internet, ISP, network connectivity
- Vendor signals: Comcast/Xfinity, Spectrum, Verizon Fios, AT&T Internet, Cox, Frontier, CenturyLink, Optimum, Google Fiber, Starlink.
- Examples:
  - "Comcast Business Internet $129" → 5411
  - "Starlink Business $250/month" → 5411
- Do NOT use when: phone/cellular → 5410 | SaaS → 5310 | utilities → 5412

{"Account":"5412","Full_Name":"Utilities & Communication:Other Utilities"} (CHILD)
- Description: Electric, gas, water, sewer, and other utilities — typically the home-office portion for self-employed users, or full bills for users with dedicated office space.
- Primary item signals: electric, electricity, gas bill, water, sewer, utility bill, power, propane
- Vendor signals: local utility companies, FPL, PG&E, ConEd, Duke Energy.
- Examples:
  - "PG&E Electric $142.50 (home office portion)" → 5412
- Do NOT use when: phone → 5410 | internet → 5411 | rent → 5800

───────────────────────────────────────────────────────────────
CATEGORY: Marketing & Advertising
  PARENT: 5500 (rollup only — never classify here)
  DISAMBIGUATION: Classify to the most specific child by item text.
    Paid ad spend → 5510 | Physical marketing materials → 5511 | Conferences/trade shows → 5512
  CHILDREN:
───────────────────────────────────────────────────────────────

{"Account":"5510","Full_Name":"Marketing & Advertising:Advertising"} (CHILD)
- Description: Paid digital and traditional advertising spend.
- Primary item signals: ad spend, paid ads, sponsored, ad campaign, PPC, CPM, CPC, ad placement, ad billing
- Vendor signals: Google Ads, Meta Ads, Facebook Ads, LinkedIn Ads, X / Twitter Ads, TikTok Ads, Bing Ads, Reddit Ads, Amazon Advertising, YouTube Ads, podcast sponsorships.
- Examples:
  - "Google Ads $450.00" → 5510
  - "LinkedIn Ads campaign $1,250" → 5510
- Do NOT use when: marketing materials → 5511 | conferences → 5512 | SaaS marketing tool → 5310

{"Account":"5511","Full_Name":"Marketing & Advertising:Marketing Materials"} (CHILD)
- Description: Physical and digital marketing collateral — business cards, brochures, flyers, swag, branded merchandise.
- Primary item signals: business card, brochure, flyer, print, swag, branded, logo, t-shirt with logo, sticker, mug, pen with logo, banner, poster
- Vendor signals: Vistaprint, Moo, Sticker Mule, 4imprint, Customink, Printful, Printify, FedEx Office (printing).
- Examples:
  - "Vistaprint 500 business cards $42" → 5511
  - "4imprint branded mugs x 50 $385" → 5511
- Do NOT use when: paid ad spend → 5510 | office supplies → 5210 | trade-show booth materials → 5512

{"Account":"5512","Full_Name":"Marketing & Advertising:Conferences & Trade Shows"} (CHILD)
- Description: Conference registration fees, trade-show booth fees, attendee badges, and trade-show-specific expenses.
- Primary item signals: conference registration, attendee badge, ticket, expo, trade show, summit, booth fee, exhibitor fee, sponsorship at conference
- Vendor signals: Eventbrite, Cvent, specific conference brands (SaaStr, Inbound, Dreamforce, Money 20/20, CES, Re:Invent).
- Examples:
  - "Dreamforce Conference Registration $1,795" → 5512
  - "Eventbrite Sales Summit Ticket $349" → 5512
- Do NOT use when: travel-to-conference flight → 5010 | hotel for conference → 5011 | meals during conference → 5015 | professional dues → 5311 | course → 5312

───────────────────────────────────────────────────────────────
CATEGORY: Professional Services
  PARENT: 5600 (rollup only — never classify here)
  DISAMBIGUATION: Classify to the most specific child by item text.
    Legal/accounting professionals → 5610 | Consultants/freelancers/contractors → 5611
  CHILDREN:
───────────────────────────────────────────────────────────────

{"Account":"5610","Full_Name":"Professional Services:Legal & Accounting"} (CHILD)
- Description: Legal services (attorneys, law firms), accounting services (CPAs, bookkeepers, tax preparers), and other licensed professional services.
- Primary item signals: legal fee, retainer, attorney, lawyer, law firm, CPA, accountant, bookkeeper, tax prep, tax return, audit, advisory
- Vendor signals: law firms, accounting firms, H&R Block, Intuit (TurboTax Business), Bench, Pilot, Xero accounting partners.
- Examples:
  - "Smith & Associates Legal Retainer $2,500" → 5610
  - "H&R Block Tax Prep $385" → 5610
- Do NOT use when: 1099 freelancer/contractor → 5611 | business license fee → 5712

{"Account":"5611","Full_Name":"Professional Services:Consulting & Contractors"} (CHILD)
- Description: 1099 contractors, freelancers, consultants, and recruiting platform fees.
- Primary item signals: consultant, contractor, freelancer, 1099, contract work, design service, development service, virtual assistant, recruiter
- Vendor signals: Fiverr, Upwork, Toptal, Indeed, ZipRecruiter, LinkedIn Premium for Recruiters, Glassdoor for Employers, Lever, Greenhouse, individual contractor invoices.
- Examples:
  - "Upwork Designer $850" → 5611
  - "Indeed Job Posting $99" → 5611
- Do NOT use when: legal/accounting → 5610 | SaaS tool the contractor uses → 5310

───────────────────────────────────────────────────────────────
CATEGORY: Other Operating
  PARENT: 5700 (rollup only — never classify here)
  DISAMBIGUATION: Classify to the most specific child by item text.
    Bank/payment fees → 5710 | Business insurance → 5711 | Business license/tax → 5712 | True catch-all → 5713
  CHILDREN:
───────────────────────────────────────────────────────────────

{"Account":"5710","Full_Name":"Other Operating:Bank & Merchant Fees"} (CHILD)
- Description: Bank service charges, ATM fees, wire fees, monthly account fees, payment-processor fees, credit card processing.
- Primary item signals: bank fee, service charge, ATM fee, wire fee, monthly fee, account fee, processing fee, transaction fee, swipe fee, merchant fee, interchange
- Vendor signals: banks (Chase, BofA, Wells Fargo, Capital One, etc.), Stripe, Square, PayPal, Toast, Clover, Adyen, Braintree.
- Examples:
  - "Stripe Processing Fee $42.18" → 5710
  - "Chase Wire Transfer Fee $35" → 5710
- Do NOT use when: business insurance → 5711 | taxes/licenses → 5712

{"Account":"5711","Full_Name":"Other Operating:Insurance"} (CHILD)
- Description: Business insurance premiums — general liability, professional liability (E&O), commercial property, business auto.
- Primary item signals: insurance premium, business insurance, liability insurance, general liability, E&O, errors and omissions, commercial property, business auto insurance
- Vendor signals: State Farm Business, Geico Business, Hiscox, Next Insurance, The Hartford, Allstate Business, Travelers, Chubb.
- Examples:
  - "Hiscox General Liability $89/month" → 5711
  - "Next Insurance E&O Annual $1,200" → 5711
- Do NOT use when: personal insurance (health/life/personal auto) → 5900 | bank fee → 5710

{"Account":"5712","Full_Name":"Other Operating:Taxes & Licenses"} (CHILD)
- Description: Business licenses, permits, annual LLC fees, DBA filings, sales/use tax remittances, and other government-imposed business fees.
- Primary item signals: business license, operating permit, LLC annual fee, DBA filing, annual report fee, sales tax remittance, use tax, state filing fee, secretary of state fee
- Vendor signals: secretary of state, state department of revenue, city business license bureau, county clerk.
- Examples:
  - "State LLC Annual Fee $25" → 5712
  - "City Business License Renewal $150" → 5712
- Do NOT use when: legal/accounting service to file → 5610 | payroll taxes → 5713 with note

{"Account":"5713","Full_Name":"Other Operating:Other"} (CHILD)
- Description: Catch-all for legitimate business expenses that don't fit any other specific child code. Use sparingly.
- Primary item signals: any business expense that doesn't match a more specific code
- Examples:
  - "Local meal — unclear if travel or business" → 5713 with note "local meal, context unclear"
  - "Business gift to client $25" → 5713 with note "business gift, IRS $25/recipient limit"
  - "Shipping/postage" → 5713 with note "shipping not tied to marketing or product"
- CRITICAL: Always include line_notes explaining why no more specific code applies. If 5713 is being used more than ~10% of the time, the GL list likely has a missing category that should be added.

───────────────────────────────────────────────────────────────
STANDALONE: Rent
───────────────────────────────────────────────────────────────

{"Account":"5800","Full_Name":"Rent / Office / Coworking"} (STANDALONE — classify directly)
- Description: Office rent, coworking space membership, dedicated desk fees, hot-desk fees.
- Primary item signals: rent, monthly rent, lease, office space, coworking, dedicated desk, hot desk, private office, workspace, mailing address service
- Vendor signals: WeWork, Regus, Industrious, Spaces, Knotel, Convene, Servcorp, local landlords / property management companies.
- Examples:
  - "WeWork Dedicated Desk $450/month" → 5800
  - "Office Rent April 2026 $2,200" → 5800
- Do NOT use when: home utilities → 5412 | virtual office for SaaS reasons → 5310

───────────────────────────────────────────────────────────────
STANDALONE: Personal / Non-Business
───────────────────────────────────────────────────────────────

{"Account":"5900","Full_Name":"Personal / Non-Business"} (STANDALONE — classify directly)
- Description: Receipts that should NOT be deducted as business expense. Use only when the description, items, or context STRONGLY indicate personal use.
- Primary signals (require strong evidence):
  - User-provided description explicitly mentions personal use ("personal", "family", "vacation", "gift to friend", "home grocery")
  - Receipt items are clearly personal (children's clothing, family groceries, personal vacation lodging)
  - Vendor + items combination has no plausible business purpose
- Examples:
  - User description "Family vacation in Hawaii", vendor "Hilton Waikoloa" → 5900 (despite vendor being a lodging chain)
  - User description "Birthday gift for my mom", vendor "Macy's", item "Coach handbag" → 5900
  - "Costco grocery $245" with no business context → 5900
- CRITICAL — BE CONSERVATIVE:
  - DEFAULT to a business category when uncertain.
  - Only flag 5900 when evidence is STRONG.
  - If the description is empty or generic, default to a business category and set Confidence 50–70 with line_notes "potentially personal — review needed".
- Do NOT use when: any plausible business interpretation exists | description is empty/generic | user could reasonably claim the expense

═══════════════════════════════════════════════════════════════
CATEGORY-TO-GL NARROWING GUIDE
═══════════════════════════════════════════════════════════════

Use the category and subcategory from the upstream extraction to narrow which GL codes are most likely. The item description remains the final arbiter. If category or subcategory is null, skip this guide entirely and rely on item text + vendor signals.

When category is "Travel":
  - Subcategory Airfare → 5010
  - Subcategory Lodging → 5011
  - Subcategory Ground Transport, Taxi, Rideshare, Car Rental, Train, Bus → 5012
  - Subcategory Mileage → 5013
  - Subcategory Parking, Tolls → 5014
  - Subcategory Meals → 5015 (if context confirms travel) or 5713 (if context unclear)
  - Subcategory Fuel, Gas → 5016
  - Subcategory Auto Repair, Maintenance → 5017

When category is "Food & Beverage" or "Meals":
  - If user description indicates travel → 5015 Travel Meals
  - Otherwise → 5713 Other with note "local meal, no travel context"

When category is "Supplies" or "Office":
  - Subcategory Office Supplies, Paper, Pens → 5210
  - Subcategory Electronics, Computer, Equipment → 5211
  - Subcategory Furniture → 5212

When category is "Software", "Subscriptions", "SaaS": → 5310

When category is "Membership", "Dues", "Professional": → 5311

When category is "Education", "Training", "Books": → 5312

When category is "Utilities" or "Telecom":
  - Phone/cellular → 5410
  - Internet/broadband → 5411
  - Electric/gas/water → 5412

When category is "Marketing" or "Advertising":
  - Paid ad spend → 5510
  - Physical materials, swag, business cards → 5511
  - Conference, trade show → 5512

When category is "Professional Services":
  - Legal, accounting, CPA → 5610
  - Consultant, freelancer, contractor, recruiting → 5611

When category is "Fees", "Bank", "Processing": → 5710

When category is "Insurance": → 5711 (business) or 5900 (if clearly personal health/auto)

When category is "Taxes" or "Licenses & Permits": → 5712

When category is "Rent": → 5800

When category is "Discount / Credit": Classify to the GL of the item type being reversed.

IMPORTANT: Category and subcategory narrow the search space but do NOT override item-text analysis. If item text clearly contradicts the category, trust the item text and note the discrepancy in line_notes.

═══════════════════════════════════════════════════════════════
VENDOR ANCHOR GUIDANCE (supporting signal only)
═══════════════════════════════════════════════════════════════

Use item text first unless a deterministic override applies. The lists below are illustrative — apply by vendor CLASS, not by exhaustive match.

- Major airlines (Delta, United, American, Southwest, JetBlue, Alaska, Spirit, Frontier, Hawaiian, international carriers) → 5010
- Major hotel chains and short-term rental platforms (Marriott, Hilton, Hyatt, IHG, Wyndham, Best Western, Airbnb, VRBO, Booking.com) → 5011
- Rideshare and car rental (Uber, Lyft, Hertz, Enterprise, Avis, Budget, National, Alamo, Sixt, Turo) → 5012
- Public transit (Amtrak, regional transit authorities, Greyhound, Megabus) → 5012
- Gas stations (Shell, Chevron, BP, Exxon, Mobil, ConocoPhillips, Marathon, Sunoco, Speedway, Wawa, QuikTrip, Sheetz, Circle K, Valero, Phillips 66, warehouse-club gas) → 5016
- Vehicle service centers (Jiffy Lube, Valvoline, Discount Tire, Mavis, Midas, Pep Boys, Firestone, Goodyear, dealership service) → 5017
- Office-supply retailers (Staples, Office Depot, OfficeMax, Quill) → typically 5210; if buying tech, 5211; if buying furniture, 5212
- Computer/tech retailers (Apple, Best Buy, Newegg, B&H Photo, Dell, Lenovo, HP) → 5211
- Furniture retailers (IKEA, Wayfair, Steelcase, Herman Miller, Autonomous, Uplift Desk) → 5212
- SaaS giants (Adobe, Notion, Slack, Zoom, Microsoft 365, Google Workspace, Salesforce, HubSpot, GitHub, AWS, Vercel, Figma, Asana, Atlassian, Dropbox) → 5310
- Trade associations (AICPA, ABA, IEEE, AMA, NAR, PMI, SHRM) → 5311
- Online learning platforms (Coursera, Udemy, LinkedIn Learning, MasterClass, Pluralsight, Skillshare, edX, O'Reilly) → 5312
- Wireless carriers (Verizon Wireless, T-Mobile, Sprint, Google Fi, Mint Mobile, Visible, Cricket) → 5410
- AT&T classified by item text: phone/wireless → 5410; internet/broadband → 5411
- Internet providers (Comcast/Xfinity, Spectrum, Verizon Fios, Cox, Frontier, CenturyLink, Google Fiber, Starlink) → 5411
- Utility companies (FPL, PG&E, ConEd, Duke Energy, local utilities) → 5412
- Paid ad platforms (Google Ads, Meta Ads, LinkedIn Ads, X Ads, TikTok Ads, Bing Ads, Reddit Ads, Amazon Advertising) → 5510
- Print/swag vendors (Vistaprint, Moo, Sticker Mule, 4imprint, Customink, Printful) → 5511
- Conference and event platforms (Eventbrite, Cvent) and specific conference brands → 5512
- Recruiting platforms (Indeed, ZipRecruiter, Glassdoor for Employers, LinkedIn Premium for Recruiters, Lever, Greenhouse) → 5611
- Freelancer marketplaces (Fiverr, Upwork, Toptal) → 5611
- Payment processors (Stripe, Square, PayPal, Toast, Clover, Adyen, Braintree) → 5710
- Business insurance (Hiscox, Next Insurance, The Hartford, State Farm Business, Geico Business, Travelers, Chubb) → 5711
- Coworking spaces (WeWork, Regus, Industrious, Spaces, Knotel, Convene, Servcorp) → 5800
- Amazon Business / Amazon → highly variable; classify by item description only. If item description is vague or missing, lower Confidence to 50 or below. Defaults: food/grocery (when business context unclear) → 5900; office supplies → 5210; electronics → 5211; books → 5312; subscription → 5310.
- Walmart / Target / Costco → highly variable; classify by item description only. Default to 5713 Other with note if unclear.

═══════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════

- Return valid JSON only. No markdown. No explanation text outside JSON.
- Return exactly one classified result per input line item.
- NO NULL VALUES: Every field in the output is required and must not be null, empty, or omitted. GL_Account must always be a valid account number from the approved list. GL_Category must always be the corresponding Full_Name. Confidence must always be an integer 0-100. line_notes must always contain the GL reason. If classification is uncertain, still assign the best-match child GL code (or 5713 Other) and set Confidence low (e.g., 30-50) — never return null.
- Output ONLY classification fields and join keys — do not echo input data fields.
- GL_Category must be copied verbatim from the Full_Name field of the selected GL code.
- line_notes format: "<original line_notes> | GL: <short reason>" or "GL: <short reason>" if original is null/empty.
- Output schema:

{
  "results": [
    {
      "id": <original id>,
      "receipt_group": <original receipt_group>,
      "line_item_index": "<original line_item_index>",
      "GL_Account": "<selected account number>",
      "GL_Category": "<selected full_name>",
      "Confidence": <integer 0-100>,
      "line_notes": "<combined extraction notes and GL reason>"
    }
  ]
}

═══════════════════════════════════════════════════════════════
APPROVED GL CODE LIST
═══════════════════════════════════════════════════════════════

${ JSON.stringify($json.gl_codes || [
  {"Account":"5000","Full_Name":"Travel"},
  {"Account":"5010","Full_Name":"Travel:Airfare"},
  {"Account":"5011","Full_Name":"Travel:Lodging"},
  {"Account":"5012","Full_Name":"Travel:Ground Transport"},
  {"Account":"5013","Full_Name":"Travel:Mileage"},
  {"Account":"5014","Full_Name":"Travel:Parking & Tolls"},
  {"Account":"5015","Full_Name":"Travel:Travel Meals"},
  {"Account":"5016","Full_Name":"Travel:Auto Fuel"},
  {"Account":"5017","Full_Name":"Travel:Auto Maintenance & Repair"},
  {"Account":"5200","Full_Name":"Office & Supplies"},
  {"Account":"5210","Full_Name":"Office & Supplies:Office Supplies"},
  {"Account":"5211","Full_Name":"Office & Supplies:Equipment"},
  {"Account":"5212","Full_Name":"Office & Supplies:Furniture"},
  {"Account":"5300","Full_Name":"Software & Subscriptions"},
  {"Account":"5310","Full_Name":"Software & Subscriptions:Software / SaaS"},
  {"Account":"5311","Full_Name":"Software & Subscriptions:Professional Dues & Memberships"},
  {"Account":"5312","Full_Name":"Software & Subscriptions:Publications & Education"},
  {"Account":"5400","Full_Name":"Utilities & Communication"},
  {"Account":"5410","Full_Name":"Utilities & Communication:Phone / Cellular"},
  {"Account":"5411","Full_Name":"Utilities & Communication:Internet"},
  {"Account":"5412","Full_Name":"Utilities & Communication:Other Utilities"},
  {"Account":"5500","Full_Name":"Marketing & Advertising"},
  {"Account":"5510","Full_Name":"Marketing & Advertising:Advertising"},
  {"Account":"5511","Full_Name":"Marketing & Advertising:Marketing Materials"},
  {"Account":"5512","Full_Name":"Marketing & Advertising:Conferences & Trade Shows"},
  {"Account":"5600","Full_Name":"Professional Services"},
  {"Account":"5610","Full_Name":"Professional Services:Legal & Accounting"},
  {"Account":"5611","Full_Name":"Professional Services:Consulting & Contractors"},
  {"Account":"5700","Full_Name":"Other Operating"},
  {"Account":"5710","Full_Name":"Other Operating:Bank & Merchant Fees"},
  {"Account":"5711","Full_Name":"Other Operating:Insurance"},
  {"Account":"5712","Full_Name":"Other Operating:Taxes & Licenses"},
  {"Account":"5713","Full_Name":"Other Operating:Other"},
  {"Account":"5800","Full_Name":"Rent / Office / Coworking"},
  {"Account":"5900","Full_Name":"Personal / Non-Business"}
])}

Each input line item may include receipt_group. You must preserve it exactly in the output for the corresponding classified row.

Line items to classify:
${JSON.stringify($json.line_items)}`;


// ═══════════════════════════════════════════
// DO NOT EDIT BELOW THIS LINE
// ═══════════════════════════════════════════
const requestBody = {
  system_instruction: {
    parts: [{ text: systemMessage }]
  },
  contents: [{
    role: "user",
    parts: [{ text: userPrompt }]
  }],
  generationConfig: {
    temperature: 0.0,
    topP: 0.0,
    responseMimeType: "application/json"
  }
};

return {
  json: requestBody
};
