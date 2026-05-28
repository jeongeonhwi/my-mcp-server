import { InferenceClient } from '@huggingface/inference'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export function registerAll(server: McpServer): void {
    server.registerTool(
        'greet',
        {
            description: '이름과 언어를 입력하면 인사말을 반환합니다.',
            inputSchema: z.object({
                name: z.string().describe('인사할 사람의 이름'),
                language: z
                    .enum(['ko', 'en'])
                    .optional()
                    .default('en')
                    .describe('인사 언어 (기본값: en)')
            }),
            outputSchema: z.object({
                content: z
                    .array(
                        z.object({
                            type: z.literal('text'),
                            text: z.string().describe('인사말')
                        })
                    )
                    .describe('인사말')
            })
        },
        async ({ name, language }) => {
            const greeting =
                language === 'ko'
                    ? `안녕하세요, ${name}님!`
                    : `Hey there, ${name}! 👋 Nice to meet you!`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: greeting
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: greeting
                        }
                    ]
                }
            }
        }
    )

    server.registerTool(
        'calculate',
        {
            description: '두 숫자와 연산자를 입력하면 사칙연산 결과를 반환합니다.',
            inputSchema: z.object({
                operator: z
                    .enum(['+', '-', '*', '/'])
                    .describe('연산자 (+, -, *, /)'),
                a: z.number().describe('첫 번째 숫자'),
                b: z.number().describe('두 번째 숫자')
            }),
            outputSchema: z.object({
                content: z
                    .array(
                        z.object({
                            type: z.literal('text'),
                            text: z.string().describe('계산 결과')
                        })
                    )
                    .describe('계산 결과')
            })
        },
        async ({ operator, a, b }) => {
            let result: number

            if (operator === '/' && b === 0) {
                const text = '오류: 0으로 나눌 수 없습니다.'
                return {
                    content: [{ type: 'text' as const, text }],
                    structuredContent: { content: [{ type: 'text' as const, text }] }
                }
            }

            switch (operator) {
                case '+': result = a + b; break
                case '-': result = a - b; break
                case '*': result = a * b; break
                case '/': result = a / b; break
            }

            const text = `${a} ${operator} ${b} = ${result!}`
            return {
                content: [{ type: 'text' as const, text }],
                structuredContent: { content: [{ type: 'text' as const, text }] }
            }
        }
    )

    server.registerTool(
        'get_coordinates',
        {
            description: '도시 이름을 입력하면 위도(latitude)와 경도(longitude)를 반환합니다. (Nominatim/OpenStreetMap 사용, API 키 불필요)',
            inputSchema: z.object({
                city: z.string().describe('좌표를 조회할 도시 이름 (예: Seoul, Tokyo, New York)')
            }),
            outputSchema: z.object({
                content: z
                    .array(
                        z.object({
                            type: z.literal('text'),
                            text: z.string().describe('좌표 정보')
                        })
                    )
                    .describe('좌표 정보')
            })
        },
        async ({ city }) => {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`
            const res = await fetch(url, {
                headers: { 'User-Agent': 'my-mcp-server/1.0' }
            })

            if (!res.ok) {
                const text = `오류: Nominatim API 요청 실패 (status: ${res.status})`
                return {
                    content: [{ type: 'text' as const, text }],
                    structuredContent: { content: [{ type: 'text' as const, text }] }
                }
            }

            const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>

            if (data.length === 0) {
                const text = `'${city}'에 대한 검색 결과가 없습니다.`
                return {
                    content: [{ type: 'text' as const, text }],
                    structuredContent: { content: [{ type: 'text' as const, text }] }
                }
            }

            const { lat, lon, display_name } = data[0]
            const text = `도시: ${display_name}\n위도(latitude): ${lat}\n경도(longitude): ${lon}`
            return {
                content: [{ type: 'text' as const, text }],
                structuredContent: { content: [{ type: 'text' as const, text }] }
            }
        }
    )

    server.registerTool(
        'get_weather',
        {
            description: '위도와 경도를 입력하면 날씨 정보를 반환합니다. date를 생략하면 현재 날씨, YYYY-MM-DD 형식으로 입력하면 해당 날짜의 날씨를 반환합니다. (Open-Meteo 사용, API 키 불필요)',
            inputSchema: z.object({
                latitude: z.number().describe('위도 (예: 37.5665)'),
                longitude: z.number().describe('경도 (예: 126.9780)'),
                date: z
                    .string()
                    .optional()
                    .describe('조회할 날짜 (YYYY-MM-DD 형식, 생략 시 현재 날씨 조회)')
            }),
            outputSchema: z.object({
                content: z
                    .array(
                        z.object({
                            type: z.literal('text'),
                            text: z.string().describe('날씨 정보')
                        })
                    )
                    .describe('날씨 정보')
            })
        },
        async ({ latitude, longitude, date }) => {
            const weatherDescriptions: Record<number, string> = {
                0: '맑음', 1: '대체로 맑음', 2: '부분적으로 흐림', 3: '흐림',
                45: '안개', 48: '안개(서리)',
                51: '가벼운 이슬비', 53: '이슬비', 55: '강한 이슬비',
                61: '가벼운 비', 63: '비', 65: '강한 비',
                71: '가벼운 눈', 73: '눈', 75: '강한 눈',
                80: '소나기(약)', 81: '소나기', 82: '강한 소나기',
                95: '뇌우', 96: '뇌우(약한 우박)', 99: '뇌우(강한 우박)'
            }

            let text: string

            if (date) {
                const today = new Date().toISOString().slice(0, 10)
                const isPast = date < today

                const url = isPast
                    ? `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max&timezone=auto`
                    : `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max&timezone=auto`

                const res = await fetch(url)

                if (!res.ok) {
                    const errText = `오류: Open-Meteo API 요청 실패 (status: ${res.status})`
                    return {
                        content: [{ type: 'text' as const, text: errText }],
                        structuredContent: { content: [{ type: 'text' as const, text: errText }] }
                    }
                }

                const data = await res.json() as {
                    daily: {
                        time: string[]
                        temperature_2m_max: number[]
                        temperature_2m_min: number[]
                        precipitation_sum: number[]
                        weathercode: number[]
                        windspeed_10m_max: number[]
                    }
                    daily_units: {
                        temperature_2m_max: string
                        temperature_2m_min: string
                        precipitation_sum: string
                        windspeed_10m_max: string
                    }
                }

                const d = data.daily
                const u = data.daily_units
                const condition = weatherDescriptions[d.weathercode[0]] ?? `날씨 코드: ${d.weathercode[0]}`
                const label = isPast ? '날짜' : date === today ? '오늘' : '예보 날짜'

                text = [
                    `${label}: ${d.time[0]}`,
                    `날씨 상태: ${condition}`,
                    `최고 기온: ${d.temperature_2m_max[0]}${u.temperature_2m_max}`,
                    `최저 기온: ${d.temperature_2m_min[0]}${u.temperature_2m_min}`,
                    `강수량: ${d.precipitation_sum[0]}${u.precipitation_sum}`,
                    `최대 풍속: ${d.windspeed_10m_max[0]}${u.windspeed_10m_max}`
                ].join('\n')
            } else {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weathercode&timezone=auto`
                const res = await fetch(url)

                if (!res.ok) {
                    const errText = `오류: Open-Meteo API 요청 실패 (status: ${res.status})`
                    return {
                        content: [{ type: 'text' as const, text: errText }],
                        structuredContent: { content: [{ type: 'text' as const, text: errText }] }
                    }
                }

                const data = await res.json() as {
                    current: {
                        temperature_2m: number
                        relative_humidity_2m: number
                        wind_speed_10m: number
                        weathercode: number
                    }
                    current_units: {
                        temperature_2m: string
                        relative_humidity_2m: string
                        wind_speed_10m: string
                    }
                }

                const { temperature_2m, relative_humidity_2m, wind_speed_10m, weathercode } = data.current
                const units = data.current_units
                const condition = weatherDescriptions[weathercode] ?? `날씨 코드: ${weathercode}`

                text = [
                    `날씨 상태: ${condition}`,
                    `기온: ${temperature_2m}${units.temperature_2m}`,
                    `습도: ${relative_humidity_2m}${units.relative_humidity_2m}`,
                    `풍속: ${wind_speed_10m}${units.wind_speed_10m}`
                ].join('\n')
            }

            return {
                content: [{ type: 'text' as const, text }],
                structuredContent: { content: [{ type: 'text' as const, text }] }
            }
        }
    )

    server.registerResource(
        'server-info',
        'mcp://my-mcp-server/info',
        {
            title: '서버 정보',
            description: 'MCP 서버의 이름, 버전, 제공 도구 목록 등 기본 정보를 반환합니다.',
            mimeType: 'application/json'
        },
        async (uri) => {
            const info = {
                name: 'my-mcp-server',
                version: '1.0.0',
                description: 'TypeScript 기반 MCP 서버 보일러플레이트',
                tools: [
                    {
                        name: 'greet',
                        description: '이름과 언어를 입력하면 인사말을 반환합니다.'
                    },
                    {
                        name: 'calculate',
                        description: '두 숫자와 연산자(+,-,*,/)로 사칙연산 결과를 반환합니다.'
                    },
                    {
                        name: 'get_coordinates',
                        description: '도시 이름으로 위도·경도를 반환합니다. (Nominatim)'
                    },
                    {
                        name: 'get_weather',
                        description: '위도·경도와 선택적 날짜로 날씨 정보를 반환합니다. (Open-Meteo)'
                    },
                    {
                        name: 'generate-image',
                        description: 'HuggingFace FLUX.1-schnell 모델로 텍스트 프롬프트에서 이미지를 생성합니다. (HF_TOKEN 필요)'
                    }
                ],
                resources: [
                    {
                        uri: 'mcp://my-mcp-server/info',
                        description: '서버 정보 리소스 (현재 파일)'
                    }
                ],
                apis: [
                    { name: 'Nominatim (OpenStreetMap)', url: 'https://nominatim.openstreetmap.org', requiresKey: false },
                    { name: 'Open-Meteo', url: 'https://open-meteo.com', requiresKey: false },
                    { name: 'HuggingFace Inference API', url: 'https://huggingface.co/inference-api', requiresKey: true }
                ],
                createdAt: '2026-05-28'
            }

            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: 'application/json',
                        text: JSON.stringify(info, null, 2)
                    }
                ]
            }
        }
    )

    server.registerPrompt(
        'code-review',
        {
            title: '코드 리뷰',
            description: '코드를 입력받아 베스트 프랙티스에 따라 체계적으로 리뷰하는 프롬프트 템플릿',
            argsSchema: {
                code: z.string().describe('리뷰할 코드'),
                language: z
                    .string()
                    .optional()
                    .describe('프로그래밍 언어 (예: TypeScript, Python, Java). 생략 시 자동 감지'),
                focus: z
                    .enum(['all', 'security', 'performance', 'readability', 'bugs'])
                    .optional()
                    .default('all')
                    .describe('리뷰 집중 영역 (기본값: all)')
            }
        },
        ({ code, language, focus }) => {
            const lang = language ?? '(자동 감지)'
            const focusGuide: Record<string, string> = {
                all: '보안, 성능, 가독성, 버그 전 영역',
                security: '보안 취약점 및 인젝션, 인증/인가 문제',
                performance: '시간복잡도, 메모리 사용, 불필요한 연산',
                readability: '네이밍, 주석, 코드 구조 및 가독성',
                bugs: '잠재적 버그, 엣지 케이스, 오류 처리'
            }
            const focusArea = focusGuide[focus ?? 'all']

            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `당신은 시니어 소프트웨어 엔지니어입니다. 아래 코드를 **${focusArea}** 관점에서 베스트 프랙티스에 따라 체계적으로 리뷰해 주세요.

## 리뷰 대상 코드
- 언어: ${lang}
- 집중 영역: ${focusArea}

\`\`\`${language ?? ''}
${code}
\`\`\`

## 리뷰 형식 (아래 구조를 반드시 따르세요)

### 1. 요약
코드의 전반적인 품질과 주요 이슈를 2~3문장으로 요약합니다.

### 2. 발견된 문제점
각 문제점에 대해 다음 형식으로 작성합니다:
- **심각도**: 🔴 Critical / 🟠 Major / 🟡 Minor
- **위치**: 몇 번째 줄 또는 함수명
- **문제**: 무엇이 문제인지 설명
- **개선 방법**: 구체적인 수정 예시 코드 포함

### 3. 잘된 점
코드에서 잘 작성된 부분을 구체적으로 언급합니다.

### 4. 개선 제안 (선택)
필수는 아니지만 코드 품질을 높일 수 있는 추가 제안사항을 작성합니다.

### 5. 종합 평점
| 항목 | 점수 (10점 만점) |
|------|----------------|
| 코드 품질 | |
| 가독성 | |
| 성능 | |
| 보안 | |
| 테스트 가능성 | |
| **종합** | |`
                        }
                    }
                ]
            }
        }
    )

    server.registerTool(
        'generate-image',
        {
            description: 'HuggingFace FLUX.1-schnell 모델로 텍스트 프롬프트에서 이미지를 생성합니다. HF_TOKEN 환경변수 필요.',
            inputSchema: z.object({
                prompt: z.string().describe('이미지 생성 프롬프트'),
                num_inference_steps: z
                    .number()
                    .int()
                    .min(1)
                    .max(10)
                    .optional()
                    .default(4)
                    .describe('추론 스텝 수 (1~10, 기본값 4)')
            })
        },
        async ({ prompt, num_inference_steps }) => {
            if (!process.env.HF_TOKEN) {
                return {
                    content: [{ type: 'text' as const, text: '오류: HF_TOKEN 환경변수가 설정되어 있지 않습니다.' }],
                    isError: true
                }
            }

            try {
                const client = new InferenceClient(process.env.HF_TOKEN)
                const blob = await client.textToImage(
                    {
                        provider: 'together',
                        model: 'black-forest-labs/FLUX.1-schnell',
                        inputs: prompt,
                        parameters: { num_inference_steps }
                    },
                    { outputType: 'blob' }
                )
                const buffer = Buffer.from(await blob.arrayBuffer())
                return {
                    content: [{
                        type: 'image' as const,
                        data: buffer.toString('base64'),
                        mimeType: 'image/png'
                    }]
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                return {
                    content: [{ type: 'text' as const, text: `이미지 생성 실패: ${msg}` }],
                    isError: true
                }
            }
        }
    )
}
