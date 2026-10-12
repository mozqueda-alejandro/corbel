// Archives completed sessions past the user's threshold on app load and whenever the setting changes.
export function useAutoArchive() {
  const toast = useToast();
  const { currentUserRef, currentUserSettingsRef } = useUserRepository();
  const { archiveDueSessions } = useSessionRepository();

  watch(
    () => currentUserRef.value && JSON.stringify(currentUserSettingsRef.value.autoArchive),
    async (autoArchiveKey) => {
      if (!autoArchiveKey) return;
      try {
        const archivedCount = await archiveDueSessions(currentUserSettingsRef.value);
        if (archivedCount === 0) return;
        toast.add({
          title: `${archivedCount} completed ${archivedCount === 1 ? "session" : "sessions"} archived`,
          description: "Change this in Settings.",
          color: "info",
          icon: "i-lucide-archive"
        });
      } catch (archiveError) {
        console.error("Auto-archive failed:", archiveError);
      }
    },
    { immediate: true }
  );
}
