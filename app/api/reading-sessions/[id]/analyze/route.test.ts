import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { POST } from './route';

const mocks = vi.hoisted(() => ({
    findSession: vi.fn(),
    analyze: vi.fn(),
    transaction: vi.fn(),

    // 事务内的写入。
    txSaveSession: vi.fn(),
    txUpdateUnit: vi.fn(),

    // 外层客户端的写入：这个接口不应该调用它们。
    outerSaveSession: vi.fn(),
    outerUpdateUnit: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    prisma: {
        readingSession: {
            findUnique: mocks.findSession,
            update: mocks.outerSaveSession,
        },
        learningUnit: {
            update: mocks.outerUpdateUnit,
        },
        $transaction: mocks.transaction,
    },
}));

vi.mock('@/lib/reading-analyzer', () => ({
    analyzeReading: mocks.analyze,
}));

function makeAnalysis() {
    return {
        mainIdea: {
            captured: true,
            feedback: '你抓住了主旨。',
        },
        missedKeyPoints: [],
        corrections: [],
        suggestedSummary: 'Practice supports gradual improvement.',
    };
}

function makeSession() {
    return {
        id: 'session-1',
        learningUnitId: 'unit-1',
        materialTitle: 'Practice',
        contentSnapshot: 'Practice supports gradual improvement.',
        answer: 'Practice helps people improve.',
        analysis: null,
        model: null,
        createdAt: new Date('2026-09-11T12:00:00.000Z'),
    };
}

function makeSavedSession(learningUnitId: string | null = 'unit-1') {
    return {
        ...makeSession(),
        learningUnitId,
        analysis: JSON.stringify(makeAnalysis()),
        model: 'test-model',
    };
}

function callRoute() {
    return POST(
        new Request(
            'http://localhost/api/reading-sessions/session-1/analyze',
            { method: 'POST' }
        ),
        { params: { id: 'session-1' } }
    );
}

describe('POST /api/reading-sessions/[id]/analyze', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        mocks.findSession.mockResolvedValue(makeSession());

        mocks.analyze.mockImplementation(async () => {
            // 调用模型时，事务还不应该开始。
            expect(mocks.transaction).not.toHaveBeenCalled();

            return {
                analysis: makeAnalysis(),
                model: 'test-model',
            };
        });

        mocks.txSaveSession.mockResolvedValue(makeSavedSession());
        mocks.txUpdateUnit.mockResolvedValue({
            id: 'unit-1',
            status: 'covered',
        });

        mocks.transaction.mockImplementation(async (callback) => {
            return callback({
                readingSession: {
                    update: mocks.txSaveSession,
                },
                learningUnit: {
                    update: mocks.txUpdateUnit,
                },
            });
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('analyzes the saved snapshot and uses only transaction writes', async () => {
        const response = await callRoute();

        expect(response.status).toBe(200);
        expect(mocks.findSession).toHaveBeenCalledWith({
            where: { id: 'session-1' },
        });

        expect(mocks.analyze).toHaveBeenCalledWith({
            materialTitle: 'Practice',
            contentSnapshot: 'Practice supports gradual improvement.',
            answer: 'Practice helps people improve.',
        });

        expect(mocks.transaction).toHaveBeenCalledTimes(1);
        expect(mocks.txSaveSession).toHaveBeenCalledWith({
            where: { id: 'session-1' },
            data: {
                analysis: JSON.stringify(makeAnalysis()),
                model: 'test-model',
            },
        });
        expect(mocks.txUpdateUnit).toHaveBeenCalledWith({
            where: { id: 'unit-1' },
            data: { status: 'covered' },
        });

        expect(mocks.outerSaveSession).not.toHaveBeenCalled();
        expect(mocks.outerUpdateUnit).not.toHaveBeenCalled();

        expect(await response.json()).toMatchObject({
            session: {
                id: 'session-1',
                analysis: makeAnalysis(),
                model: 'test-model',
            },
        });
    });

    it('returns 404 without analyzing when the session is missing', async () => {
        mocks.findSession.mockResolvedValue(null);

        const response = await callRoute();

        expect(response.status).toBe(404);
        expect(mocks.analyze).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it('does not start a transaction when analysis fails', async () => {
        mocks.analyze.mockRejectedValue(new Error('Model unavailable'));

        const response = await callRoute();

        expect(response.status).toBe(500);
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.txSaveSession).not.toHaveBeenCalled();
        expect(mocks.txUpdateUnit).not.toHaveBeenCalled();
    });

    it('does not persist analysis that violates the contract', async () => {
        mocks.analyze.mockResolvedValue({
            analysis: {
                ...makeAnalysis(),
                suggestedSummary: '   ',
            },
            model: 'test-model',
        });

        const response = await callRoute();

        expect(response.status).toBe(500);
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.txSaveSession).not.toHaveBeenCalled();
    });

    it('saves historical analysis when the unit was deleted during analysis', async () => {
        // 最初读取时仍关联 unit-1，事务写入时关联已经置空。
        mocks.txSaveSession.mockResolvedValue(makeSavedSession(null));

        const response = await callRoute();

        expect(response.status).toBe(200);
        expect(mocks.txSaveSession).toHaveBeenCalledTimes(1);
        expect(mocks.txUpdateUnit).not.toHaveBeenCalled();
        expect(mocks.outerUpdateUnit).not.toHaveBeenCalled();

        expect(await response.json()).toMatchObject({
            session: {
                learningUnitId: null,
                analysis: makeAnalysis(),
            },
        });
    });

    it('does not update progress when saving analysis fails', async () => {
        mocks.txSaveSession.mockRejectedValue(
            new Error('Session write failed')
        );

        const response = await callRoute();

        expect(response.status).toBe(500);
        expect(mocks.transaction).toHaveBeenCalledTimes(1);
        expect(mocks.txUpdateUnit).not.toHaveBeenCalled();
        expect(mocks.outerUpdateUnit).not.toHaveBeenCalled();
    });

    it('returns an error when the progress write fails', async () => {
        mocks.txUpdateUnit.mockRejectedValue(
            new Error('Progress write failed')
        );

        const response = await callRoute();

        expect(response.status).toBe(500);
        expect(mocks.txSaveSession).toHaveBeenCalledTimes(1);
        expect(mocks.txUpdateUnit).toHaveBeenCalledTimes(1);
        expect(mocks.outerSaveSession).not.toHaveBeenCalled();
        expect(mocks.outerUpdateUnit).not.toHaveBeenCalled();

        expect(await response.json()).toEqual({
            error: '分析 Reading Session 失败，请稍后重试',
        });
    });

    it('returns an error if the transaction fails after its callback completes', async () => {
        mocks.transaction.mockImplementation(async (callback) => {
            await callback({
                readingSession: {
                    update: mocks.txSaveSession,
                },
                learningUnit: {
                    update: mocks.txUpdateUnit,
                },
            });

            throw new Error('Transaction commit failed');
        });

        const response = await callRoute();

        expect(response.status).toBe(500);
        expect(mocks.txSaveSession).toHaveBeenCalledTimes(1);
        expect(mocks.txUpdateUnit).toHaveBeenCalledTimes(1);
    });
});