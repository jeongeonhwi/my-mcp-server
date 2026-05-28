import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerAll } from './registerAll.js'

const server = new McpServer({
    name: 'my-mcp-server',
    version: '1.0.0'
})

registerAll(server)

server
    .connect(new StdioServerTransport())
    .catch(console.error)
    .then(() => {
        console.error('MCP server started (stdio)')
    })
