import { type ActivityType, activityNameSchema } from "~/schemas/activity-type.schema";

export function useActivityTypeRepository() {
  const database = useDatabase();

  const { data: activityTypeListRef, error: activityTypeListErrorRef } = useLiveQuery(() => database.activityTypeTable.toArray());

  function isActivityNameTaken(name: string) {
    const lowerName = name.trim().toLowerCase();
    return (activityTypeListRef.value ?? []).some(activityType => activityType.name.toLowerCase() === lowerName);
  }

  // The duplicate check is repeated inside the transaction so two quick saves can't both pass it.
  async function saveActivityType(name: string): Promise<ActivityType> {
    const validatedName = activityNameSchema.parse(name);
    return database.transaction("rw", database.activityTypeTable, async () => {
      const lowerName = validatedName.toLowerCase();
      const existingList = await database.activityTypeTable.toArray();
      if (existingList.some(activityType => activityType.name.toLowerCase() === lowerName)) {
        throw new Error(`"${validatedName}" already exists.`);
      }
      const activityType = { id: crypto.randomUUID(), name: validatedName };
      await database.activityTypeTable.add(activityType);
      return activityType;
    });
  }

  return { activityTypeListRef, activityTypeListErrorRef, isActivityNameTaken, saveActivityType };
}
