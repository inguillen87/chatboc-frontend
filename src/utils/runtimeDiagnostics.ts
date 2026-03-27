const ENABLE_RUNTIME_DIAGNOSTICS =
  import.meta.env.DEV ||
  String(
    import.meta.env.VITE_RUNTIME_DIAGNOSTICS ??
      import.meta.env.NEXT_PUBLIC_RUNTIME_DIAGNOSTICS ??
      '',
  )
    .trim()
    .toLowerCase() === 'true';

export const runtimeDiagnostics = {
  enabled: ENABLE_RUNTIME_DIAGNOSTICS,
  warn: (...args: unknown[]) => {
    if (ENABLE_RUNTIME_DIAGNOSTICS) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (ENABLE_RUNTIME_DIAGNOSTICS) {
      console.error(...args);
    }
  },
};

