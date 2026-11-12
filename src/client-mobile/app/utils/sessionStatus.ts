import { SessionStatusEnum } from "~/schemas/session.schema";

export const sessionStatusColorMap: Record<SessionStatusEnum, "success" | "error" | "neutral" | "info"> = {
  [SessionStatusEnum.Exported]: "success",
  [SessionStatusEnum.Drafting]: "error",
  [SessionStatusEnum.Completed]: "neutral",
  [SessionStatusEnum.Archived]: "info"
};
