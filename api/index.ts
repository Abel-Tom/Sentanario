import express, { Express, Request, Response } from 'express';
import requestIp from 'request-ip';
import cors from 'cors';

import { HumanMessage } from "@langchain/core/messages";
import { agent } from "../utils/utils";
import { RedisChatHistory } from "../utils/redisChatHistory";

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



app.post("/reply", async (req, res) => {
  try {
    
    const message = req.body.message;
    const threadId = req.body.sessionId || `session_${Date.now()}`;
    if (!threadId || !message) {
      return res.status(400).json({
        error: "threadId and message are required",
      });
    }

    const history = new RedisChatHistory(threadId);

    // Load previous conversation
    const previousMessages = await history.getMessages();

    // Add the current user message
    const inputMessages = [
      ...previousMessages,
      new HumanMessage(message),
    ];

    console.log("Input Messages:", inputMessages);

    /*
     * We use two stream modes:
     *
     * messages -> individual model message chunks
     * values   -> complete agent state after each step
     */
    const stream = await agent.stream(
      {
        messages: inputMessages,
      },
      {
        streamMode: ["messages", "values"],
      }
    );

    // The final "values" state will be stored here.
    let finalState: any = null;

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");


    for await (const [mode, chunk] of stream) {
      /*
       * --------------------------------------------------
       * MESSAGE STREAM
       * --------------------------------------------------
       */
      if (mode === "messages") {
        const [messageChunk, metadata] = chunk as any;

        // console.log("Node:", metadata?.langgraph_node);
        // console.log("Content:", messageChunk.content);
        

        /*
         * Only stream model output to the client.
         *
         * Tool calls and tool results are still available
         * internally but don't need to be displayed as
         * normal assistant text.
         */
        if (
          metadata?.langgraph_node === "model_request" &&
          typeof messageChunk.content === "string" &&
          messageChunk.content.length > 0
        ) {
          res.write(
            messageChunk.content
          );
        }
      }

      /*
       * --------------------------------------------------
       * STATE STREAM
       * --------------------------------------------------
       */
      if (mode === "values") {
        finalState = chunk;
      }
    }

    /*
     * --------------------------------------------------
     * SAVE COMPLETE CONVERSATION
     * --------------------------------------------------
     */

    if (finalState?.messages) {
      const newMessages = finalState.messages.slice(
        inputMessages.length
      );
      await history.addMessages([new HumanMessage(message)]);
      await history.addMessages(newMessages);
    }


    res.end();
  } catch (error) {
    console.error(error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Failed to process chat message",
      });
    }

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
      })}\n\n`
    );

    res.end();
  }
});


app.listen(8000, async () => {
  console.log('server listening on port 8000');
});



