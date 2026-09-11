import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { POST } from './route';

// 1. 创建可控制返回值、可检查调用记录的数据库替身。
const {
    findUnitMock,
    createSessionMock,
    updateUnitMock,
} = vi.hoisted(() => ({
    findUnitMock: vi.fn(),
    createSessionMock: vi.fn(),
    updateUnitMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    prisma: {
        learningUnit: {
            findUnique: findUnitMock,
            update: updateUnitMock,
        },
        readingSession: {
            create: createSessionMock,
        },
    },
}));

// 2. 每个测试都从合法的文章单元开始。
function makeUnit() {
    return {
        id: 'unit-1',
        type: 'text_section',
        status: 'pending',
        content: 'Original article text stored in the database.',
        material: {
            type: 'article',
            title: 'Stored article title',
        },
    };
}

function makeRequest(body: unknown) {
    return new Request('http://localhost/api/reading-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

const validInput = {
    learningUnitId: 'unit-1',
    answer: 'My summary.',
};

describe('POST /api/reading-sessions', () => {
    beforeEach(() => {
        vi.resetAllMocks();

        findUnitMock.mockResolvedValue(makeUnit());

        createSessionMock.mockResolvedValue({
            id: 'reading-session-1',
            learningUnitId: 'unit-1',
            materialTitle: 'Stored article title',
            contentSnapshot: 'Original article text stored in the database.',
            answer: 'My summary.',
            analysis: null,
            model: null,
            createdAt: '2026-09-11T12:00:00.000Z',
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // 3. 成功路径：检查读什么、写什么、返回什么。
    it('saves the database snapshot and trimmed answer without updating progress', async () => {
        const response = await POST(
            makeRequest({
                learningUnitId: '  unit-1  ',
                answer: '  My summary.  ',
            })
        );

        expect(response.status).toBe(201);

        expect(findUnitMock).toHaveBeenCalledWith({
            where: { id: 'unit-1' },
            include: { material: true },
        });

        expect(createSessionMock).toHaveBeenCalledTimes(1);
        expect(createSessionMock).toHaveBeenCalledWith({
            data: {
                learningUnitId: 'unit-1',
                materialTitle: 'Stored article title',
                contentSnapshot:
                    'Original article text stored in the database.',
                answer: 'My summary.',
            },
        });

        expect(updateUnitMock).not.toHaveBeenCalled();

        expect(await response.json()).toMatchObject({
            session: {
                id: 'reading-session-1',
                analysis: null,
            },
        });
    });

    // 4. 输入边界：无效请求不应该访问数据库。
    it('rejects malformed JSON before accessing the database', async () => {
        const request = new Request(
            'http://localhost/api/reading-sessions',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"answer":',
            }
        );

        const response = await POST(request);

        expect(response.status).toBe(400);
        expect(findUnitMock).not.toHaveBeenCalled();
        expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('rejects an invalid answer before accessing the database', async () => {
        const response = await POST(
            makeRequest({ ...validInput, answer: '   ' })
        );

        expect(response.status).toBe(400);
        expect(findUnitMock).not.toHaveBeenCalled();
        expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('rejects a client-supplied content snapshot', async () => {
        const response = await POST(
            makeRequest({
                ...validInput,
                contentSnapshot: 'Client replacement text.',
            })
        );

        expect(response.status).toBe(400);
        expect(findUnitMock).not.toHaveBeenCalled();
        expect(createSessionMock).not.toHaveBeenCalled();
    });

    // 5. 业务边界：合法输入不代表单元可以练习。
    it('returns 404 when the unit does not exist', async () => {
        findUnitMock.mockResolvedValue(null);

        const response = await POST(makeRequest(validInput));

        expect(response.status).toBe(404);
        expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('rejects a non-article material', async () => {
        const unit = makeUnit();
        unit.material.type = 'podcast';
        findUnitMock.mockResolvedValue(unit);

        const response = await POST(makeRequest(validInput));

        expect(response.status).toBe(400);
        expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('rejects a non-text unit', async () => {
        const unit = makeUnit();
        unit.type = 'audio_segment';
        findUnitMock.mockResolvedValue(unit);

        const response = await POST(makeRequest(validInput));

        expect(response.status).toBe(400);
        expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('returns 409 for a covered unit', async () => {
        const unit = makeUnit();
        unit.status = 'covered';
        findUnitMock.mockResolvedValue(unit);

        const response = await POST(makeRequest(validInput));

        expect(response.status).toBe(409);
        expect(createSessionMock).not.toHaveBeenCalled();
    });

    // 6. 存储数据异常：与用户提交错误区分。
    it.each(['materialType', 'unitType', 'status'] as const)(
        'returns 500 for an unknown stored %s',
        async (field) => {
            const unit = makeUnit();

            if (field === 'materialType') {
                unit.material.type = 'unknown';
            } else if (field === 'unitType') {
                unit.type = 'unknown';
            } else {
                unit.status = 'unknown';
            }

            findUnitMock.mockResolvedValue(unit);

            const response = await POST(makeRequest(validInput));

            expect(response.status).toBe(500);
            expect(createSessionMock).not.toHaveBeenCalled();
        }
    );

    // 7. 数据库异常：返回受控错误，不把内部信息发给客户端。
    it('returns 500 when the database lookup fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        findUnitMock.mockRejectedValue(
            new Error('Internal database connection detail')
        );

        const response = await POST(makeRequest(validInput));

        expect(response.status).toBe(500);
        expect(createSessionMock).not.toHaveBeenCalled();
        expect(await response.json()).toEqual({
            error: '保存 Reading Session 失败',
        });
    });

    it('returns 500 when saving fails without updating progress', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        createSessionMock.mockRejectedValue(
            new Error('Internal database write detail')
        );

        const response = await POST(makeRequest(validInput));

        expect(response.status).toBe(500);
        expect(updateUnitMock).not.toHaveBeenCalled();
        expect(await response.json()).toEqual({
            error: '保存 Reading Session 失败',
        });
    });
});