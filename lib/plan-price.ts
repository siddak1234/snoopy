import type { components } from "@/lib/generated/platform-contracts/platform";

type PlanPrice = components["schemas"]["PlanPrice"];

/**
 * How many minor units make one major unit, for the currencies a price is shown
 * in. The platform publishes a plan's price in the provider's MINOR units (backend
 * ADR-0031), and the divisor is not something `Intl` can be trusted to supply:
 * its display digits and the provider's minor units disagree for some currencies,
 * which would show a price a hundred times wrong. So the exponent is stated here,
 * for currencies where the provider's minor unit and ISO 4217 agree, and any
 * other currency is not formatted — the page says the price is shown at checkout.
 */
const MINOR_UNIT_EXPONENT: Readonly<Record<string, number>> = {
  usd: 2,
  eur: 2,
  gbp: 2,
  cad: 2,
  aud: 2,
  nzd: 2,
  chf: 2,
  sek: 2,
  nok: 2,
  dkk: 2,
  sgd: 2,
  hkd: 2,
  jpy: 0,
  krw: 0,
};

/**
 * A plan's price as a person reads it — backend §12.1 #163 — or `undefined` when
 * this website cannot state it without guessing. A fixed locale and explicit
 * fraction digits, because this renders on the server and in the browser and
 * must read the same on both.
 */
export function formatPlanPrice(price: PlanPrice): string | undefined {
  if (!Object.hasOwn(MINOR_UNIT_EXPONENT, price.currency)) return undefined;
  const exponent = MINOR_UNIT_EXPONENT[price.currency];
  if (exponent === undefined || !Number.isSafeInteger(price.amount)) {
    return undefined;
  }
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(price.amount / 10 ** exponent);
  return price.interval ? `${amount} per ${price.interval}` : amount;
}
