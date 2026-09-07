export function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

export function isEmpty(value: string | null | undefined) {
  return value === null || value === undefined || value.length === 0;
}
