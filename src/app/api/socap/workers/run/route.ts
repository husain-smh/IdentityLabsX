import { NextRequest, NextResponse } from 'next/server';
import { WorkerOrchestrator } from '@/lib/socap/workers/worker-orchestrator';

/**
 * POST /socap/workers/run
 * Manually trigger worker processing
 * Useful for testing or manual runs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const maxJobs = body.maxJobs || 100;
    const concurrency = body.concurrency || 5;
    
    const orchestrator = new WorkerOrchestrator(concurrency);
    const stats = await orchestrator.processJobs(maxJobs);
    
    return NextResponse.json({
      success: true,
      message: 'Worker processing completed',
      data: stats,
    });
  } catch (error) {
    console.error('Error running workers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run workers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

