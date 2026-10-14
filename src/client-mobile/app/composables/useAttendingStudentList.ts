import { AttendanceStatusEnum, type Session } from "~/schemas/session.schema";

// Students marked present or tardy; absent students can't do dailies or tests.
export function useAttendingStudentList(getSession: () => Session) {
  const { sessionStudentListRef } = useSessionStudentList(getSession);

  const attendingStudentListRef = computed(() => {
    const attendingStudentIdSet = new Set(getSession().attendance
      .filter(attendanceRecord => attendanceRecord.status !== AttendanceStatusEnum.Absent)
      .map(attendanceRecord => attendanceRecord.studentId));
    return (sessionStudentListRef.value ?? []).filter(studentItem => attendingStudentIdSet.has(studentItem.id));
  });

  return { attendingStudentListRef };
}
