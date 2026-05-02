import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

const PROXY_API_KEY = process.env.PROXY_API_KEY ?? "123";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
});

const anthropic = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "dummy",
});

const MODELS = [
  { id: "gpt-4.1", provider: "openai" },
  { id: "gpt-4.1-mini", provider: "openai" },
  { id: "gpt-4.1-nano", provider: "openai" },
  { id: "gpt-4o", provider: "openai" },
  { id: "gpt-4o-mini", provider: "openai" },
  { id: "gpt-5", provider: "openai" },
  { id: "gpt-5-mini", provider: "openai" },
  { id: "gpt-5-nano", provider: "openai" },
  { id: "gpt-5-pro", provider: "openai" },
  { id: "gpt-5.1", provider: "openai" },
  { id: "gpt-5.1-codex", provider: "openai" },
  { id: "gpt-5.1-codex-mini", provider: "openai" },
  { id: "gpt-5.2", provider: "openai" },
  { id: "gpt-5.2-codex", provider: "openai" },
  { id: "gpt-5.2-pro", provider: "openai" },
  { id: "gpt-5.3-chat-latest", provider: "openai" },
  { id: "gpt-5.3-codex", provider: "openai" },
  { id: "gpt-5.4", provider: "openai" },
  { id: "gpt-5.4-mini", provider: "openai" },
  { id: "gpt-5.4-nano", provider: "openai" },
  { id: "gpt-5.4-pro", provider: "openai" },
  { id: "gpt-5.5", provider: "openai" },
  { id: "gpt-5.5-pro", provider: "openai" },
  { id: "o3", provider: "openai" },
  { id: "o3-mini", provider: "openai" },
  { id: "o4-mini", provider: "openai" },
  { id: "claude-opus-4-7", provider: "anthropic" },
  { id: "claude-opus-4-6", provider: "anthropic" },
  { id: "claude-opus-4-5", provider: "anthropic" },
  { id: "claude-sonnet-4-6", provider: "anthropic" },
  { id: "claude-haiku-4-5", provider: "anthropic" },
  { id: "claude-opus-4-7-thinking", provider: "anthropic" },
  { id: "claude-opus-4-6-thinking", provider: "anthropic" },
  { id: "claude-opus-4-5-thinking", provider: "anthropic" },
];

interface ModelStats {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  errors: number;
  lastUsedAt: number | null;
}

interface UsageStore {
  startedAt: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalErrors: number;
  byModel: Record<string, ModelStats>;
}

const usage: UsageStore = {
  startedAt: Date.now(),
  totalRequests: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalErrors: 0,
  byModel: {},
};

function getOrCreateModelStats(model: string): ModelStats {
  if (!usage.byModel[model]) {
    usage.byModel[model] = {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      errors: 0,
      lastUsedAt: null,
    };
  }
  return usage.byModel[model];
}

function recordRequest(model: string) {
  usage.totalRequests++;
  getOrCreateModelStats(model).requests++;
  getOrCreateModelStats(model).lastUsedAt = Date.now();
}

function recordTokens(model: string, inputTokens: number, outputTokens: number) {
  usage.totalInputTokens += inputTokens;
  usage.totalOutputTokens += outputTokens;
  getOrCreateModelStats(model).inputTokens += inputTokens;
  getOrCreateModelStats(model).outputTokens += outputTokens;
}

function recordError(model: string) {
  usage.totalErrors++;
  getOrCreateModelStats(model).errors++;
}

function authMiddleware(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || authHeader !== `Bearer ${PROXY_API_KEY}`) {
    res.status(401).json({
      error: { message: "Invalid API key", type: "invalid_request_error", code: "invalid_api_key" },
    });
    return;
  }
  next();
}

router.get("/models", authMiddleware, (_req: Request, res: Response) => {
  const now = Math.floor(Date.now() / 1000);
  res.json({
    object: "list",
    data: MODELS.map((m) => ({
      id: m.id,
      object: "model",
      created: now,
      owned_by: m.provider,
    })),
  });
});

router.get("/usage", (_req: Request, res: Response) => {
  res.json({
    startedAt: usage.startedAt,
    uptimeMs: Date.now() - usage.startedAt,
    totalRequests: usage.totalRequests,
    totalInputTokens: usage.totalInputTokens,
    totalOutputTokens: usage.totalOutputTokens,
    totalTokens: usage.totalInputTokens + usage.totalOutputTokens,
    totalErrors: usage.totalErrors,
    byModel: usage.byModel,
  });
});

// Probe both AI integrations to check quota / availability
router.get("/quota-status", async (_req: Request, res: Response) => {
  async function checkProvider(name: "openai" | "anthropic"): Promise<{ available: boolean; error: string | null; code: string | null }> {
    try {
      const QUOTA_CODES = new Set(["FREE_TIER_BUDGET_EXCEEDED", "insufficient_quota", "rate_limit_exceeded"]);
      if (name === "openai") {
        const r = await fetch(
          (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "") + "/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? ""}`,
            },
            body: JSON.stringify({ model: "gpt-5-mini", max_completion_tokens: 5, messages: [{ role: "user", content: "hi" }] }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (r.ok) return { available: true, error: null, code: null };
        const data = (await r.json()) as { error?: { code?: string; message?: string } };
        const code = data.error?.code ?? null;
        // Only treat quota/budget errors as truly unavailable; other API errors mean the service is up
        if (code && QUOTA_CODES.has(code)) {
          return { available: false, error: data.error?.message ?? "Unknown error", code };
        }
        return { available: true, error: null, code: null };
      } else {
        const r = await fetch(
          (process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? "") + "/messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "",
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 5, messages: [{ role: "user", content: "hi" }] }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (r.ok) return { available: true, error: null, code: null };
        const data = (await r.json()) as { error?: { code?: string; message?: string } };
        const code = data.error?.code ?? null;
        if (code && QUOTA_CODES.has(code)) {
          return { available: false, error: data.error?.message ?? "Unknown error", code };
        }
        return { available: true, error: null, code: null };
      }
    } catch (e: unknown) {
      return { available: false, error: (e as Error).message, code: "NETWORK_ERROR" };
    }
  }

  const [openaiStatus, anthropicStatus] = await Promise.all([checkProvider("openai"), checkProvider("anthropic")]);
  res.json({ openai: openaiStatus, anthropic: anthropicStatus, checkedAt: Date.now() });
});

router.post("/chat/completions", authMiddleware, async (req: Request, res: Response) => {
  const body = req.body as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
    [key: string]: unknown;
  };

  const { model, messages, stream } = body;

  const isAnthropic = model.startsWith("claude");
  const isOpenAI = model.startsWith("gpt") || model.startsWith("o");

  recordRequest(model);

  try {
    if (isAnthropic) {
      const systemMessages = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
      const chatMessages = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        const keepaliveInterval = setInterval(() => {
          res.write(": keepalive\n\n");
          if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
            (res as unknown as { flush: () => void }).flush();
          }
        }, 5000);

        req.on("close", () => clearInterval(keepaliveInterval));

        try {
          const anthropicStream = anthropic.messages.stream({
            model,
            max_tokens: 8192,
            system: systemMessages || undefined,
            messages: chatMessages,
          });

          const id = `chatcmpl-${Date.now()}`;
          const created = Math.floor(Date.now() / 1000);

          for await (const event of anthropicStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              const chunk = {
                id,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }],
              };
              res.write(`data: ${JSON.stringify(chunk)}\n\n`);
              if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
                (res as unknown as { flush: () => void }).flush();
              }
            }
            if (event.type === "message_delta" && event.usage) {
              recordTokens(model, 0, event.usage.output_tokens);
            }
            if (event.type === "message_start" && event.message.usage) {
              recordTokens(model, event.message.usage.input_tokens, 0);
            }
          }

          const doneChunk = {
            id,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          };
          res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
          res.write("data: [DONE]\n\n");
        } finally {
          clearInterval(keepaliveInterval);
          res.end();
        }
      } else {
        const response = await anthropic.messages.create({
          model,
          max_tokens: 8192,
          system: systemMessages || undefined,
          messages: chatMessages,
        });

        recordTokens(model, response.usage.input_tokens, response.usage.output_tokens);

        const textContent = response.content.find((b) => b.type === "text");
        res.json({
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: textContent?.type === "text" ? textContent.text : "" },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: response.usage.input_tokens,
            completion_tokens: response.usage.output_tokens,
            total_tokens: response.usage.input_tokens + response.usage.output_tokens,
          },
        });
      }
    } else if (isOpenAI) {
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        const keepaliveInterval = setInterval(() => {
          res.write(": keepalive\n\n");
          if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
            (res as unknown as { flush: () => void }).flush();
          }
        }, 5000);

        req.on("close", () => clearInterval(keepaliveInterval));

        try {
          const openaiStream = await openai.chat.completions.create({
            model,
            messages: messages as OpenAI.ChatCompletionMessageParam[],
            stream: true,
            stream_options: { include_usage: true },
          });

          for await (const chunk of openaiStream) {
            if (chunk.usage) {
              recordTokens(model, chunk.usage.prompt_tokens ?? 0, chunk.usage.completion_tokens ?? 0);
            }
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
              (res as unknown as { flush: () => void }).flush();
            }
          }

          res.write("data: [DONE]\n\n");
        } finally {
          clearInterval(keepaliveInterval);
          res.end();
        }
      } else {
        const response = await openai.chat.completions.create({
          model,
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          stream: false,
        });

        if (response.usage) {
          recordTokens(model, response.usage.prompt_tokens, response.usage.completion_tokens);
        }

        res.json(response);
      }
    } else {
      res.status(400).json({
        error: { message: `Unknown model: ${model}`, type: "invalid_request_error", code: "model_not_found" },
      });
    }
  } catch (err: unknown) {
    recordError(model);
    const error = err as { message?: string; status?: number };
    if (!res.headersSent) {
      res.status(error.status ?? 500).json({
        error: { message: error.message ?? "Internal server error", type: "api_error" },
      });
    } else if (!res.writableEnded) {
      // Streaming already started — send an SSE error event so the client knows
      const errChunk = {
        id: `chatcmpl-err-${Date.now()}`,
        object: "chat.completion.chunk",
        choices: [{ index: 0, delta: { content: `[ERROR] ${error.message ?? "Internal server error"}` }, finish_reason: "stop" }],
      };
      res.write(`data: ${JSON.stringify(errChunk)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
});

export default router;
