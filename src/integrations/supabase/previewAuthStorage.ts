// Browser storage for Supabase auth sessions.
export function browserAuthStorage() {
  if (typeof window === 'undefined') return undefined;
  return localStorage;
}
