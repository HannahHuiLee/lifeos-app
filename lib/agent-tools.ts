import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const DEFAULT_REFLECTION_LIMIT = 5;
const MAX_REFLECTION_LIMIT = 20;

export type GetRecentReflectionsInput = {
    limit?: number;
};


export async function getRecentReflections(
    input: GetRecentReflectionsInput = {}
) {
    const requestedLimit =
        input.limit ?? DEFAULT_REFLECTION_LIMIT;

    const limit = Math.min(
        Math.max(Math.trunc(requestedLimit), 1),
        MAX_REFLECTION_LIMIT
    );

    const reflections = await prisma.reflection.findMany({
        orderBy: {
            createdAt: 'desc',
        },
        take: limit,
        select: {
            id: true,
            content: true,
            createdAt: true,
        },
    });

    return reflections.map((reflection) => ({
        ...reflection,
        createdAt: reflection.createdAt.toISOString(),
    }));
}

//运行时参数 Schema ， 让 Zod 拒绝未知字段
const GetRecentReflectionsArgumentsSchema = z
    .object({
        limit: z.number().int().min(1).max(20),
    })
    .strict(); //strict()对应 Tool Schema 中的：additionalProperties: false。没有strict()时，Zod 可能把未知字段删除后继续执行，而不是明确拒绝。


export type AgentToolErrorCode =
    | 'unknown_tool' //模型请求了未注册工具
    | 'invalid_json' //arguments 无法 JSON.parse
    | 'invalid_arguments';  //JSON 有效，但不符合 Zod Schema

export class AgentToolError extends Error {
    constructor(
        public readonly code: AgentToolErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'AgentToolError';
    }
}

export const agentTools = [
    {
        type: 'function',
        name: 'get_recent_reflections',
        description:
            '读取用户最近保存的 Reflection。当用户询问最近的经历、情绪、行为或反思内容时使用。',
        parameters: {
            type: 'object',
            properties: {
                limit: {
                    type: 'integer',
                    description: '需要读取的 Reflection 数量。',
                    minimum: 1,
                    maximum: 20,
                },
            },
            required: ['limit'],
            additionalProperties: false, //禁止模型添加未定义参数
        },
        strict: true, //要求模型生成严格符合 Schema 的参数
    },
] as const;

//Dispatcher
//这个显式 switch 也是 Tool Permission Allowlist。模型只能执行我们明确注册的函数。
export async function executeAgentTool(
    name: string,
    argumentsJson: string
) {
    if (name !== 'get_recent_reflections') {
        throw new AgentToolError(
            'unknown_tool',
            `未知工具：${name}`
        );
    }

    let parsedArguments: unknown;

    try {
        parsedArguments = JSON.parse(argumentsJson);
    } catch {
        throw new AgentToolError(
            'invalid_json',
            '工具参数不是有效 JSON'
        );
    }

    // safeParse 让我们先处理验证失败，再转换成安全的 AgentToolError。
    const validation =
        GetRecentReflectionsArgumentsSchema.safeParse(
            parsedArguments
        );

    if (!validation.success) {
        throw new AgentToolError(
            'invalid_arguments',
            '工具参数未通过验证'
        );
    }

    const result = await getRecentReflections(
        validation.data
    );

    return {
        arguments: validation.data,
        result,
    };
}
