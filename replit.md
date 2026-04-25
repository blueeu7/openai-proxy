# Workspace

## Overview

OpenAI 兼容反向代理 — pnpm monorepo，通过 Replit AI Integrations 统一接入 OpenAI 和 Anthropic 模型，无需自备 API Key。

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (api-portal)

## Artifacts

- **api-portal** (`/`) — React 前端管理门户，显示使用量统计、配额状态、接口文档、CherryStudio 配置指南
- **api-server** (`/api`, `/v1`) — Express 代理服务，OpenAI 兼容接口

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/v1/models` | 列出可用模型 | Bearer PROXY_API_KEY |
| POST | `/v1/chat/completions` | 聊天补全（支持 stream） | Bearer PROXY_API_KEY |
| GET | `/v1/usage` | 本次进程用量统计 | 无需 |
| GET | `/v1/quota-status` | 检测 integration 配额状态 | 无需 |

## Environment Variables

- `PROXY_API_KEY` — 访问密钥，默认 `123`，请在生产环境修改
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — 自动注入（Replit AI Integration）
- `AI_INTEGRATIONS_OPENAI_API_KEY` — 自动注入（Replit AI Integration）
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` — 自动注入（Replit AI Integration）
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — 自动注入（Replit AI Integration）

## Supported Models

**OpenAI**: gpt-5.2, gpt-5-mini, gpt-5-nano, o4-mini, o3  
**Anthropic**: claude-opus-4-6, claude-sonnet-4-6, claude-opus-4-5

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
