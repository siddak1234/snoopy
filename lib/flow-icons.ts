import type { Icon } from "@phosphor-icons/react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";
import { BellRingingIcon } from "@phosphor-icons/react/dist/ssr/BellRinging";
import { CameraIcon } from "@phosphor-icons/react/dist/ssr/Camera";
import { ChartLineIcon } from "@phosphor-icons/react/dist/ssr/ChartLine";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { CircleDashedIcon } from "@phosphor-icons/react/dist/ssr/CircleDashed";
import { CrownSimpleIcon } from "@phosphor-icons/react/dist/ssr/CrownSimple";
import { EnvelopeOpenIcon } from "@phosphor-icons/react/dist/ssr/EnvelopeOpen";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { GitBranchIcon } from "@phosphor-icons/react/dist/ssr/GitBranch";
import { HandPalmIcon } from "@phosphor-icons/react/dist/ssr/HandPalm";
import { LightningIcon } from "@phosphor-icons/react/dist/ssr/Lightning";
import { PlugsConnectedIcon } from "@phosphor-icons/react/dist/ssr/PlugsConnected";
import { ReceiptIcon } from "@phosphor-icons/react/dist/ssr/Receipt";
import { SlackLogoIcon } from "@phosphor-icons/react/dist/ssr/SlackLogo";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { TableIcon } from "@phosphor-icons/react/dist/ssr/Table";
import { TimerIcon } from "@phosphor-icons/react/dist/ssr/Timer";
import { TrayIcon } from "@phosphor-icons/react/dist/ssr/Tray";
import { UserPlusIcon } from "@phosphor-icons/react/dist/ssr/UserPlus";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr/UsersThree";
import { XCircleIcon } from "@phosphor-icons/react/dist/ssr/XCircle";

/**
 * A flow's icon by the catalog's name (`AutomationCatalogEntry.icon`: "An
 * icon name the clients resolve. Never an asset URL."), the app's `iconFor`
 * (`snoopy-mobile/lib/view/icon-registry.ts`) on the website: the same
 * names, the same Phosphor set, one explicit map so only these icons are
 * bundled. The owner's builds 37 and 39, items 1 and 4 ("Make a standard for
 * flow cards … Icon, short deacription and live"): every flow card draws one
 * (`FlowCard`).
 *
 * The catalog sends `Sparkles` for ICD-10 (snoopy-automations
 * manifests/icd10-code-check.v*.json), a name Phosphor does not have; it is
 * read as `Sparkle`, in both clients. An unknown name, or none, is the
 * neutral `CircleDashed`, never a crash.
 */

/** Neutral: "something is here", without saying what. */
export const FALLBACK_ICON: Icon = CircleDashedIcon;

const ICONS: Readonly<Record<string, Icon>> = {
  ArrowClockwise: ArrowClockwiseIcon,
  BellRinging: BellRingingIcon,
  Camera: CameraIcon,
  ChartLine: ChartLineIcon,
  CheckCircle: CheckCircleIcon,
  CircleDashed: CircleDashedIcon,
  CrownSimple: CrownSimpleIcon,
  EnvelopeOpen: EnvelopeOpenIcon,
  EnvelopeSimple: EnvelopeSimpleIcon,
  GitBranch: GitBranchIcon,
  HandPalm: HandPalmIcon,
  Lightning: LightningIcon,
  PlugsConnected: PlugsConnectedIcon,
  Receipt: ReceiptIcon,
  SlackLogo: SlackLogoIcon,
  Sparkle: SparkleIcon,
  Table: TableIcon,
  Timer: TimerIcon,
  Tray: TrayIcon,
  UserPlus: UserPlusIcon,
  UsersThree: UsersThreeIcon,
  XCircle: XCircleIcon,
};

/** The catalog's names Phosphor calls otherwise. */
const ALIASES: Readonly<Record<string, string>> = { Sparkles: "Sparkle" };

/** The icon a catalog name draws; the fallback for an unknown name or none. */
export function iconFor(name: string | null | undefined): Icon {
  if (!name) return FALLBACK_ICON;
  const trimmed = name.trim();
  return ICONS[ALIASES[trimmed] ?? trimmed] ?? FALLBACK_ICON;
}
