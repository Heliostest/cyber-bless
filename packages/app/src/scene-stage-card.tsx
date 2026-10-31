import type { ReactNode } from "react";

/** Keep page copy inside the card without adding React children to an engine-owned host. */
export function SceneStageCard({ children, intention }: { children: ReactNode; intention?: ReactNode }) {
  return <div className="scene-stage-card">{children}{intention}</div>;
}
