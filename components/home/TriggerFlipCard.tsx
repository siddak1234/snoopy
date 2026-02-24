"use client";

import { useState } from "react";
import { TriggerIcon } from "@/components/icons/processIcons";
import ProcessStepFlipCard from "@/components/home/ProcessStepFlipCard";

function TriggerBackScene() {
  return (
    <>
      <span className="scene-envelope">
        <span className="scene-flap" />
        <span className="scene-fold-left" />
        <span className="scene-fold-right" />
      </span>

      <span className="scene-mailbox">
        <span className="scene-mailbox-post" />
        <span className="scene-mailbox-body" />
        <span className="scene-mailbox-slot" />
        <span className="scene-mailbox-mouth" />
        <span className="scene-mailbox-door" />
        <span className="scene-mailbox-flag" />
      </span>
    </>
  );
}

export default function TriggerFlipCard() {
  const [sceneRunId, setSceneRunId] = useState(0);

  return (
    <ProcessStepFlipCard
      stepNumber={1}
      title="Trigger"
      description="A message arrives, a file is received, or a scheduled event."
      icon={<TriggerIcon style={{ width: "3rem", height: "3rem" }} />}
      backTitle="Work Starts Anywhere"
      backContent={<TriggerBackScene />}
      backKey={sceneRunId}
      onFlipToBack={() => setSceneRunId((current) => current + 1)}
    />
  );
}
