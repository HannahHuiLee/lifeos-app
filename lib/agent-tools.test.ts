import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    reflection: {
      findMany: findManyMock,
    },
  },
}));

import {
  executeAgentTool,
} from '@/lib/agent-tools';

describe('executeAgentTool', () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it('executes get_recent_reflections with valid arguments', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'reflection-1',
        content: '测试 Reflection',
        createdAt: new Date(
          '2026-08-23T12:00:00.000Z'
        ),
      },
    ]);

    const execution = await executeAgentTool(
      'get_recent_reflections',
      '{"limit":1}'
    );

    expect(findManyMock).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
      take: 1,
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
    });

    expect(execution).toEqual({
      arguments: {
        limit: 1,
      },
      result: [
        {
          id: 'reflection-1',
          content: '测试 Reflection',
          createdAt:
            '2026-08-23T12:00:00.000Z',
        },
      ],
    });
  });

  it('rejects an unknown tool', async () => {
    await expect(
      executeAgentTool(
        'delete_all_reflections',
        '{}'
      )
    ).rejects.toMatchObject({
      name: 'AgentToolError',
      code: 'unknown_tool',
    });

    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON', async () => {
    await expect(
      executeAgentTool(
        'get_recent_reflections',
        '{"limit":'
      )
    ).rejects.toMatchObject({
      name: 'AgentToolError',
      code: 'invalid_json',
    });

    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('rejects arguments outside the allowed range', async () => {
    await expect(
      executeAgentTool(
        'get_recent_reflections',
        '{"limit":0}'
      )
    ).rejects.toMatchObject({
      name: 'AgentToolError',
      code: 'invalid_arguments',
    });

    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('rejects unknown argument fields', async () => {
    await expect(
      executeAgentTool(
        'get_recent_reflections',
        '{"limit":2,"privateField":true}'
      )
    ).rejects.toMatchObject({
      name: 'AgentToolError',
      code: 'invalid_arguments',
    });

    expect(findManyMock).not.toHaveBeenCalled();
  });
});