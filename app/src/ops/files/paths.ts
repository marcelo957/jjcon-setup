/** Storage folder for a plan or PDF block: `plan:G` → `plan-G` (no colons in paths); custom ids as they are. */
export const slotFolder = (slot: string) => slot.replace(/^plan:/, 'plan-');
