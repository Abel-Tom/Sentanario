import { HumanMessage } from "@langchain/core/messages";
import { agent } from "./utils";
import { RedisChatHistory } from "./redisChatHistory";

export async function chat(
  threadId: string,
  userMessage: string
) {
  const history = new RedisChatHistory(threadId);

  // 1. Load previous conversation
  const previousMessages = await history.getMessages();

  // 2. Add current user message
  const inputMessages = [
    ...previousMessages,
    new HumanMessage(userMessage),
  ];

  // 3. Run the agent
  const result = await agent.invoke({
    messages: inputMessages,
  });

  // 4. Save only the newly generated messages
  const newMessages = result.messages.slice(inputMessages.length);
  console.log("New messages to save:", newMessages);
  await history.addMessages([new HumanMessage(userMessage)]);
  await history.addMessages(newMessages);

  return result;
}