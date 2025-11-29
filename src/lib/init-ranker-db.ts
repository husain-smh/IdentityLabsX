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

export async function initializeRankerDatabase(): Promise<void> {
  try {
    console.log(' Initializing Twitter Ranker database...');
    
    console.log(' Creating indexes for optimal performance...');
    await createIndexes();
    
    console.log(' Database initialization complete!');
    console.log('');
    console.log('Indexes created:');
    console.log('  - important_people: username, user_id, is_active');
    console.log('  - following_index: followed_user_id, followed_username, importance_score, followed_by.user_id');
    console.log('  - engagement_rankings: tweet_id, analyzed_at');
    console.log('');
    console.log(' System ready for use!');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

