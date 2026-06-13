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

// GET /api/verify-document?documentType=X&documentNumber=Y
// Verifies a document number and returns any matching records (clients, staff/collectors)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('documentType');
    const documentNumber = searchParams.get('documentNumber');

    if (!documentType || !documentNumber) {
      return NextResponse.json(
        { error: 'documentType y documentNumber son requeridos' },
        { status: 400 }
      );
    }

    const results: {
      clients: Array<{
        id: string;
        name: string;
        phone: string;
        documentType: string;
        documentNumber: string;
        zone: string | null;
        creditScore: number | null;
        hasActiveLoans: boolean;
      }>;
      staff: Array<{
        id: string;
        name: string;
        phone: string;
        role: string;
        isActive: boolean;
      }>;
    } = {
      clients: [],
      staff: [],
    };

    // On Vercel: use Supabase
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      // Search clients by document number
      let clientQuery = supabase.from('clients').select('id, first_name, last_name, phone, document_type, document_number, credit_score, zone_id, loans(status)').eq('document_number', documentNumber);
      if (documentType !== 'all') {
        clientQuery = clientQuery.eq('document_type', documentType);
      }
      clientQuery = clientQuery.limit(5);

      const { data: clients } = await clientQuery;

      results.clients = (clients || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        phone: (c.phone as string) || '',
        documentType: (c.document_type as string) || 'dni',
        documentNumber: c.document_number as string,
        zone: (c.zone_id as string) || null,
        creditScore: (c.credit_score as number) ?? null,
        hasActiveLoans: Array.isArray(c.loans) ? c.loans.some((l: Record<string, unknown>) => l.status === 'active' || l.status === 'mora') : false,
      }));

      // Search staff/collectors by document number (Supabase usa columna 'dni')
      try {
        const { data: profiles } = await supabase.from('profiles').select('id, name, phone, role, is_active').eq('dni', documentNumber).limit(5);

        results.staff = (profiles || []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          name: (p.name as string) || 'Sin nombre',
          phone: (p.phone as string) || '',
          role: (p.role as string) || 'staff',
          isActive: (p.is_active as boolean) ?? true,
        }));
      } catch {
        // Profile table might not have dni field, skip silently
      }

      return NextResponse.json({
        verified: true,
        documentType,
        documentNumber,
        found: results.clients.length > 0 || results.staff.length > 0,
        results,
      });
    }

    // Local: Prisma
    // Search clients by document number
    const clients = await db.client.findMany({
      where: {
        documentNumber,
        ...(documentType !== 'all' ? { documentType } : {}),
      },
      include: {
        zone: { select: { name: true } },
        loans: { select: { status: true } },
      },
      take: 5,
    });

    results.clients = clients.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      documentType: c.documentType,
      documentNumber: c.documentNumber,
      zone: c.zone?.name ?? null,
      creditScore: c.creditScore,
      hasActiveLoans: c.loans.some((l) => l.status === 'active' || l.status === 'mora'),
    }));

    // Search staff/collectors by document number if profile table has document fields
    try {
      const profiles = await db.profile.findMany({
        where: {
          documentNumber,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
        },
        take: 5,
      });

      results.staff = profiles.map((p) => ({
        id: p.id,
        name: p.name || 'Sin nombre',
        phone: p.phone || '',
        role: p.role || 'staff',
        isActive: p.isActive,
      }));
    } catch {
      // Profile table might not have documentNumber field, skip silently
    }

    return NextResponse.json({
      verified: true,
      documentType,
      documentNumber,
      found: results.clients.length > 0 || results.staff.length > 0,
      results,
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    return NextResponse.json(
      { error: 'Error al verificar documento' },
      { status: 500 }
    );
  }
}