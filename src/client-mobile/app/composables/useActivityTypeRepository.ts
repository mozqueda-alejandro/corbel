export function useActivityTypeRepository() {
  const database = useDatabase();

  const { data: activityTypeListRef, error: activityTypeListErrorRef } = useLiveQuery(() => database.activityTypeTable.toArray());

  return { activityTypeListRef, activityTypeListErrorRef };
}
