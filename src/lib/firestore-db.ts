import { restFindById, restFindFirst, restFindMany, restCreateDoc, restUpdateDoc, restDeleteDoc } from './firestore-rest';

export const collections = {
  profiles: 'profiles',
  clients: 'clients',
  loans: 'loans',
  payments: 'payments',
  capitalMovements: 'capital_movements',
  lateFees: 'late_fees',
  dailySettlements: 'daily_settlements',
  cajaMovements: 'caja_movements',
  notifications: 'notifications',
  auditLogs: 'audit_logs',
  chatMessages: 'chat_messages',
  settings: 'settings',
  zones: 'zones',
  collectorZones: 'collector_zones',
  loanPayments: 'loan_payments',
  paymentSchedules: 'payment_schedules',
  guarantors: 'guarantors',
  collectorExpenses: 'collector_expenses',
  locations: 'locations',
  reminders: 'reminders',
  paymentLinks: 'payment_links',
  companies: 'companies',
  chargeOffs: 'charge_offs',
  clientNotes: 'client_notes',
  lateFeeExecutions: 'late_fee_executions',
  pushSubscriptions: 'push_subscriptions',
};

export async function findProfileByFirebaseUid(firebaseUid: string) {
  return findFirst(collections.profiles, { firebaseUid });
}

export async function findProfileById(id: string) {
  return findById(collections.profiles, id);
}

export async function findProfileByEmail(email: string) {
  return findFirst(collections.profiles, { email: email.toLowerCase() });
}

export async function findManyProfiles(where?: Record<string, unknown>) {
  return findMany(collections.profiles, where);
}

export async function createProfile(data: Record<string, unknown>) {
  const id = data.firebaseUid as string || undefined;
  return createDoc(collections.profiles, data, id);
}

export async function updateProfile(id: string, data: Record<string, unknown>) {
  return updateDoc(collections.profiles, id, data);
}

export async function deleteProfile(id: string) {
  return deleteDoc(collections.profiles, id);
}

export async function findById(collection: string, id: string) {
  return restFindById(collection, id);
}

export async function findMany(collection: string, where?: Record<string, unknown>, orderBy?: { field: string; direction?: 'asc' | 'desc' }, limit?: number) {
  if (orderBy) {
    const results = await restFindMany(collection, where, limit);
    const dir = orderBy.direction === 'desc' ? -1 : 1;
    results.sort((a: any, b: any) => {
      const av = a[orderBy.field];
      const bv = b[orderBy.field];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return results;
  }
  return restFindMany(collection, where, limit);
}

export async function findFirst(collection: string, where: Record<string, unknown>) {
  return restFindFirst(collection, where);
}

export async function createDoc(collection: string, data: Record<string, unknown>, id?: string) {
  return restCreateDoc(collection, data, id);
}

export async function updateDoc(collection: string, id: string, data: Record<string, unknown>) {
  return restUpdateDoc(collection, id, data);
}

export async function deleteDoc(collection: string, id: string) {
  return restDeleteDoc(collection, id);
}

export async function deleteMany(collection: string, field: string, value: string) {
  const results = await restFindMany(collection, { [field]: value });
  for (const doc of results) {
    await restDeleteDoc(collection, doc.id as string);
  }
  return { deleted: results.length };
}

export async function createMany(collection: string, items: Record<string, unknown>[]) {
  for (const item of items) {
    const id = item.id as string || undefined;
    await restCreateDoc(collection, item, id);
  }
  return { created: items.length };
}

export async function runTransaction<T>(fn: (transaction: any) => Promise<T>): Promise<T> {
  return fn({
    get: async (ref: any) => {
      const parts = ref.path?.split('/') || [];
      const collection = parts[parts.length - 2];
      const id = parts[parts.length - 1];
      const doc = await restFindById(collection, id);
      return { exists: !!doc, data: () => doc, id };
    },
    update: async (ref: any, data: Record<string, unknown>) => {
      const parts = ref.path?.split('/') || [];
      const collection = parts[parts.length - 2];
      const id = parts[parts.length - 1];
      await restUpdateDoc(collection, id, data);
    },
    create: async (ref: any, data: Record<string, unknown>) => {
      const parts = ref.path?.split('/') || [];
      const collection = parts[parts.length - 2];
      const id = parts[parts.length - 1];
      await restCreateDoc(collection, data, id);
    },
    delete: async (ref: any) => {
      const parts = ref.path?.split('/') || [];
      const collection = parts[parts.length - 2];
      const id = parts[parts.length - 1];
      await restDeleteDoc(collection, id);
    },
  });
}
