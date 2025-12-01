import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MONGODB_URI to .env file');
}

const uri = process.env.MONGODB_URI;
const options = {
  tls: true,
  tlsAllowInvalidCertificates: false,
  serverSelectionTimeoutMS: 10000, // Increased from 5000ms to 10000ms
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000, // Added explicit connection timeout
  maxPoolSize: 10,
  minPoolSize: 1, // Reduced from 2 to 1 for better serverless compatibility
  maxIdleTimeMS: 30000, // Close idle connections after 30s to prevent stale connections
  retryWrites: true,
  retryReads: true,
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
    return await clientPromise;
  } catch (error) {
    console.error('❌ MongoDB connection failed, retrying...', error);
    // Recreate connection on failure
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
    return await clientPromise;
  }
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
// This maintains backward compatibility while providing better connection management
export default clientPromise;

// Export the smart client getter for better connection management
export { getClient };

