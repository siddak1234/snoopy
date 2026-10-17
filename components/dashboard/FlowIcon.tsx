import { ChartLineIcon } from "@phosphor-icons/react/dist/ssr/ChartLine";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { FlowArrowIcon } from "@phosphor-icons/react/dist/ssr/FlowArrow";
import { LightningIcon } from "@phosphor-icons/react/dist/ssr/Lightning";
import { ReceiptIcon } from "@phosphor-icons/react/dist/ssr/Receipt";
import { TableIcon } from "@phosphor-icons/react/dist/ssr/Table";

/**
 * A flow's icon (24), by the name its catalog entry publishes
 * (`AutomationCatalogEntry.icon`: "An icon name the clients resolve. Never an
 * asset URL.") — an explicit map, as the app's icon registry is, so only these
 * icons are bundled; any other name is the flow arrow, never a crash.
 */
const ICONS = {
  ChartLine: ChartLineIcon,
  EnvelopeSimple: EnvelopeSimpleIcon,
  Lightning: LightningIcon,
  Receipt: ReceiptIcon,
  Table: TableIcon,
} as const;

export function FlowIcon({ name }: { name: string | null | undefined }) {
  const Icon =
    name && Object.hasOwn(ICONS, name)
      ? ICONS[name as keyof typeof ICONS]
      : FlowArrowIcon;
  return <Icon aria-hidden size={24} className="shrink-0 text-[var(--link)]" />;
}
