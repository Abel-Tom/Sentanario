import { Redis } from "@upstash/redis";
import {
  BaseMessage,
  StoredMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";


import {  UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } from "../contants";

const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});

const MAX_MESSAGES = Number(
  process.env.CHAT_HISTORY_MAX_MESSAGES ?? 50
);

const TTL_SECONDS = Number(
  process.env.CHAT_HISTORY_TTL_SECONDS ?? 60 * 60 * 24 * 30
);

export class RedisChatHistory {
  private readonly key: string;

  constructor(threadId: string) {
    if (!threadId) {
      throw new Error("threadId is required");
    }

    this.key = `chat:${threadId}`;
  }

  async getMessages(): Promise<BaseMessage[]> {
    const storedMessages =
      await redis.get<StoredMessage[]>(this.key);

    if (!storedMessages) {
      return [];
    }

    return mapStoredMessagesToChatMessages(storedMessages);
  }

  async addMessages(messages: BaseMessage[]): Promise<void> {
    if (messages.length === 0) {
      return;
    }

    const existing =
      await redis.get<StoredMessage[]>(this.key) ?? [];

    const newMessages =
      mapChatMessagesToStoredMessages(messages);

    const combined = [
      ...existing,
      ...newMessages,
    ];

    // Keep only the most recent messages.
    const trimmed = combined.slice(-MAX_MESSAGES);

    await redis.set(this.key, trimmed, {
      ex: TTL_SECONDS,
    });
  }

  async clear(): Promise<void> {
    await redis.del(this.key);
  }
}