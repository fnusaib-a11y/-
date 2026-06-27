import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const rawConfig: any = firebaseConfig;
const config = rawConfig && rawConfig.default ? rawConfig.default : rawConfig;

console.log('[Firebase Init] Extracted firebaseConfig:', {
  projectId: config?.projectId,
  appId: config?.appId,
  apiKey: config?.apiKey ? 'PRESENT (hidden)' : 'MISSING',
});

const app = initializeApp(config);

let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({ forceOwnership: true }),
    }),
    ignoreUndefinedProperties: true,
  });
} catch (e) {
  console.warn('[Firebase Init] Persistent local cache initialization failed, falling back to default:', e);
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const auth = getAuth(app);

console.log('[Firebase Init] Firestore instance initialized:', !!db);

// Sign in anonymously on startup to ensure authenticated requests
signInAnonymously(auth).catch((err) => {
  console.warn('Firebase Anonymous Login failed:', err);
});

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, shouldThrow = true) {
  const isNetworkOrUnavailable = 
    error && 
    typeof error === 'object' && 
    (('code' in error && (error.code === 'unavailable' || error.code === 'failed-precondition' || error.code === 'permission-denied')) ||
     ('message' in error && String(error.message).toLowerCase().includes('reach cloud firestore backend')) ||
     ('message' in error && String(error.message).toLowerCase().includes('offline')) ||
     ('message' in error && String(error.message).toLowerCase().includes('unavailable')));

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  console.warn('[Firestore Status Warning]:', JSON.stringify(errInfo));
  
  if (isNetworkOrUnavailable || !shouldThrow) {
    console.log('[Firestore] Gracefully operating in local mode (Offline is Active).');
    return;
  }
  
  throw new Error(JSON.stringify(errInfo));
}
