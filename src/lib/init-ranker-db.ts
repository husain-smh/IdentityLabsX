/**
 * Database Initialization Script for Twitter Ranker
 * 
 * Run this once to create all necessary indexes for optimal performance.
 * You can run it multiple times safely - MongoDB will skip existing indexes.
 * 
 * Usage:
 * 1. Create a page or API route that calls initializeRankerDatabase()
 * 2. Or run from a Node script
 */

import { createIndexes } from './models/ranker';
import { logger } from './logger';

export async function initializeRankerDatabase(): Promise<void> {
  const operationId = `init-db-${Date.now()}`;
  
  try {
    logger.info('Initializing Twitter Ranker database', { 
      operation: 'initializeRankerDatabase',
      operationId 
    });
    
    logger.info('Creating indexes for optimal performance', { 
      operation: 'createIndexes',
      operationId 
    });
    
    await createIndexes();
    
    logger.info('Database initialization complete', { 
      operation: 'initializeRankerDatabase',
      operationId,
      indexes: {
        important_people: ['username', 'user_id', 'is_active'],
        following_index: ['followed_user_id', 'followed_username', 'importance_score', 'followed_by.user_id'],
        engagement_rankings: ['tweet_id', 'analyzed_at']
      }
    });
    
    logger.info('System ready for use', { operationId });
    
  } catch (error) {
    logger.error('Database initialization failed', error, { 
      operation: 'initializeRankerDatabase',
      operationId 
    });
    throw error;
  }
}

