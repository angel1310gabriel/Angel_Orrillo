import { NextRequest, NextResponse } from 'next/server';
import { db, isVercel } from '@/lib/db';

// Helper for document type labels
function getDocumentTypeLabel(type: string): string {
  switch (type) {
    case 'dni': return 'DNI';
    case 'carnet_extranjeria': return 'Carnet de Extranjería';
    case 'pasaporte': return 'Pasaporte';
    default: return type;
  }
}

// ============================================================
// Helper: Get Supabase client from env or DB settings
// ============================================================
async function getSupabase() {
  try {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Priority: service_role key (bypasses RLS for admin operations)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (envUrl && envKey) {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(envUrl, envKey);
    }

    // Fallback to DB settings (only available locally, not on Vercel)
    if (!isVercel) {
      const urlSetting = await db.setting.findUnique({ where: { key: 'supabase_url' } });
      const keySetting = await db.setting.findUnique({ where: { key: 'supabase_anon_key' } });
      const serviceKeySetting = await db.setting.findUnique({ where: { key: 'supabase_service_role_key' } });

      const url = urlSetting?.value;
      const key = serviceKeySetting?.value || keySetting?.value;
      if (url && key) {
        const { createClient } = await import('@supabase/supabase-js');
        return createClient(url, key);
      }
    }
  } catch {
    // Not configured
  }
  return null;
}

// GET /api/clients - List clients with search (Supabase first, local fallback)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const zoneId = searchParams.get('zoneId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Try Supabase first
    const supabase = await getSupabase();
    if (supabase) {
      try {
        let query = supabase.from('clients').select('*', { count: 'exact' });

        if (search) {
          query = query.or(`name.ilike.%${search}%,dni.ilike.%${search}%,phone.ilike.%${search}%`);
        }
        if (zoneId) {
          query = query.eq('zone_id', zoneId);
        }

        const skip = (page - 1) * limit;
        const result = await Promise.race([
          query.order('created_at', { ascending: false }).range(skip, skip + limit - 1),
          new Promise<{ data: null; error: Error; count: null }>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000)
          ),
        ]);

        if (result.data && result.data.length > 0) {
          // Sync to local in background
          syncClientsToLocal(result.data).catch(() => {});

          const clients = result.data.map((c: Record<string, unknown>) => ({
            id: c.id,
            name: c.name || '',
            firstName: (c.name as string) || '',
            lastName: '',
            documentType: c.document_type || 'dni',
            documentNumber: c.dni,
            phone: c.phone,
            email: c.email || null,
            address: c.address,
            zoneId: c.zone_id,
            creditScore: c.credit_score ?? 50,
            isActive: c.is_active ?? true,
            latitude: c.latitude || null,
            longitude: c.longitude || null,
            createdAt: c.created_at,
            zone: c.zone_id ? { id: c.zone_id, name: '' } : null,
            guarantors: [],
            loans: [],
            stats: { totalLoans: 0, activeLoans: 0, totalLoaned: 0, totalPaid: 0, hasMora: false },
          }));

          return NextResponse.json({
            clients,
            pagination: { page, limit, total: result.count || clients.length, totalPages: Math.ceil((result.count || clients.length) / limit) },
            dataSource: 'supabase',
          });
        }
      } catch (error) {
        console.error('Supabase getClients failed, falling back:', error);
      }
    }

    // On Vercel, if Supabase failed, don't fall back to Prisma (no SQLite)
    if (isVercel) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    // Fallback to Prisma (local)
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { documentNumber: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (zoneId) where.zoneId = zoneId;

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        include: {
          zone: { select: { id: true, name: true } },
          loans: {
            select: {
              id: true, status: true, amount: true, totalAmount: true, amountPaid: true,
              payments: { select: { id: true, amount: true, paymentMethod: true, paymentDate: true, status: true }, orderBy: { paymentDate: 'desc' }, take: 10 },
            },
          },
          guarantors: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.client.count({ where }),
    ]);

    const clientsWithStats = clients.map((client) => {
      const activeLoans = client.loans.filter((l) => l.status === 'active' || l.status === 'mora');
      const totalLoaned = client.loans.reduce((s, l) => s + l.amount, 0);
      const totalPaid = client.loans.reduce((s, l) => s + l.amountPaid, 0);
      const hasMora = client.loans.some((l) => l.status === 'mora');

      return {
        ...client,
        stats: {
          totalLoans: client.loans.length,
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
      dataSource: 'local',
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

// POST /api/clients - Create a new client (saves to both local and Supabase)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, documentType, documentNumber, phone, address, zoneId, creditScore, latitude, longitude } = body;

    if (!name || !documentNumber || !phone) {
      return NextResponse.json({ error: 'Nombre, número de documento y teléfono son requeridos' }, { status: 400 });
    }

    // Validate document number based on type
    const docType = documentType || 'dni';
    if (docType === 'dni' && !/^\d{8}$/.test(documentNumber)) {
      return NextResponse.json({ error: 'El DNI debe tener exactamente 8 dígitos' }, { status: 400 });
    }
    if ((docType === 'carnet_extranjeria' || docType === 'pasaporte') && !/^\d{9}$/.test(documentNumber)) {
      return NextResponse.json({ error: 'El Carnet de Extranjería / Pasaporte debe tener exactamente 9 dígitos numéricos' }, { status: 400 });
    }

    // Validate phone
    if (!/^9\d{8}$/.test(phone)) {
      return NextResponse.json({ error: 'El teléfono debe tener exactamente 9 dígitos y empezar con 9' }, { status: 400 });
    }

    // On Vercel: use Supabase as primary DB
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      // Check for duplicate document number via Supabase
      const { data: existingClient } = await supabase.from('clients').select('id').eq('dni', documentNumber).maybeSingle();
      if (existingClient) {
        return NextResponse.json({ error: 'Ya existe un cliente con ese número de documento' }, { status: 409 });
      }

      // Create via Supabase
      const { data: newClient, error: createError } = await supabase.from('clients').insert({
        name,
        dni: documentNumber,
        document_type: docType,
        phone,
        address: address || null,
        zone_id: zoneId || null,
        credit_score: creditScore ?? 50,
        latitude: latitude || null,
        longitude: longitude || null,
      }).select().single();

      if (createError) {
        console.error('[Clients] Supabase create error:', createError.message);
        return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
      }

      return NextResponse.json({
        id: newClient.id,
        name: newClient.name || '',
        firstName: newClient.name || '',
        lastName: '',
        documentType: newClient.document_type || 'dni',
        documentNumber: newClient.dni,
        phone: newClient.phone,
        email: newClient.email || null,
        address: newClient.address,
        zoneId: newClient.zone_id,
        creditScore: newClient.credit_score ?? 50,
        isActive: newClient.is_active ?? true,
        latitude: newClient.latitude || null,
        longitude: newClient.longitude || null,
        createdAt: newClient.created_at,
        zone: newClient.zone_id ? { id: newClient.zone_id, name: '' } : null,
        guarantors: [],
        loans: [],
        stats: { totalLoans: 0, activeLoans: 0, totalLoaned: 0, totalPaid: 0, hasMora: false },
      }, { status: 201 });
    }

    // Local mode: Prisma-first with Supabase background push

    // Check for duplicate document number locally
    const existing = await db.client.findFirst({ where: { documentNumber } });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un cliente con ese número de documento' }, { status: 409 });
    }

    // Create in local DB first
    const client = await db.client.create({
      data: {
        name,
        documentType: docType,
        documentNumber,
        phone,
        address: address || null,
        zoneId: zoneId || null,
        creditScore: creditScore ?? 50,
        latitude: latitude || null,
        longitude: longitude || null,
      },
      include: {
        zone: { select: { id: true, name: true } },
        guarantors: true,
      },
    });

    // Also push to Supabase in background
    const supabase = await getSupabase();
    if (supabase) {
      supabase
        .from('clients')
        .insert({
          id: client.id,
          name,
          dni: documentNumber,
          document_type: docType,
          phone,
          address: address || null,
          zone_id: zoneId || null,
          credit_score: creditScore ?? 50,
          latitude: latitude || null,
          longitude: longitude || null,
        })
        .then(({ error }) => {
          if (error) console.error('[Clients] Push to Supabase error:', error.message);
          else console.log('[Clients] Client pushed to Supabase:', name);
        });
    }

    // Audit log (local only)
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'client',
        entityId: client.id,
        entityName: client.name,
        severity: 'info',
        notes: `Cliente creado: ${client.name} (${getDocumentTypeLabel(client.documentType)}: ${client.documentNumber})`,
      },
    }).catch(() => {});

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}

// PUT /api/clients - Update a client
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, documentType, documentNumber, phone, address, zoneId, creditScore } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    // On Vercel: use Supabase as primary DB
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      // Check existing via Supabase
      const { data: existingClient, error: findError } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
      if (!existingClient || findError) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }

      // Update via Supabase
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (documentType !== undefined) updateData.document_type = documentType;
      if (documentNumber !== undefined) updateData.dni = documentNumber;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (zoneId !== undefined) updateData.zone_id = zoneId;
      if (creditScore !== undefined) updateData.credit_score = creditScore;

      const { data: updatedClient, error: updateError } = await supabase.from('clients').update(updateData).eq('id', id).select().single();

      if (updateError) {
        console.error('[Clients] Supabase update error:', updateError.message);
        return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
      }

      return NextResponse.json({
        id: updatedClient.id,
        name: updatedClient.name || '',
        firstName: updatedClient.name || '',
        lastName: '',
        documentType: updatedClient.document_type || 'dni',
        documentNumber: updatedClient.dni,
        phone: updatedClient.phone,
        email: updatedClient.email || null,
        address: updatedClient.address,
        zoneId: updatedClient.zone_id,
        creditScore: updatedClient.credit_score ?? 50,
        isActive: updatedClient.is_active ?? true,
        createdAt: updatedClient.created_at,
        zone: updatedClient.zone_id ? { id: updatedClient.zone_id, name: '' } : null,
        guarantors: [],
      });
    }

    // Local mode: Prisma-first with Supabase background push
    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const client = await db.client.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        documentType: documentType ?? existing.documentType,
        documentNumber: documentNumber ?? existing.documentNumber,
        phone: phone ?? existing.phone,
        address: address !== undefined ? address : existing.address,
        zoneId: zoneId !== undefined ? zoneId : existing.zoneId,
        creditScore: creditScore !== undefined ? creditScore : existing.creditScore,
      },
      include: {
        zone: { select: { id: true, name: true } },
        guarantors: true,
      },
    });

    // Also push update to Supabase in background
    const supabase = await getSupabase();
    if (supabase) {
      supabase
        .from('clients')
        .update({
          name: client.name,
          dni: client.documentNumber,
          document_type: client.documentType,
          phone: client.phone,
          address: client.address,
          zone_id: client.zoneId,
          credit_score: client.creditScore,
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('[Clients] Update in Supabase error:', error.message);
        });
    }

    // Audit log (local only)
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'client',
        entityId: client.id,
        entityName: client.name,
        severity: 'info',
        notes: `Cliente actualizado: ${client.name}`,
        changes: JSON.stringify({ before: { name: existing.name, phone: existing.phone, documentNumber: existing.documentNumber }, after: { name: client.name, phone: client.phone, documentNumber: client.documentNumber } }),
      },
    }).catch(() => {});

    return NextResponse.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

// DELETE /api/clients - Delete a client
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    // On Vercel: use Supabase as primary DB
    if (isVercel) {
      const supabase = await getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
      }

      // Check existing via Supabase
      const { data: client, error: findError } = await supabase.from('clients').select('id, name').eq('id', id).maybeSingle();
      if (!client || findError) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }

      // Check for active loans via Supabase
      const { data: activeLoans } = await supabase.from('loans').select('id').eq('client_id', id).in('status', ['active', 'mora']);
      if (activeLoans && activeLoans.length > 0) {
        return NextResponse.json({ error: 'No se puede eliminar un cliente con préstamos activos' }, { status: 400 });
      }

      // Delete via Supabase
      const { error: deleteError } = await supabase.from('clients').delete().eq('id', id);
      if (deleteError) {
        console.error('[Clients] Supabase delete error:', deleteError.message);
        return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
      }

      return NextResponse.json({ message: 'Cliente eliminado' });
    }

    // Local mode: Prisma-first with Supabase background push
    const client = await db.client.findUnique({
      where: { id },
      include: { loans: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    if (client.loans.some((l) => l.status === 'active' || l.status === 'mora')) {
      return NextResponse.json({ error: 'No se puede eliminar un cliente con préstamos activos' }, { status: 400 });
    }

    await db.client.delete({ where: { id } });

    // Also delete from Supabase in background
    const supabase = await getSupabase();
    if (supabase) {
      supabase
        .from('clients')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('[Clients] Delete from Supabase error:', error.message);
        });
    }

    // Audit log (local only)
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'client',
        entityId: id,
        entityName: client.name,
        severity: 'warning',
        notes: `Cliente eliminado: ${client.name}`,
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Cliente eliminado' });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
  }
}

// ============================================================
// Helper: Sync clients from Supabase to local DB
// ============================================================
async function syncClientsToLocal(clients: Record<string, unknown>[]) {
  // Skip sync on Vercel (no local DB)
  if (isVercel) return;

  try {
    for (const c of clients) {
      await db.client.upsert({
        where: { id: c.id as string },
        update: {
          name: (c.name as string) || '',
          documentNumber: (c.dni as string) || '',
          phone: (c.phone as string) || '',
          address: (c.address as string) || null,
          zoneId: (c.zone_id as string) || null,
          creditScore: (c.credit_score as number) ?? 50,
          isActive: (c.is_active as boolean) ?? true,
        },
        create: {
          id: c.id as string,
          name: (c.name as string) || '',
          documentType: (c.document_type as string) || 'dni',
          documentNumber: (c.dni as string) || '',
          phone: (c.phone as string) || '',
          address: (c.address as string) || null,
          zoneId: (c.zone_id as string) || null,
          creditScore: (c.credit_score as number) ?? 50,
          isActive: (c.is_active as boolean) ?? true,
        },
      });
    }
    console.log(`[Clients] Synced ${clients.length} clients from Supabase to local`);
  } catch (err) {
    console.error('[Clients] Sync error:', err);
  }
}
