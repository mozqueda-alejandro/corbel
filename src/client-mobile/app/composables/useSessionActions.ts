import type { Session } from "~/schemas/session.schema";

// Transitions that can be reversed from the success toast.
const undoTransitionMap: Partial<Record<SessionTransitionEnum, SessionTransitionEnum>> = {
  [SessionTransitionEnum.Complete]: SessionTransitionEnum.RevertToDraft,
  [SessionTransitionEnum.Archive]: SessionTransitionEnum.Unarchive,
  [SessionTransitionEnum.Unarchive]: SessionTransitionEnum.Archive
};

export function useSessionActions() {
  const toast = useToast();
  const { transitionSession, exportSession } = useSessionRepository();

  function getAvailableTransitionList(session: Pick<Session, "status">): SessionTransitionEnum[] {
    return Object.values(SessionTransitionEnum).filter(transition => canTransitionSession(session, transition));
  }

  async function runSessionTransition(session: Pick<Session, "id" | "name">, transition: SessionTransitionEnum, { allowUndo = true } = {}) {
    const { pastTense } = sessionTransitionDisplayMap[transition];
    try {
      const updatedSession = transition === SessionTransitionEnum.Export
        ? await exportSession(session.id)
        : await transitionSession(session.id, transition);
      if (!updatedSession) return undefined;

      const undoTransition = allowUndo ? undoTransitionMap[transition] : undefined;
      toast.add({
        title: `"${session.name}" ${pastTense}`,
        color: "success",
        icon: sessionTransitionDisplayMap[transition].icon,
        actions: undoTransition
          ? [{ label: "Undo", color: "neutral", variant: "outline", onClick: () => { runSessionTransition(session, undoTransition, { allowUndo: false }); } }]
          : undefined
      });
      return updatedSession;
    } catch (transitionError) {
      console.error(`Session ${transition.toLowerCase()} failed:`, transitionError);
      toast.add({
        title: `Couldn't ${sessionTransitionDisplayMap[transition].label.toLowerCase()} session`,
        description: transitionError instanceof Error ? transitionError.message : undefined,
        color: "error",
        icon: "i-lucide-circle-x"
      });
      return undefined;
    }
  }

  return { getAvailableTransitionList, runSessionTransition };
}
