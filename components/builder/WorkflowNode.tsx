import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { WorkflowNodeData } from "./types";
import { BlockIconTile } from "./block-icons";

export function WorkflowNode({
  data,
  selected,
}: NodeProps & { data: WorkflowNodeData }) {
  return (
    <div className={`workflow-node${selected ? " selected" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[0.65rem] font-semibold leading-tight text-[var(--text)]">
          {data.label}
        </span>
        <BlockIconTile type={data.blockType} size="sm" />
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
