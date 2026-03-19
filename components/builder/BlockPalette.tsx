"use client";

import { BLOCK_DEFS, type BlockType } from "./types";
import { BlockIconTile } from "./block-icons";

function onDragStart(event: React.DragEvent, blockType: BlockType) {
  event.dataTransfer.setData("application/reactflow", blockType);
  event.dataTransfer.effectAllowed = "move";
}

export function BlockPalette() {
  return (
    <aside className="relative z-10 flex w-28 shrink-0 flex-col border-r border-[var(--ring)]/50 bg-[var(--surface)]/60 px-2.5 py-3 backdrop-blur-sm">
      <h2 className="px-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
        Blocks
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {BLOCK_DEFS.map(({ type, label }) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            className="flex cursor-grab flex-col items-center gap-1.5 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-1 py-3 transition hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] active:cursor-grabbing"
          >
            <BlockIconTile type={type} size="md" />
            <span className="text-[0.6rem] font-medium leading-tight text-[var(--text)]">
              {label}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
