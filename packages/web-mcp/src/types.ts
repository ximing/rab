import type { ZodTuple, ZodTypeAny } from 'zod';

export interface ParamDescriptor {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
}

export interface McpToolOptions {
  description: string;
  name?: string;
  inputSchema?: ZodTuple<[ZodTypeAny, ...ZodTypeAny[]]> | ZodTuple<[], null>;
  params?: ParamDescriptor[];
}

export interface McpToolMetadata {
  methodName: string;
  options: McpToolOptions;
}

export interface ActionDescriptor {
  name: string;
  description?: string;
  hasMcpTool: boolean;
  inputSchema?: Record<string, unknown>;
}

export interface ServiceDescriptor {
  instanceId: string;
  containerName: string;
  identifierType: 'constructor' | 'string' | 'symbol';
  identifierLabel: string;
  scope: string;
  actions: ActionDescriptor[];
  stateKeys: string[];
}

export interface ListServicesResult {
  services: ServiceDescriptor[];
}

export interface ExecuteActionInput {
  instanceId: string;
  action: string;
  args: unknown[];
}

export interface ExecuteActionResult {
  result: unknown;
  loading: boolean;
  error: string | null;
}

export interface GetStateInput {
  instanceId: string;
  keys?: string[];
}

export interface GetStateResult {
  state: Record<string, unknown>;
  model: Record<string, {
    loading: boolean;
    error: string | null;
  }>;
}

export interface SetStateInput {
  instanceId: string;
  patch: Record<string, unknown>;
}

export interface SetStateResult {
  success: boolean;
  updated: string[];
  rejected: Array<{ key: string; reason: string }>;
}

export interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown) => unknown | Promise<unknown>;
}

export interface ModelContextApi {
  registerTool(tool: WebMcpToolDefinition): { unregister(): void };
}

declare global {
  interface Navigator {
    modelContext?: ModelContextApi;
  }
}
