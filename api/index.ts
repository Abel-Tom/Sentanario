import express, { Express, Request, Response } from 'express';

import getReply from '../utils/utils';
import dotenv from 'dotenv';
dotenv.config();



const app: Express = express();
const port: number = 8000;
const node_env: string | undefined = process.env.NODE_ENV;


app.use(express.json()); 

app.get('/', (req: Request,res:Response) => {
    res.send('Hello from TypeScript and Express!');
});

app.post('/reply', async (req: Request, res: Response) => {
  if (!req.body.message){
    res.status(201).json({ message: 'please type your message' });
  }
  const refresh: boolean = req.body.refresh?? false;
  const reply = await getReply(req.body.message,refresh);
  res.status(201).json({ message: reply });
});

app.listen(port, () => {
    console.log(`${node_env} server listening on port ${port}`);
});