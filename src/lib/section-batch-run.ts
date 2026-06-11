type BatchRunBatchSizeState = {
  isValid: boolean;
  overrideBatchSize: number | undefined;
};

export function normalizeBatchRunBatchSize(value: string): BatchRunBatchSizeState {
  const trimmedValue = value.trim();
  if (trimmedValue === "") {
    return { isValid: true, overrideBatchSize: undefined };
  }

  if (!/^\d+$/.test(trimmedValue)) {
    return { isValid: false, overrideBatchSize: undefined };
  }

  const parsedValue = Number(trimmedValue);
  if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
    return { isValid: false, overrideBatchSize: undefined };
  }

  return { isValid: true, overrideBatchSize: parsedValue };
}
