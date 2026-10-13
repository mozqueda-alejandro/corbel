export function useDBTest() {
  async function clearUserAndClassData() {
    const database = useDatabase();
    await database.sessionTable.clear();
    await database.userTable.clear();
    await database.classTable.clear();
    await database.noteTable.clear();
    // Re-importing test data brings new test ids, so the old rows would linger as nameless dropdown entries.
    await database.testVariantTable.clear();
    await database.photoTable.clear();
    window.location.reload();
  }

  return { clearUserAndClassData };
}
