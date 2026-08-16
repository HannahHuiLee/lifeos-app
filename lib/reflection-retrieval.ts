import { prisma } from '@/lib/prisma';

const RETRIEVAL_LIMIT = 5;

// Id 用来排除当前 Reflection ; content : 为以后关键词或 embedding 检索预留，但现在不使用。; createdAt： 保证只检索真正的历史记录 
export type ReflectionRetrievalQuery = {
  id: string;
  content: string;
  createdAt: Date;
};

export type RetrievedReflection = {
  id: string;
  content: string;
  createdAt: Date;
};

export async function retrieveRelevantReflections(
  currentReflection: ReflectionRetrievalQuery
): Promise<RetrievedReflection[]> {
  // V1 将“相关”暂时定义为“当前记录之前最近的记录”。
  // 调用方不依赖这个具体策略，因此以后可以替换函数内部实现。
  return prisma.reflection.findMany({
    where: {
      id: {
        not: currentReflection.id,
      },
      createdAt: {
        lt: currentReflection.createdAt, //可以防止“时间泄漏”。例如以后重新分析一条旧 Reflection 时，它不应该引用创建于它之后的记录作为“历史证据”。
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: RETRIEVAL_LIMIT,
    // select 明确限制了返回的数据. 检索层只返回分析真正需要的字段，不返回已有 AI analysis 等无关数据。这也是 separation of concerns：检索结果是给下一阶段使用的证据文档，不是完整数据库对象。
    select: {
      id: true,
      content: true,
      createdAt: true,
    },
  });
}