import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MONGODB_URI to .env file');
}

const uri = process.env.MONGODB_URI;
// Determine if we're connecting to local MongoDB or Atlas
const isLocalMongo = uri?.includes('localhost') || uri?.includes('127.0.0.1') || uri?.includes('mongodb://localhost');

const options = {
  // Only use TLS for Atlas connections, not local MongoDB
  ...(isLocalMongo ? {} : { tls: true, tlsAllowInvalidCertificates: false }),
  serverSelectionTimeoutMS: 5000, // Reduced timeout for faster failure detection
  socketTimeoutMS: 30000,
  connectTimeoutMS: 5000, // Reduced timeout for faster failure detection
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  retryWrites: true,
  retryReads: true,
  // Add heartbeat to detect connection issues faster
  heartbeatFrequencyMS: 10000,
};

let client: MongoClient;
let connectionTimestamp = 0;
const CONNECTION_MAX_AGE = 5 * 60 * 1000; // 5 minutes

// Helper function to check if connection is stale
function isConnectionStale(): boolean {
  return Date.now() - connectionTimestamp > CONNECTION_MAX_AGE;
}

// Helper function to create fresh connection
function createConnection(): Promise<MongoClient> {
  console.log('🔄 Creating fresh MongoDB connection...');
  client = new MongoClient(uri, options);
  connectionTimestamp = Date.now();
  return client.connect();
}

// Initialize clientPromise based on environment
const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoConnectionTimestamp?: number;
};

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!globalWithMongo._mongoClientPromise || !globalWithMongo._mongoConnectionTimestamp || 
      Date.now() - (globalWithMongo._mongoConnectionTimestamp || 0) > CONNECTION_MAX_AGE) {
    console.log('🔄 Refreshing stale MongoDB connection in development...');
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
    globalWithMongo._mongoConnectionTimestamp = Date.now();
  }
  // At this point, _mongoClientPromise is guaranteed to exist
  clientPromise = globalWithMongo._mongoClientPromise || createConnection();
  connectionTimestamp = globalWithMongo._mongoConnectionTimestamp || Date.now();
} else {
  // In production mode, create new connection with pooling
  clientPromise = createConnection();
}

// Wrapper function to get client with automatic stale connection refresh
async function getClient(): Promise<MongoClient> {
  // Check for stale connection in both dev and production
  if (isConnectionStale()) {
    console.log('⚠️ Connection is stale, refreshing...');
    if (process.env.NODE_ENV === 'development') {
      // In development, update the global connection
      const globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
        _mongoConnectionTimestamp?: number;
      };
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
      globalWithMongo._mongoConnectionTimestamp = Date.now();
      clientPromise = globalWithMongo._mongoClientPromise;
      connectionTimestamp = Date.now();
    } else {
      clientPromise = createConnection();
    }
  }
  
  try {
    const clientInstance = await clientPromise;
    // Test the connection by pinging the server
    await clientInstance.db().admin().ping();
    return clientInstance;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ MongoDB connection failed:', errorMessage);
    
    // Provide helpful error message for common issues
    if (errorMessage.includes('timeout') || errorMessage.includes('MongoServerSelectionError')) {
      if (isLocalMongo) {
        console.error('💡 Tip: Make sure MongoDB is running locally. Try: mongod or brew services start mongodb-community');
      } else {
        console.error('💡 Tip: Check your MongoDB Atlas connection string and IP whitelist settings.');
        console.error('💡 Tip: Make sure your IP address is whitelisted in MongoDB Atlas Network Access.');
      }
    }
    
    // Recreate connection on failure (only once to avoid infinite loops)
    if (process.env.NODE_ENV === 'development') {
      const globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
        _mongoConnectionTimestamp?: number;
      };
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
      globalWithMongo._mongoConnectionTimestamp = Date.now();
      clientPromise = globalWithMongo._mongoClientPromise;
      connectionTimestamp = Date.now();
    } else {
      clientPromise = createConnection();
    }
    
    // Try once more, but don't retry indefinitely
    try {
      return await clientPromise;
    } catch (retryError) {
      const retryErrorMessage = retryError instanceof Error ? retryError.message : String(retryError);
      console.error('❌ MongoDB connection retry also failed:', retryErrorMessage);
      throw new Error(`MongoDB connection failed: ${retryErrorMessage}. Please check your MongoDB connection string and ensure the database is accessible.`);
    }
  }
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
// This maintains backward compatibility while providing better connection management
export default clientPromise;

// Export the smart client getter for better connection management
export { getClient };

