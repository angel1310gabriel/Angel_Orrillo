import { NextRequest, NextResponse } from 'next/server';
import { findMany, findFirst, createDoc, collections } from '@/lib/firestore-db';

// GET /api/audit - List audit logs with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');
    const severity = searchParams.get('severity');
    const userId = searchParams.get('userId');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (severity) where.severity = severity;
    if (userId) where.userId = userId;

    let allLogs = await findMany(collections.auditLogs, Object.keys(where).length ? where : undefined, { field: 'createdAt', direction: 'desc' });

    // Client-side search filter
    if (search) {
      const q = search.toLowerCase();
      allLogs = allLogs.filter(
        (log: any) =>
          (log.entityName && log.entityName.toLowerCase().includes(q)) ||
          (log.notes && log.notes.toLowerCase().includes(q)) ||
          (log.entityId && log.entityId.toLowerCase().includes(q))
      );
    }

    // Date range filter
    if (dateFrom) {
      allLogs = allLogs.filter((log: any) => log.createdAt && new Date(log.createdAt) >= new Date(dateFrom));
    }
    if (dateTo) {
      allLogs = allLogs.filter((log: any) => log.createdAt && new Date(log.createdAt) <= new Date(dateTo));
    }

    const total = allLogs.length;
    const paginatedLogs = allLogs.slice((page - 1) * limit, page * limit);

    // Resolve user info for each log
    const logs = await Promise.all(
      paginatedLogs.map(async (log: any) => {
        let user = null;
        if (log.userId) {
          const profile = await findFirst(collections.profiles, { id: log.userId });
          if (profile) {
            user = { id: profile.id, name: profile.name, email: profile.email, role: profile.role };
          }
        }
        return { ...log, user };
      })
    );

    // Stats from all logs
    const byAction: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};
    allLogs.forEach((log: any) => {
      if (log.action) byAction[log.action] = (byAction[log.action] || 0) + 1;
      if (log.severity) bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
      if (log.entityType) byEntityType[log.entityType] = (byEntityType[log.entityType] || 0) + 1;
    });

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        byAction: Object.entries(byAction).map(([action, count]) => ({ action, count })),
        bySeverity: Object.entries(bySeverity).map(([severity, count]) => ({ severity, count })),
        byEntityType: Object.entries(byEntityType).map(([entityType, count]) => ({ entityType, count })),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Error al obtener logs de auditoría' }, { status: 500 });
  }
}

// POST /api/audit - Create a new audit log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action, entityType, entityId, entityName, changes, severity, notes } = body;

    if (!action || !entityType) {
      return NextResponse.json({ error: 'Action y entityType son requeridos' }, { status: 400 });
    }

    const log = await createDoc(collections.auditLogs, {
      userId: userId || null,
      action,
      entityType,
      entityId: entityId || null,
      entityName: entityName || null,
      changes: changes ? JSON.stringify(changes) : null,
      severity: severity || 'info',
      notes: notes || null,
    });

    const user = log.userId
      ? await findFirst(collections.profiles, { id: log.userId })
      : null;

    return NextResponse.json(
      { ...log, user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating audit log:', error);
    return NextResponse.json({ error: 'Error al crear log de auditoría' }, { status: 500 });
  }
}
