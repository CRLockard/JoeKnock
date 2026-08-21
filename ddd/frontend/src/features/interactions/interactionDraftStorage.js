const DRAFT_STORAGE_PREFIX = 'joeknock.interactionDraft.v1';

function toNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function buildScope({ userId, organizationId, propertyId }) {
  const userScope = toNonEmpty(userId);
  const orgScope = toNonEmpty(organizationId);
  const propertyScope = toNonEmpty(propertyId);

  if (!userScope || !propertyScope) {
    return null;
  }

  // Include organization scope defensively so draft keys remain isolated even
  // if the same user id format appears across different tenants/environments.
  return {
    userScope,
    orgScope: orgScope ?? 'org-unknown',
    propertyScope,
  };
}

export function buildInteractionDraftKey({
  userId,
  organizationId,
  propertyId,
}) {
  const scope = buildScope({ userId, organizationId, propertyId });

  if (!scope) {
    return null;
  }

  return `${DRAFT_STORAGE_PREFIX}:${scope.orgScope}:${scope.userScope}:${scope.propertyScope}`;
}

export function loadInteractionDraft(scope) {
  const key = buildInteractionDraftKey(scope);

  if (!key) {
    return null;
  }

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    // Draft schema is intentionally permissive for MVP resiliency; malformed
    // payloads are ignored instead of blocking interaction entry.
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveInteractionDraft(scope, draft) {
  const key = buildInteractionDraftKey(scope);

  if (!key) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage write failures should not block interaction flow.
  }
}

export function clearInteractionDraft(scope) {
  const key = buildInteractionDraftKey(scope);

  if (!key) {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // Storage failures are non-fatal for the active form state.
  }
}
