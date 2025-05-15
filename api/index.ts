import express, { Express, Request, Response } from 'express';
import requestIp from 'request-ip';
import cors from 'cors';

import { chain} from '../utils/utils';

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

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Transfer-Encoding', 'chunked');
  
  try {
    const sessionId = req.body.sessionId || `session_${Date.now()}`;
    try {
        const stream = await chain.stream(
          { input: req.body.message },
          { configurable: { sessionId } }
        );

      for await (const chunk of stream) {
          res.write(chunk.content);
        }
      } catch (streamError) {
        console.error('Stream error:', streamError);
        throw streamError;
      }

      res.end();
  } catch (error) {
    console.error('Error details:', error);
    res.write('An error occurred.\n');
    res.end();
  }
});


app.listen(8000, async () => {
  console.log('server listening on port 8000');
});



