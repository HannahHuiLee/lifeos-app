// 文件路径: app/api/notes/route.ts
import { NextResponse } from 'next/server';

// ⚠️ 注意：如果你之前为了绕过报错，把导入路径改成了相对路径（比如 '../../lib/prisma'），请保持你修改后的路径！
import { prisma } from '@/lib/prisma'; 

// 处理 POST 请求 (保存数据)
export async function POST(request: Request) {
  try {
    // 1. 解析前端传来的数据
    const { content } = await request.json();
    
    // 2. 简单的数据校验
    if (!content || content.trim() === '') {
      return NextResponse.json({ error: '内容不能为空' }, { status: 400 });
    }

    // 3. 存入数据库
    const newNote = await prisma.note.create({
      data: { content },
    });
    
    // 4. 返回成功信息
    return NextResponse.json(newNote, { status: 201 });
    
  } catch {
    // 生产环境中，通常不在控制台打印详细错误，而是返回通用提示
    // 如果需要记录错误，通常会接入专门的日志系统（如 Sentry）
    return NextResponse.json({ error: '服务器内部错误，保存失败' }, { status: 500 });
  }
}