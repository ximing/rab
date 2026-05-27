export { McpBridge } from './bridge';
export { McpRegistry, createGenericTools } from './registry';
export { mcpTool } from './decorator';

export type {
  McpToolOptions,
  McpToolMetadata,
  ParamDescriptor,
  ActionDescriptor,
  ServiceDescriptor,
  ListServicesResult,
  ExecuteActionInput,
  ExecuteActionResult,
  GetStateInput,
  GetStateResult,
  SetStateInput,
  SetStateResult,
  WebMcpToolDefinition,
  ModelContextApi,
} from './types';

export const version = '0.0.1';
