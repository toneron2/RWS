/**
 * Shared MCP plumbing for the RWS calculation servers.
 *
 * Every server registers its tools through `defineTool`, which gives it
 * zod-validated, typed arguments and turns thrown errors into `isError`
 * tool results so the calling agent sees the message instead of a
 * protocol failure.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export function jsonResult(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function createServer(name: string): McpServer {
  return new McpServer({ name, version: "1.0.0" });
}

/**
 * Register a tool whose input is described by a zod shape. The handler
 * receives parsed, typed arguments and returns any JSON-serialisable value.
 */
export function defineTool<Shape extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  shape: Shape,
  handler: (args: z.infer<z.ZodObject<Shape>>) => unknown | Promise<unknown>
): void {
  // The SDK validates arguments against the schema before calling back; the
  // concrete schema type here keeps the callback signature non-generic.
  const inputSchema: z.ZodObject<z.ZodRawShape> = z.object(shape);
  server.registerTool(name, { description, inputSchema }, async (args: unknown) => {
    try {
      return jsonResult(await handler(args as z.infer<z.ZodObject<Shape>>));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  });
}

export async function serve(server: McpServer): Promise<void> {
  await server.connect(new StdioServerTransport());
}
