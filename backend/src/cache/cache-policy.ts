export const CACHE_TTL_SECONDS = {
  transactions: {
    list: 30,
    item: 90,
    account: 30,
  },
  accounts: {
    list: 90,
    item: 120,
  },
  goals: {
    list: 180,
    item: 180,
  },
  loans: {
    list: 90,
    item: 90,
  },
} as const;
