import { defaultUserSettings, type User, userSchema, type UserSettings, userSettingsSchema } from "~/schemas/user.schema";

export function useUserRepository() {
  const database = useDatabase();

  const { data: userListRef, error: userListErrorRef } = useLiveQuery(() => database.userTable.toArray());

  const currentUserRef = computed(() => userListRef.value?.[0]);

  // Users created before settings existed fall back to the defaults.
  const currentUserSettingsRef = computed<UserSettings>(() => currentUserRef.value?.settings ?? defaultUserSettings);

  async function saveUser(userData: User) {
    const validatedUser = userSchema.parse(userData);
    await database.userTable.put(validatedUser);
  }

  async function saveUserSettings(settings: UserSettings) {
    const currentUser = currentUserRef.value;
    if (!currentUser) throw new Error("No user to save settings for.");
    await saveUser({ ...currentUser, settings: userSettingsSchema.parse(settings) });
  }

  return { userListRef, userListErrorRef, currentUserRef, currentUserSettingsRef, saveUser, saveUserSettings };
}
