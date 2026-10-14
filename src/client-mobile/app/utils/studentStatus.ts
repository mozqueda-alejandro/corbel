import { StudentStatusEnum } from "~/schemas/student.schema";

export const studentStatusColorMap: Record<StudentStatusEnum, "success" | "neutral" | "info"> = {
  [StudentStatusEnum.Active]: "success",
  [StudentStatusEnum.Inactive]: "neutral",
  [StudentStatusEnum.Graduated]: "info"
};

export function getStudentFullName(student: { firstName: string, lastName: string }) {
  return `${student.firstName} ${student.lastName}`.trim();
}
