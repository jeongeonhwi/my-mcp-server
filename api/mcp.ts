import { createMcpHandler } from 'mcp-handler'
import { registerAll } from '../src/registerAll.js'

const handler = createMcpHandler(
    (server) => {
        registerAll(server)
    },
    {
        serverInfo: {
            name: 'my-mcp-server',
            version: '1.0.0'
        }
    },
    {
        basePath: '/api',
        maxDuration: 60,
        verboseLogs: false
    }
)

export { handler as GET, handler as POST, handler as DELETE }
export default handler
