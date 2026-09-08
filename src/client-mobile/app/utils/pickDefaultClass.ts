import type { Class } from "~/schemas/class.schema";

export function pickDefaultClass(classList: Class[]): Class | undefined {
  if (!classList.length) return undefined;

  const todayDate = new Date();

  const activeClass = classList.find(classItem => classItem.startDate <= todayDate && todayDate <= classItem.endDate);
  if (activeClass) return activeClass;

  const upcomingClassList = classList
    .filter(classItem => classItem.startDate > todayDate)
    .sort((firstClass, secondClass) => firstClass.startDate.getTime() - secondClass.startDate.getTime());
  if (upcomingClassList.length) return upcomingClassList[0];

  const pastClassList = [...classList].sort((firstClass, secondClass) => secondClass.endDate.getTime() - firstClass.endDate.getTime());
  return pastClassList[0];
}
