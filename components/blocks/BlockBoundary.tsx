"use client";

import { Component, type ReactNode } from "react";
import { notDrawn } from "./drawable";
import { Fallback } from "./Fallback";

/**
 * What a boundary is reset by: its block's content. A re-read that sends the
 * same block keeps a caught block the fallback; one that sends a different
 * block at that place draws it, and a throw there is caught and logged as
 * any other is.
 */
export function contentKey(block: unknown): string {
  try {
    return JSON.stringify(block) ?? "";
  } catch {
    return "";
  }
}

type Props = { type: string; block: unknown; children: ReactNode };
type State = { failed: boolean; key: string };

/**
 * One block's error boundary (Round 21, design D2.6): a block whose renderer
 * throws in the browser draws `Fallback` in its place, logged once by
 * `notDrawn` with the block's type, and the blocks around it still draw. It
 * catches a redraw in the browser (RunLive and ItemLive, after their first
 * draw and at each poll); a server render, the first draw of every page, is
 * not caught by any boundary, so there the field check in `BlockList`
 * (`drawable`) is what keeps a block from ending the page. A caught block
 * stays the fallback until a re-read sends another block in its place
 * (`contentKey`), which is then drawn.
 */
export class BlockBoundary extends Component<Props, State> {
  state = { failed: false, key: contentKey(this.props.block) };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    const key = contentKey(props.block);
    return key === state.key ? null : { failed: false, key };
  }

  componentDidCatch(error: unknown): void {
    notDrawn(this.props.type, error);
  }

  render(): ReactNode {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}
