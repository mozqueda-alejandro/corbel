import { type Class, classSchema } from "~/schemas/class.schema";

export function useClassRepository() {
  const database = useDatabase();

  const { data: classListRef, error: classListErrorRef } = useLiveQuery(() => database.classTable.toArray());

  async function saveClass(classData: Class) {
    const validatedClass = classSchema.parse(classData);
    await database.classTable.put(validatedClass);
  }

  async function deleteClass(classId: string) {
    await database.classTable.delete(classId);
  }

  return { classListRef, classListErrorRef, saveClass, deleteClass };
}
