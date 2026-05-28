import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { registerAll } from '../src/registerAll.js'

export default async function handler(req: Request): Promise<Response> {
    const server = new McpServer({
        name: 'my-mcp-server',
        version: '1.0.0'
    })

    registerAll(server)

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
    })

    await server.connect(transport)

    return transport.handleRequest(req)
}

export const GET = handler
export const POST = handler
export const DELETE = handler
