import type { Session } from "~/schemas/session.schema";

// The live tests, except that a test this session has already scored uses the session's copy.
export function useSessionTestVariantList(getSession: () => Session) {
  const { testVariantListRef } = useTestVariantRepository();

  const sessionTestVariantListRef = computed(() => {
    const testVariantById = new Map((testVariantListRef.value ?? []).map(testVariant => [testVariant.id, testVariant]));
    for (const testVariant of getSession().testVariants ?? []) testVariantById.set(testVariant.id, testVariant);
    return [...testVariantById.values()];
  });

  return { sessionTestVariantListRef };
}
