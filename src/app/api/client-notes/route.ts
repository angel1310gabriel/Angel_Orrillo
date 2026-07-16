import { NextRequest, NextResponse } from 'next/server';
import { findMany, createDoc, deleteDoc, collections } from '@/lib/firestore-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const notes = await findMany(collections.clientNotes, { clientId }, { field: 'createdAt', direction: 'desc' });
    return NextResponse.json(notes);
  } catch (error) {
    console.error('Error fetching client notes:', error);
    return NextResponse.json({ error: 'Error al obtener notas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, createdBy, note, isImportant } = body;

    if (!clientId || !note) {
      return NextResponse.json({ error: 'clientId and note are required' }, { status: 400 });
    }

    const created = await createDoc(collections.clientNotes, {
      clientId,
      createdBy: createdBy || null,
      note,
      isImportant: isImportant || false,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating client note:', error);
    return NextResponse.json({ error: 'Error al crear nota' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await deleteDoc(collections.clientNotes, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting client note:', error);
    return NextResponse.json({ error: 'Error al eliminar nota' }, { status: 500 });
  }
}
