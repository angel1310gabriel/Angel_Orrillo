import { NextRequest, NextResponse } from 'next/server';
import { findMany, createDoc, deleteDoc, deleteMany, collections } from '@/lib/firestore-db';

function mapGuarantor(record: Record<string, unknown>) {
  return {
    id: record.id,
    clientId: record.clientId,
    name: record.name,
    documentNumber: record.documentNumber,
    phone: record.phone,
    address: record.address,
    photoUrl: record.photoUrl,
    createdAt: record.createdAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId es requerido' }, { status: 400 });
    }

    const data = await findMany(collections.guarantors, { clientId });

    return NextResponse.json(data.map(mapGuarantor));
  } catch (error) {
    console.error('Error fetching guarantors:', error);
    return NextResponse.json({ error: 'Error al obtener garantes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, name, documentNumber, phone, address } = body;

    if (!clientId || !name) {
      return NextResponse.json({ error: 'clientId y name son requeridos' }, { status: 400 });
    }

    const data = await createDoc(collections.guarantors, {
      clientId,
      name,
      documentNumber,
      phone,
      address,
    });

    return NextResponse.json(mapGuarantor(data as Record<string, unknown>), { status: 201 });
  } catch (error) {
    console.error('Error creating guarantor:', error);
    return NextResponse.json({ error: 'Error al crear garante' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    await deleteDoc(collections.guarantors, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting guarantor:', error);
    return NextResponse.json({ error: 'Error al eliminar garante' }, { status: 500 });
  }
}
