export function pendingActionFor<Action extends string>(
  pendingActions: Readonly<Record<string, Action>>,
  entityId: string | null | undefined,
): Action | undefined {
  return entityId ? pendingActions[entityId] : undefined;
}

export function isEntityPending(
  pendingEntityIds: ReadonlySet<string>,
  entityId: string | null | undefined,
): boolean {
  return Boolean(entityId && pendingEntityIds.has(entityId));
}

export function isDomainSaving<Domain extends string>(
  pendingDomains: Readonly<Partial<Record<Domain, boolean>>>,
  domain: Domain,
): boolean {
  return pendingDomains[domain] === true;
}
