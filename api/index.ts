import express, { Express, Request, Response } from 'express';
import requestIp from 'request-ip';
import cors from 'cors';

import { chain, getReply } from '../utils/utils';
import { MONGODB_URI } from '../contants';

const app: Express = express();

app.use(express.json()); 
app.use(cors());
app.use(requestIp.mw());

app.get('/', async (req: Request,res:Response) => {
  
  res.status(200).json({"Greetings Stranger! ": "We are Express and TypeScript"});
});



app.post('/test', async (req: Request, res: Response) => {
  if (!req.body.message){
    res.status(201).json({ message: 'please type your message' });
  }
  res.status(200).json({"Greetings Stranger! ": "This is a test post request response"});
});

app.post('/reply', async (req: Request, res: Response) => {
  if (!req.body.message) {
    res.status(400).json({ message: 'please type your message' });
    return;
  }

  // Set headers for streaming
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Transfer-Encoding', 'chunked');
  

  
  try {
    const stream = await chain.stream({
      input: req.body.message
    });

    for await (const chunk of stream) {
      res.write(chunk.content); // Process each chunk of streamed data
      console.log(chunk.content); // Print the chunk to the console
    }
    // await getReply(req.body.message, (chunk) => {
    //   res.write(chunk); // Stream each chunk to the client
    // });

    res.end(); // End the response after streaming is complete
  } catch (error) {
    res.write('An error occurred.\n');
    res.end();
  }
});


import { MongoClient, Db, Collection } from 'mongodb';



const mongoURI = MONGODB_URI || 'mongodb://localhost:27017'; // replace with your MongoDB URI

// let db: Db;
// let collection: Collection;

// // Connect to MongoDB
// async function connectToMongo() {
//   const client = new MongoClient(mongoURI);
//   await client.connect();
//   db = client.db('mydb'); // replace with your db name
//   collection = db.collection('items'); // replace with your collection name
//   console.log('Connected to MongoDB');
// }

const uri = MONGODB_URI || 'mongodb://localhost:27017'; // replace with your MongoDB URI
const client = new MongoClient(uri);
const dbName = 'mydb'; // replace as needed
const collectionName = 'items';

let isConnected = false;

async function connectDB() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log('✅ Connected to MongoDB');
  }
}

app.post('/add', async (req: Request, res: Response) => {
  try {
    await connectDB();
    const db = client.db(dbName);
    const result = await db.collection(collectionName).insertOne(req.body);
    res.status(201).json({ insertedId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to insert' });
  }
});

app.get('/items', async (_req: Request, res: Response) => {
  try {
    await connectDB();
    const db = client.db(dbName);
    const items = await db.collection(collectionName).find().toArray();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// app.post('/add', async (req: Request, res: Response) => {
//   try {
//     const data = req.body;
//     const result = await collection.insertOne(data);
//     res.status(201).json({ message: 'Data added', id: result.insertedId });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to add data' });
//   }
// });

// app.get('/items', async (_req: Request, res: Response) => {
//   console.log('url', mongoURI);
//   console.log('db', db);
//   console.log('collection', collection);
//   try {
//     const items = await collection.find().toArray();
//     res.json(items);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch data' });
//   }
// });



app.listen(8000, async () => {
  // await connectToMongo();
  console.log('server listening on port 8000');
});



