#!/usr/bin/env node

/**
 * SOCAP Turbo Worker Service
 * 
 * High-performance worker for processing large job backlogs quickly.
 * Use this when you have many pending jobs (like 265 jobs).
 * 
 * Features:
 * - Higher default concurrency (15)
 * - Minimal delay between batches (100ms instead of 1s)
 * - Progress tracking with ETA
 * - Automatic concurrency adjustment on rate limits
 * 
 * Usage:
 *   npm run turbo-worker
 *   or
 *   tsx scripts/turbo-worker.ts
 *   or with custom concurrency:
 *   tsx scripts/turbo-worker.ts --concurrency 25
 */

import 'dotenv/config';

import { WorkerOrchestrator } from '../src/lib/socap/workers/worker-orchestrator';
import { getJobQueueStats } from '../src/lib/socap/job-queue';

// Parse command line arguments
const args = process.argv.slice(2);
const concurrencyArg = args.find((arg) => arg.startsWith('--concurrency='));
const batchArg = args.find((arg) => arg.startsWith('--batch='));

// Higher defaults for turbo mode
const CONCURRENCY = concurrencyArg
  ? parseInt(concurrencyArg.split('=')[1], 10)
  : parseInt(process.env.SOCAP_TURBO_CONCURRENCY || '15', 10);

const MAX_JOBS_PER_BATCH = batchArg
  ? parseInt(batchArg.split('=')[1], 10)
  : parseInt(process.env.SOCAP_MAX_JOBS_PER_BATCH || '500', 10);

// Minimal delay between batches in turbo mode
const BATCH_DELAY_MS = parseInt(process.env.SOCAP_TURBO_DELAY || '100', 10);

/**
 * Enhanced orchestrator with faster processing and progress tracking
 */
class TurboWorkerOrchestrator extends WorkerOrchestrator {
  private totalProcessed = 0;
  private totalCompleted = 0;
  private totalFailed = 0;
  private startTime = Date.now();

  constructor(concurrency: number) {
    super(concurrency);
  }

  /**
   * Start turbo processing with progress tracking
   */
  async startTurbo(): Promise<void> {
    console.log('');
    console.log('🚀 ═══════════════════════════════════════════════════════════');
    console.log('   TURBO WORKER MODE - High Performance Job Processing');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Concurrency:     ${CONCURRENCY} parallel jobs`);
    console.log(`   Batch size:      ${MAX_JOBS_PER_BATCH} jobs per batch`);
    console.log(`   Batch delay:     ${BATCH_DELAY_MS}ms`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get initial job count
    const stats = await getJobQueueStats();
    const totalPending = stats.pending;

    if (totalPending === 0) {
      console.log('✅ No pending jobs to process!');
      return;
    }

    console.log(`📋 Found ${totalPending} pending jobs to process\n`);

    let isRunning = true;
    let batchNumber = 0;

    // Handle graceful shutdown
    const shutdown = () => {
      console.log('\n⚠️  Received shutdown signal, finishing current batch...');
      isRunning = false;
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    while (isRunning) {
      batchNumber++;
      const batchStartTime = Date.now();

      try {
        const stats = await this.processJobs(MAX_JOBS_PER_BATCH);

        this.totalProcessed += stats.processed;
        this.totalCompleted += stats.completed;
        this.totalFailed += stats.failed;

        if (stats.processed === 0) {
          // No more jobs
          break;
        }

        // Calculate progress
        const elapsed = (Date.now() - this.startTime) / 1000;
        const rate = this.totalProcessed / elapsed;
        const remaining = totalPending - this.totalProcessed;
        const eta = remaining > 0 ? Math.ceil(remaining / rate) : 0;

        // Progress bar
        const progress = Math.min(100, (this.totalProcessed / totalPending) * 100);
        const filled = Math.floor(progress / 2);
        const bar = '█'.repeat(filled) + '░'.repeat(50 - filled);

        console.log(`\n📊 Batch ${batchNumber} complete in ${((Date.now() - batchStartTime) / 1000).toFixed(1)}s`);
        console.log(`   [${bar}] ${progress.toFixed(1)}%`);
        console.log(`   Processed: ${this.totalProcessed}/${totalPending} | ✅ ${this.totalCompleted} | ❌ ${this.totalFailed}`);
        console.log(`   Rate: ${rate.toFixed(1)} jobs/sec | ETA: ${eta}s`);

        // Minimal delay between batches
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      } catch (error) {
        console.error('\n❌ Error in batch:', error);
        // Brief pause on error, then continue
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Final summary
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   TURBO WORKER COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Total processed:  ${this.totalProcessed} jobs`);
    console.log(`   Completed:        ${this.totalCompleted} ✅`);
    console.log(`   Failed:           ${this.totalFailed} ❌`);
    console.log(`   Total time:       ${totalTime}s`);
    console.log(`   Average rate:     ${(this.totalProcessed / parseFloat(totalTime)).toFixed(1)} jobs/sec`);
    console.log('═══════════════════════════════════════════════════════════\n');
  }
}

// Start the turbo worker
const orchestrator = new TurboWorkerOrchestrator(CONCURRENCY);

orchestrator.startTurbo()
  .then(() => {
    console.log('👋 Turbo worker finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
