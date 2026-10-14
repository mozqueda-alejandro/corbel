import type { Session } from "~/schemas/session.schema";
import type { SessionStudent } from "~/schemas/student.schema";

// A session that has been completed once uses the roster frozen at that moment, even if it is later
// reverted to draft; otherwise it follows the live student list. Undefined while the live list is loading.
export function useSessionStudentList(getSession: () => Session) {
  const { studentListRef } = useStudentRepository();

  const isRosterFrozenRef = computed(() => getSession().studentRoster !== undefined);

  const sessionStudentListRef = computed<SessionStudent[] | undefined>(() => getSession().studentRoster ?? studentListRef.value);

  return { sessionStudentListRef, isRosterFrozenRef };
}
