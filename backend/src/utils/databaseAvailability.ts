export const isDatabaseUnavailableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes('connect econnrefused') ||
    message.includes('connection refused') ||
    message.includes('failed to connect') ||
    message.includes('p1001') ||
    message.includes('timed out')
  );
};
