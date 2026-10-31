import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { auth, db } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

// Circuit breaker for Firestore quota exhaustion
let quotaExhausted = false;
let lastQuotaExhaustedTime = 0;
const QUOTA_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown before testing writes again

export function isFirestoreQuotaExhausted(): boolean {
  if (quotaExhausted) {
    if (Date.now() - lastQuotaExhaustedTime > QUOTA_COOLDOWN_MS) {
      quotaExhausted = false; // Cooldown expired, allow trying again
      try {
        enableNetwork(db).catch(() => {});
      } catch (_) {}
    }
  }
  return quotaExhausted;
}

export function markQuotaExhausted(): void {
  quotaExhausted = true;
  lastQuotaExhaustedTime = Date.now();
  try {
    // Disable network so Firestore stops background backoff retry loops
    disableNetwork(db).catch(() => {});
  } catch (_) {}
  console.warn('⚡ Firestore daily free write quota is exhausted. Automatically switching to resilient LocalStorage & Google Sheets mode.');
}

export function clearQuotaExhausted(): void {
  quotaExhausted = false;
  lastQuotaExhaustedTime = 0;
  try {
    enableNetwork(db).catch(() => {});
  } catch (_) {}
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuota = errMsg.includes('resource-exhausted') || 
                  errMsg.includes('Quota limit exceeded') || 
                  errMsg.includes('Quota exceeded') ||
                  (error as any)?.code === 'resource-exhausted';

  if (isQuota) {
    markQuotaExhausted();
    // Log as a clean warning rather than a red console error to prevent noisy stack traces
    console.warn(`[Firestore Quota Notice] (${operationType} on ${path || 'unknown'}): Free daily quota reached. Local fallback is active.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

