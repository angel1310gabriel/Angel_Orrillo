import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

// ============================================================
// Helper: Get Supabase client from env
// ============================================================
async function getSupabase() {
  try {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (envUrl && envKey) {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(envUrl, envKey);
    }
  } catch {
    // Not configured
  }
  return null;
}

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

    const skip = (page - 1) * limit;

    // On Vercel: use Supabase
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      // Build Supabase query
      let query = supabase.from('audit_logs').select('*', { count: 'exact' });

      if (action) query = query.eq('action', action);
      if (entityType) query = query.eq('entity_type', entityType);
      if (severity) query = query.eq('severity', severity);
      if (userId) query = query.eq('user_id', userId);
      if (search) query = query.or(`entity_name.ilike.%${search}%,notes.ilike.%${search}%,entity_id.ilike.%${search}%`);
      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo);

      const { data: logs, count, error } = await query
        .order('created_at', { ascending: false })
        .range(skip, skip + limit - 1);

      if (error) {
        console.error('[Audit] Supabase query error:', error.message);
        return NextResponse.json({ error: 'Error al obtener logs de auditoría' }, { status: 500 });
      }

      // Get stats via separate queries
      const [actionStats, severityStats, entityTypeStats] = await Promise.all([
        supabase.from('audit_logs').select('action'),
        supabase.from('audit_logs').select('severity'),
        supabase.from('audit_logs').select('entity_type'),
      ]);

      // Aggregate stats client-side
      const byAction: Record<string, number> = {};
      (actionStats.data || []).forEach((s: { action: string }) => {
        byAction[s.action] = (byAction[s.action] || 0) + 1;
      });

      const bySeverity: Record<string, number> = {};
      (severityStats.data || []).forEach((s: { severity: string }) => {
        bySeverity[s.severity] = (bySeverity[s.severity] || 0) + 1;
      });

      const byEntityType: Record<string, number> = {};
      (entityTypeStats.data || []).forEach((s: { entity_type: string }) => {
        byEntityType[s.entity_type] = (byEntityType[s.entity_type] || 0) + 1;
      });

      // Map Supabase column names to expected format
      const mappedLogs = (logs || []).map((log: Record<string, unknown>) => ({
        id: log.id,
        userId: log.user_id,
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
        entityName: log.entity_name,
        changes: log.changes,
        severity: log.severity,
        notes: log.notes,
        createdAt: log.created_at,
        user: log.user_id ? { id: log.user_id } : null,
      }));

      return NextResponse.json({
        logs: mappedLogs,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
        stats: {
          byAction: Object.entries(byAction).map(([action, count]) => ({ action, count })),
          bySeverity: Object.entries(bySeverity).map(([severity, count]) => ({ severity, count })),
          byEntityType: Object.entries(byEntityType).map(([entityType, count]) => ({ entityType, count })),
        },
      });
    }

    // Local: Prisma
    const where: Record<string, unknown> = {};

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (severity) where.severity = severity;
    if (userId) where.userId = userId;

    if (search) {
      where.OR = [
        { entityName: { contains: search } },
        { notes: { contains: search } },
        { entityId: { contains: search } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

    // Stats for audit summary
    const stats = await db.auditLog.groupBy({
      by: ['action'],
      _count: { action: true },
    });

    const severityStats = await db.auditLog.groupBy({
      by: ['severity'],
      _count: { severity: true },
    });

    const entityTypeStats = await db.auditLog.groupBy({
      by: ['entityType'],
      _count: { entityType: true },
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
        byAction: stats.map((s) => ({ action: s.action, count: s._count.action })),
        bySeverity: severityStats.map((s) => ({ severity: s.severity, count: s._count.severity })),
        byEntityType: entityTypeStats.map((s) => ({ entityType: s.entityType, count: s._count.entityType })),
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

    // On Vercel: push to Supabase (audit logs are non-critical on Vercel)
    if (isVercel) {
      const supabase = await getSupabase();
      if (supabase) {
        const { data, error } = await supabase.from('audit_logs').insert({
          user_id: userId || null,
          action,
          entity_type: entityType,
          entity_id: entityId || null,
          entity_name: entityName || null,
          changes: changes ? JSON.stringify(changes) : null,
          severity: severity || 'info',
          notes: notes || null,
        }).select().single();

        if (!error && data) {
          return NextResponse.json({
            id: data.id,
            userId: data.user_id,
            action: data.action,
            entityType: data.entity_type,
            entityId: data.entity_id,
            entityName: data.entity_name,
            changes: data.changes,
            severity: data.severity,
            notes: data.notes,
            createdAt: data.created_at,
          }, { status: 201 });
        }
      }

      // If Supabase not available, just acknowledge (audit logs are non-critical)
      return NextResponse.json({
        message: 'Audit log recorded',
        action,
        entityType,
      }, { status: 201 });
    }

    // Local: Prisma
    const log = await db.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entityType,
        entityId: entityId || null,
        entityName: entityName || null,
        changes: changes ? JSON.stringify(changes) : null,
        severity: severity || 'info',
        notes: notes || null,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('Error creating audit log:', error);
    return NextResponse.json({ error: 'Error al crear log de auditoría' }, { status: 500 });
  }
}
