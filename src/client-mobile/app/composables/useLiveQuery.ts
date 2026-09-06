import { liveQuery, type Subscription } from "dexie";
import type { Ref, WatchSource } from "vue";

interface UseLiveQueryResult<T> {
  data: Ref<T | undefined>
  error: Ref<unknown>
}

export default function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  dependencies: WatchSource[] = []
): UseLiveQueryResult<T> {
  const data = ref<T>() as Ref<T | undefined>;
  const error = ref<unknown>(null);
  let subscription: Subscription | undefined;

  function subscribe(): void {
    subscription?.unsubscribe();
    error.value = null;
    subscription = liveQuery(querier).subscribe({
      next: result => (data.value = result),
      error: err => (error.value = err)
    });
  }

  watch(dependencies, subscribe, { immediate: true });
  onUnmounted(() => subscription?.unsubscribe());

  return { data, error };
}
