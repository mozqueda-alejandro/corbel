import { SessionStatusEnum } from "~/schemas/session.schema";

export const sessionStatusColorMap: Record<SessionStatusEnum, "success" | "error" | "neutral" | "info"> = {
  [SessionStatusEnum.Exported]: "success",
  [SessionStatusEnum.Drafting]: "error",
  [SessionStatusEnum.Completed]: "neutral",
  [SessionStatusEnum.Archived]: "info"
};

export const sessionStatusIconMap: Record<SessionStatusEnum, string> = {
  [SessionStatusEnum.Exported]: "i-lucide-upload",
  [SessionStatusEnum.Drafting]: "i-lucide-pencil-line",
  [SessionStatusEnum.Completed]: "i-lucide-lock",
  [SessionStatusEnum.Archived]: "i-lucide-archive"
};
