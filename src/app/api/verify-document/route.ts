import { NextRequest, NextResponse } from 'next/server';
import { findMany, findFirst, collections } from '@/lib/firestore-db';

// GET /api/verify-document?documentType=X&documentNumber=Y
// GET /api/verify-document?phone=999888777
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('documentType');
    const documentNumber = searchParams.get('documentNumber');
    const phone = searchParams.get('phone');

    if (phone) {
      const results: { clients: any[]; staff: any[] } = { clients: [], staff: [] };

      const clients = await findMany(collections.clients, { phone }, undefined, 5);
      results.clients = clients.map((c: any) => ({
        id: c.id, name: c.name || '', phone: c.phone || '',
        documentType: c.documentType || 'dni', documentNumber: c.documentNumber,
        zone: null, creditScore: null, hasActiveLoans: false,
      }));

      try {
        const profiles = await findMany(collections.profiles, { phone }, undefined, 5);
        results.staff = profiles.map((p: any) => ({
          id: p.id, name: p.name || 'Sin nombre', phone: p.phone || '',
          role: p.role || 'staff', isActive: p.isActive ?? true,
        }));
      } catch {}

      return NextResponse.json({
        verified: true, phone,
        found: results.clients.length > 0 || results.staff.length > 0,
        results,
      });
    }

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

    const clientWhere: Record<string, unknown> = { documentNumber };
    if (documentType !== 'all') {
      clientWhere.documentType = documentType;
    }
    const clients = await findMany(collections.clients, clientWhere, undefined, 5);

    results.clients = await Promise.all(
      clients.map(async (c: any) => {
        let zone = null;
        if (c.zoneId) {
          const zoneDoc = await findFirst(collections.zones, { id: c.zoneId });
          zone = zoneDoc?.name ?? null;
        }
        const loans = await findMany(collections.loans, { clientId: c.id });
        return {
          id: c.id,
          name: c.name || '',
          phone: c.phone || '',
          documentType: c.documentType || 'dni',
          documentNumber: c.documentNumber,
          zone,
          creditScore: c.creditScore ?? null,
          hasActiveLoans: loans.some((l: any) => l.status === 'active' || l.status === 'mora'),
        };
      })
    );

    try {
      const profiles = await findMany(collections.profiles, { documentNumber }, undefined, 5);
      results.staff = profiles.map((p: any) => ({
        id: p.id,
        name: p.name || 'Sin nombre',
        phone: p.phone || '',
        role: p.role || 'staff',
        isActive: p.isActive ?? true,
      }));
    } catch {}

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
