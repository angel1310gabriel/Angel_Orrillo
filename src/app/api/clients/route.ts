import { NextRequest, NextResponse } from 'next/server';
import {
  findMany,
  findById,
  findFirst,
  createDoc,
  updateDoc,
  deleteDoc,
  collections,
} from '@/lib/firestore-db';

function getDocumentTypeLabel(type: string): string {
  switch (type) {
    case 'dni': return 'DNI';
    case 'carnet_extranjeria': return 'Carnet de Extranjería';
    case 'pasaporte': return 'Pasaporte';
    default: return type;
  }
}

// GET /api/clients
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const zoneId = searchParams.get('zoneId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (zoneId) where.zoneId = zoneId;

    let clients = await findMany(
      collections.clients,
      Object.keys(where).length > 0 ? where : undefined,
      { field: 'createdAt', direction: 'desc' },
    );

    if (search) {
      const searchLower = search.toLowerCase();
      clients = clients.filter((c: Record<string, unknown>) => {
        const name = ((c.name as string) || '').toLowerCase();
        const dni = ((c.documentNumber as string) || '').toLowerCase();
        const phone = ((c.phone as string) || '').toLowerCase();
        return name.includes(searchLower) || dni.includes(searchLower) || phone.includes(searchLower);
      });
    }

    const total = clients.length;

    const skip = (page - 1) * limit;
    clients = clients.slice(skip, skip + limit);

    const clientIds = clients.map((c: Record<string, unknown>) => c.id as string);

    const zoneIds = [...new Set(clients.map((c: Record<string, unknown>) => c.zoneId as string).filter(Boolean))];
    const allZones = zoneIds.length > 0 ? await findMany(collections.zones) : [];
    const zoneMap: Record<string, { id: string; name: string }> = {};
    for (const z of allZones) {
      if (zoneIds.includes(z.id)) zoneMap[z.id] = { id: z.id, name: z.name as string };
    }

    const allLoans = clientIds.length > 0 ? await findMany(collections.loans) : [];
    const loansByClient: Record<string, Record<string, unknown>[]> = {};
    for (const l of allLoans) {
      const cid = l.clientId as string;
      if (clientIds.includes(cid)) {
        if (!loansByClient[cid]) loansByClient[cid] = [];
        loansByClient[cid].push(l);
      }
    }

    const allGuarantors = clientIds.length > 0 ? await findMany(collections.guarantors) : [];
    const guarantorsByClient: Record<string, Record<string, unknown>[]> = {};
    for (const g of allGuarantors) {
      const cid = g.clientId as string;
      if (clientIds.includes(cid)) {
        if (!guarantorsByClient[cid]) guarantorsByClient[cid] = [];
        guarantorsByClient[cid].push(g);
      }
    }

    const clientsWithStats = clients.map((client: Record<string, unknown>) => {
      const clientLoans = loansByClient[client.id as string] || [];
      const activeLoans = clientLoans.filter((l) => l.status === 'active' || l.status === 'mora');
      const totalLoaned = clientLoans.reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const totalPaid = clientLoans.reduce((s, l) => s + (Number(l.amountPaid) || 0), 0);
      const hasMora = clientLoans.some((l) => l.status === 'mora');

      return {
        ...client,
        firstName: (client.name as string) || '',
        lastName: '',
        documentType: client.documentType || 'dni',
        documentNumber: client.documentNumber,
        zone: client.zoneId ? zoneMap[client.zoneId as string] || { id: client.zoneId, name: '' } : null,
        guarantors: guarantorsByClient[client.id as string] || [],
        loans: clientLoans.slice(0, 10),
        stats: {
          totalLoans: clientLoans.length,
          activeLoans: activeLoans.length,
          totalLoaned,
          totalPaid,
          hasMora,
        },
      };
    });

    return NextResponse.json({
      clients: clientsWithStats,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      dataSource: 'firestore',
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

// POST /api/clients
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, documentType, documentNumber, phone, address, zoneId, creditScore, latitude, longitude } = body;

    if (!name || !documentNumber || !phone) {
      return NextResponse.json({ error: 'Nombre, número de documento y teléfono son requeridos' }, { status: 400 });
    }

    const docType = documentType || 'dni';
    if (docType === 'dni' && !/^\d{8}$/.test(documentNumber)) {
      return NextResponse.json({ error: 'El DNI debe tener exactamente 8 dígitos' }, { status: 400 });
    }
    if ((docType === 'carnet_extranjeria' || docType === 'pasaporte') && !/^\d{9}$/.test(documentNumber)) {
      return NextResponse.json({ error: 'El Carnet de Extranjería / Pasaporte debe tener exactamente 9 dígitos numéricos' }, { status: 400 });
    }

    if (!/^9\d{8}$/.test(phone)) {
      return NextResponse.json({ error: 'El teléfono debe tener exactamente 9 dígitos y empezar con 9' }, { status: 400 });
    }

    const existing = await findFirst(collections.clients, { documentNumber });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un cliente con ese número de documento' }, { status: 409 });
    }

    const client = await createDoc(collections.clients, {
      name,
      documentType: docType,
      documentNumber,
      phone,
      address: address || null,
      zoneId: zoneId || null,
      creditScore: creditScore ?? 50,
      latitude: latitude || null,
      longitude: longitude || null,
      isActive: true,
    });

    await createDoc(collections.auditLogs, {
      action: 'CREATE',
      entityType: 'client',
      entityId: client.id,
      entityName: client.name,
      severity: 'info',
      notes: `Cliente creado: ${client.name} (${getDocumentTypeLabel(client.documentType)}: ${client.documentNumber})`,
    }).catch(() => {});

    return NextResponse.json({
      ...client,
      firstName: client.name || '',
      lastName: '',
      zone: client.zoneId ? { id: client.zoneId, name: '' } : null,
      guarantors: [],
      loans: [],
      stats: { totalLoans: 0, activeLoans: 0, totalLoaned: 0, totalPaid: 0, hasMora: false },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}

// PUT /api/clients
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, documentType, documentNumber, phone, address, zoneId, creditScore } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const existing = await findById(collections.clients, id);
    if (!existing) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const client = await updateDoc(collections.clients, id, {
      name: name ?? existing.name,
      documentType: documentType ?? existing.documentType,
      documentNumber: documentNumber ?? existing.documentNumber,
      phone: phone ?? existing.phone,
      address: address !== undefined ? address : existing.address,
      zoneId: zoneId !== undefined ? zoneId : existing.zoneId,
      creditScore: creditScore !== undefined ? creditScore : existing.creditScore,
    });

    const zone = client.zoneId ? await findById(collections.zones, client.zoneId) : null;
    const guarantors = await findMany(collections.guarantors, { clientId: id });

    await createDoc(collections.auditLogs, {
      action: 'UPDATE',
      entityType: 'client',
      entityId: client.id,
      entityName: client.name,
      severity: 'info',
      notes: `Cliente actualizado: ${client.name}`,
      changes: JSON.stringify({ before: { name: existing.name, phone: existing.phone, documentNumber: existing.documentNumber }, after: { name: client.name, phone: client.phone, documentNumber: client.documentNumber } }),
    }).catch(() => {});

    return NextResponse.json({
      ...client,
      firstName: client.name || '',
      lastName: '',
      zone: zone ? { id: zone.id, name: zone.name } : null,
      guarantors,
    });
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

// DELETE /api/clients
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const client = await findById(collections.clients, id);
    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const loans = await findMany(collections.loans, { clientId: id });
    if (loans.some((l) => l.status === 'active' || l.status === 'mora')) {
      return NextResponse.json({ error: 'No se puede eliminar un cliente con préstamos activos' }, { status: 400 });
    }

    await deleteDoc(collections.clients, id);

    await createDoc(collections.auditLogs, {
      action: 'DELETE',
      entityType: 'client',
      entityId: id,
      entityName: client.name,
      severity: 'warning',
      notes: `Cliente eliminado: ${client.name}`,
    }).catch(() => {});

    return NextResponse.json({ message: 'Cliente eliminado' });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
  }
}
