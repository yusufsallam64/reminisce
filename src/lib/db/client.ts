import { MongoClient, ServerApiVersion } from "mongodb";

if (!process.env.MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable inside .env");
}

const uri = process.env.MONGODB_URI;

let client: MongoClient

const options = {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
}

if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    let globalWithMongo = global as typeof globalThis & {
      _mongoClient?: MongoClient
    }
   
    if (!globalWithMongo._mongoClient) {
      globalWithMongo._mongoClient = new MongoClient(uri, options)
    }
    client = globalWithMongo._mongoClient
  } else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri, options)
  }
   
  export default client
