// 文件路径: lib/prisma.ts

// ⚠️ 注意：这里必须保持我们之前配置的相对路径，不能改回 '@prisma/client'！
import { PrismaClient } from './prisma-generated';

// 1. 扩展 Node.js 的全局 global 对象，声明 prisma 属性
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// 2. 核心逻辑：如果全局里有缓存，就用缓存；如果没有，就新建一个
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // 🌟 进阶优化：在开发环境下打印 SQL 日志，方便调试！
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// 3. 在开发环境下，将实例挂载到全局对象，防止热更新时重复创建
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}