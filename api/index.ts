import express, { Express, Request, Response } from 'express';
import requestIp from 'request-ip';
import cors from 'cors';
import cron from 'node-cron';

import { CheckLengthAndSendMail, CheckMinutesAndSendMail, formatMessageAndSendEmail, getCronExpression, getDbItem, getReply } from '../utils/utils';
import { InMemDbItem } from '../interfaces';
import { NODE_ENV, SERVER_PORT } from '../contants';

const app: Express = express();
let inMemDb: InMemDbItem[] = []

app.use(express.json()); 
app.use(cors());
app.use(requestIp.mw());

app.get('/', async (req: Request,res:Response) => {
  
  formatMessageAndSendEmail(req.clientIp, JSON.stringify(req.headers), req.socket.remoteAddress);
  res.status(200).json({"Greetings Stranger! ": "We are Express and TypeScript Added  some extra features"});
});

app.post('/reply', async (req: Request, res: Response) => {
  if (!req.body.message){
    res.status(201).json({ message: 'please type your message' });
  }
  const refresh: boolean = req.body.refresh?? false;
  const reply = await getReply(req.body.message,refresh);
  inMemDb.push(getDbItem(req.headers["x-real-ip"], req.body.message, reply));
  inMemDb = await CheckLengthAndSendMail(inMemDb);
  res.status(201).json({ message: reply });
});

cron.schedule(getCronExpression(), async () => {
  console.log('started task')
  inMemDb = await CheckMinutesAndSendMail(inMemDb);
});

export const cronTask =  async ()  => {
  console.log('started task')
  inMemDb = await CheckMinutesAndSendMail(inMemDb);
};

app.listen(SERVER_PORT, () => {
    console.log(`${NODE_ENV} server listening on port ${SERVER_PORT}.`);
});