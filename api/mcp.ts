import type { IncomingMessage, ServerResponse } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { registerAll } from '../src/registerAll.js'

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const server = new McpServer({
        name: 'my-mcp-server',
        version: '1.0.0'
    })

    registerAll(server)

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
    })

    await server.connect(transport)

    const chunks: Buffer[] = []
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const rawBody = Buffer.concat(chunks).toString('utf-8')
    const parsedBody = rawBody ? JSON.parse(rawBody) : undefined

    await transport.handleRequest(req, res, parsedBody)
}
