/**
 * Assistant library barrel: sanitization, context building, consent storage, client.
 */
export * from './sanitize';
export * from './contextBuilder';
export * from './consent';
export * from './proposal';
export * from './audit';
export { queryAssistant, AssistantRequestError } from './client';
export type { AssistantConversationMessage, AssistantQueryResponse } from './client';
