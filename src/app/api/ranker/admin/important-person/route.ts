import { NextRequest, NextResponse } from 'next/server';
import { addImportantPerson, removeImportantPerson } from '@/lib/models/ranker';

// POST - Add a new important person
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    // Validation
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'username is required and must be a string' },
        { status: 400 }
      );
    }

    // Add the important person (just username - N8N will enrich with user_id/name later)
    const newPerson = await addImportantPerson(username);

    return NextResponse.json({
      success: true,
      message: 'Important person added successfully. N8N will sync their details on first following sync.',
      data: newPerson,
    });

  } catch (error) {
    console.error('Error adding important person:', error);
    
    // Handle duplicate key error
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return NextResponse.json(
        { 
          error: 'This person already exists in the system',
          details: error.message
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to add important person',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE - Remove/deactivate an important person
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'username query parameter is required' },
        { status: 400 }
      );
    }

    const removed = await removeImportantPerson(username);

    if (!removed) {
      return NextResponse.json(
        { error: 'Person not found or already inactive' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Important person deactivated successfully',
    });

  } catch (error) {
    console.error('Error removing important person:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to remove important person',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

