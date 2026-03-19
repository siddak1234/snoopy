"use client";

import { useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { StickyNoteData } from "./types";

export function StickyNoteNode({
  id,
  data,
  selected,
}: NodeProps & { data: StickyNoteData }) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const updateText = (text: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n)),
    );
  };

  return (
    <div className={`sticky-note-node${selected ? " selected" : ""}`}>
      <div className="flex shrink-0 items-center gap-1">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3 text-[var(--muted)]"
        >
          <path d="M9.333 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.667h8a1.333 1.333 0 0 0 1.333-1.334V5.333z" />
          <path d="M9.333 1.333v4h4" />
        </svg>
        <span className="text-[0.55rem] font-medium text-[var(--muted)]">
          Note
        </span>
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          value={data.text}
          onChange={(e) => updateText(e.target.value)}
          onBlur={() => setEditing(false)}
          className="nodrag nowheel mt-1 h-16 w-full resize-none rounded border border-[var(--ring)]/60 bg-transparent p-1 text-[0.6rem] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--muted)]/50"
          placeholder="Type a note…"
        />
      ) : (
        <div
          className="nodrag mt-1 h-16 cursor-text overflow-hidden rounded border border-dashed border-[var(--ring)]/60 p-1"
          onDoubleClick={() => setEditing(true)}
        >
          {data.text ? (
            <p className="whitespace-pre-wrap text-[0.6rem] leading-relaxed text-[var(--text)]">
              {data.text}
            </p>
          ) : (
            <p className="text-[0.55rem] text-[var(--muted)]/40">
              Double-click to edit
            </p>
          )}
        </div>
      )}
    </div>
  );
}
