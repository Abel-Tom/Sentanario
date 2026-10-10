import { Redis } from "@upstash/redis";
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointMetadata,
  type CheckpointTuple,
  type PendingWrite,
  type ChannelVersions,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import {  UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } from "../contants";
const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});

interface StoredCheckpoint {
  checkpoint: Checkpoint;
  metadata: CheckpointMetadata;
  config: RunnableConfig;
  parentConfig?: RunnableConfig;
}

export class UpstashCheckpointSaver extends BaseCheckpointSaver {
  private checkpointKey(
    threadId: string,
    checkpointNs: string,
    checkpointId: string
  ) {
    return `lg:checkpoint:${threadId}:${checkpointNs}:${checkpointId}`;
  }

  private checkpointsKey(
    threadId: string,
    checkpointNs: string
  ) {
    return `lg:checkpoints:${threadId}:${checkpointNs}`;
  }

  private writesKey(
    threadId: string,
    checkpointNs: string,
    checkpointId: string
  ) {
    return `lg:writes:${threadId}:${checkpointNs}:${checkpointId}`;
  }

  private threadKeysKey(threadId: string) {
    return `lg:thread:${threadId}:keys`;
  }

  async getTuple(
    config: RunnableConfig
  ): Promise<CheckpointTuple | undefined> {
    const configurable = config.configurable;

    if (!configurable?.thread_id) {
      throw new Error("thread_id is required");
    }

    const threadId = String(configurable.thread_id);

    const checkpointNs =
      String(configurable.checkpoint_ns ?? "");

    let checkpointId =
      configurable.checkpoint_id
        ? String(configurable.checkpoint_id)
        : undefined;

    /*
     * No checkpoint_id means:
     * "give me the latest checkpoint for this thread".
     */
    if (!checkpointId) {
      const ids = await redis.zrange<string>(
        this.checkpointsKey(threadId, checkpointNs),
        -1,
        -1
      );

      checkpointId = ids[0];

      if (!checkpointId) {
        return undefined;
      }
    }

    const stored =
      await redis.get<StoredCheckpoint>(
        this.checkpointKey(
          threadId,
          checkpointNs,
          checkpointId
        )
      );

    if (!stored) {
      return undefined;
    }

    const pendingWrites =
      (await redis.get<PendingWrite[]>(
        this.writesKey(
          threadId,
          checkpointNs,
          checkpointId
        )
      )) ?? [];

    return {
      config: stored.config,
      checkpoint: stored.checkpoint,
      metadata: stored.metadata,
      parentConfig: stored.parentConfig,
      pendingWrites,
    };
  }

  async *list(
    config: RunnableConfig,
    options?: {
      before?: RunnableConfig;
      limit?: number;
      filter?: Record<string, unknown>;
    }
  ): AsyncGenerator<CheckpointTuple> {
    const configurable = config.configurable;

    if (!configurable?.thread_id) {
      throw new Error("thread_id is required");
    }

    const threadId = String(configurable.thread_id);

    const checkpointNs =
      String(configurable.checkpoint_ns ?? "");

    let checkpointIds =
      await redis.zrange<string>(
        this.checkpointsKey(threadId, checkpointNs),
        0,
        -1,
        { rev: true }
      );

    if (options?.before?.configurable?.checkpoint_id) {
      const beforeId = String(
        options.before.configurable.checkpoint_id
      );

      checkpointIds = checkpointIds.filter(
        (id) => id < beforeId
      );
    }

    if (options?.limit !== undefined) {
      checkpointIds = checkpointIds.slice(
        0,
        options.limit
      );
    }

    for (const checkpointId of checkpointIds) {
      const tuple = await this.getTuple({
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: checkpointId,
        },
      });

      if (!tuple) {
        continue;
      }

      if (options?.filter) {
        const matches = Object.entries(
          options.filter
        ).every(
          ([key, value]) =>
            tuple.metadata?.[key] === value
        );

        if (!matches) {
          continue;
        }
      }

      yield tuple;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    const configurable = config.configurable;

    if (!configurable?.thread_id) {
      throw new Error("thread_id is required");
    }

    const threadId = String(configurable.thread_id);

    const checkpointNs =
      String(configurable.checkpoint_ns ?? "");

    const checkpointId = checkpoint.id;

    const parentCheckpointId =
      configurable.checkpoint_id
        ? String(configurable.checkpoint_id)
        : undefined;

    const checkpointConfig: RunnableConfig = {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpointId,
      },
    };

    const parentConfig = parentCheckpointId
      ? {
          configurable: {
            thread_id: threadId,
            checkpoint_ns: checkpointNs,
            checkpoint_id:
              parentCheckpointId,
          },
        }
      : undefined;

    const stored: StoredCheckpoint = {
      checkpoint,
      metadata,
      config: checkpointConfig,
      parentConfig,
    };

    const checkpointKey =
      this.checkpointKey(
        threadId,
        checkpointNs,
        checkpointId
      );

    /*
     * Store the checkpoint itself.
     */
    await redis.set(
      checkpointKey,
      stored
    );

    /*
     * Maintain an ordered list of checkpoints.
     */
    await redis.zadd(
      this.checkpointsKey(
        threadId,
        checkpointNs
      ),
      {
        score: Date.parse(checkpoint.ts),
        member: checkpointId,
      }
    );

    /*
     * Keep track of every Redis key belonging
     * to this conversation.
     */
    await redis.sadd(
      this.threadKeysKey(threadId),
      checkpointKey,
      this.checkpointsKey(
        threadId,
        checkpointNs
      )
    );

    return checkpointConfig;
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string
  ): Promise<void> {
    const configurable = config.configurable;

    if (!configurable?.thread_id) {
      throw new Error("thread_id is required");
    }

    if (!configurable?.checkpoint_id) {
      throw new Error("checkpoint_id is required");
    }

    const threadId = String(configurable.thread_id);

    const checkpointNs =
      String(configurable.checkpoint_ns ?? "");

    const checkpointId =
      String(configurable.checkpoint_id);

    const key = this.writesKey(
      threadId,
      checkpointNs,
      checkpointId
    );

    /*
     * We only need the writes to be available when
     * restoring a checkpoint.
     */
    await redis.set(key, writes);

    await redis.sadd(
      this.threadKeysKey(threadId),
      key
    );
  }

  async deleteThread(
    threadId: string
  ): Promise<void> {
    const keys =
      await redis.smembers<string>(
        this.threadKeysKey(threadId)
      );

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    await redis.del(
      this.threadKeysKey(threadId)
    );
  }
}