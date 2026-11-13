const DRAFT_STORAGE_PREFIX = 'joeknock.interactionDraft.v1';
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
  interactionId,
}) {
  const scope = buildScope({ userId, organizationId, propertyId });

  if (!scope) {
    return null;
  }

  const base = `${DRAFT_STORAGE_PREFIX}:${scope.orgScope}:${scope.userScope}:${scope.propertyScope}`;

  // Create drafts keep the original key; edit drafts are separate per
  // interaction so the two kinds can never overwrite or restore each other.
  if (interactionId === undefined || interactionId === null) {
    return base;
  }

  const interactionScope = toNonEmpty(String(interactionId));
  return interactionScope ? `${base}:edit:${interactionScope}` : null;
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
    const savedAt = Date.parse(parsed?.updatedAt);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      !Number.isFinite(savedAt) ||
      savedAt > Date.now() ||
      Date.now() - savedAt >= DRAFT_MAX_AGE_MS
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveInteractionDraft(scope, draft) {
  const key = buildInteractionDraftKey(scope);

  if (!key) {
    return false;
  }

  try {
    localStorage.setItem(
      key,
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearUserInteractionDrafts(userId) {
  if (!toNonEmpty(userId)) return false;
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (
        key?.startsWith(`${DRAFT_STORAGE_PREFIX}:`) &&
        key.split(':')[2] === userId
      ) {
        localStorage.removeItem(key);
      }
    }
    return true;
  } catch {
    return false;
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
