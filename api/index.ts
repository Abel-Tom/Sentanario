import express, { Express, Request, Response } from 'express';
import requestIp from 'request-ip';
import cors from 'cors';

import {formatMessageAndSendEmail, getReply } from '../utils/utils';

import dotenv from 'dotenv';
dotenv.config();

const app: Express = express();
const port: number = 8000;
const node_env: string | undefined = process.env.NODE_ENV;


app.use(express.json()); 
app.use(cors());
app.use(requestIp.mw());

app.get('/', async (req: Request,res:Response) => {
  formatMessageAndSendEmail(req.clientIp, JSON.stringify(req.headers), req.socket.remoteAddress);
  res.send(`Greetings Stranger! We are Express and TypeScript`);
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