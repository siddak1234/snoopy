import type { Metadata } from "next";
import { BuilderCanvas } from "@/components/builder/BuilderCanvas";

export const metadata: Metadata = {
  title: "Builder",
};

/**
 * The interactive workflow canvas. Auth is enforced twice: middleware
 * protects /account/*, and the account layout verifies the session before
 * rendering. The canvas is fixed-position full-viewport, so it overlays the
 * dashboard sidebar; the account top bar stays visible above it.
 */
export default function BuilderPage() {
  return <BuilderCanvas />;
}
