"use client";

import { Component, type ReactNode } from "react";
import { notDrawn } from "./drawable";
import { Fallback } from "./Fallback";

/**
 * One block's error boundary (Round 21, design D2.6): a block whose renderer
 * throws in the browser draws `Fallback` in its place, logged once by
 * `notDrawn` with the block's type, and the blocks around it still draw. It
 * catches on the pages drawn in the browser (RunLive, ItemLive); a server
 * render is not caught by any boundary, so on the item's file page the field
 * check in `BlockList` (`drawable`) is what keeps a block from ending the page.
 */
export class BlockBoundary extends Component<
  { type: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    notDrawn(this.props.type, error);
  }

  render(): ReactNode {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}
