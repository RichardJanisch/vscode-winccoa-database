/**
 * Type definitions for the WinCC OA MCP Server extension's public API.
 *
 * These interfaces mirror the contract exported by the MCP Server extension
 * (`extensionApi.ts`). They are duplicated here because VS Code extensions
 * cannot share npm packages — this is the standard inter-extension pattern.
 */

import type { Event } from 'vscode';

export interface McpConnectionInfo {
    /** Full MCP endpoint URL, e.g. "http://localhost:3001/mcp" */
    url: string;
    /** Authentication token */
    token: string;
    /** Authentication type */
    authType: 'bearer' | 'basic';
    /** WinCC OA project name (if detected) */
    projectName?: string;
    /** WinCC OA project directory path (if detected) */
    projectPath?: string;
}

export type McpConnectionState = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface McpServerExtensionApi {
    /** Get current MCP connection info, or null if not connected */
    getConnectionInfo(): McpConnectionInfo | null;

    /** Get current connection state */
    getConnectionState(): McpConnectionState;

    /** Event fired when connection state or config changes */
    onDidChangeConnection: Event<McpConnectionInfo | null>;
}
