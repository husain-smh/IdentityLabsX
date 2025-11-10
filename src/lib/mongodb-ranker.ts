import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MONGODB_URI to .env file');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;
let rankerDbPromise: Promise<Db>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof globalThis & {
    _mongoRankerClientPromise?: Promise<MongoClient>;
    _rankerDbPromise?: Promise<Db>;
  };

  if (!globalWithMongo._mongoRankerClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoRankerClientPromise = client.connect();
    globalWithMongo._rankerDbPromise = globalWithMongo._mongoRankerClientPromise.then(
      (client) => client.db('twitter_ranker')
    );
  }
  clientPromise = globalWithMongo._mongoRankerClientPromise;
  rankerDbPromise = globalWithMongo._rankerDbPromise!;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
  rankerDbPromise = clientPromise.then((client) => client.db('twitter_ranker'));
}

// Export both client and database promises
export { clientPromise };
export default rankerDbPromise;

