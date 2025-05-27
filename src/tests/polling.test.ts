import { describe, it, expect, vi, beforeEach } from 'vitest';
import { polling } from '../main';
import fs from 'fs';

vi.mock('fs');
vi.useFakeTimers();


vi.mock('../config.json', () => ({
    default: {
        mongoUri: 'mongodb://localhost:27017',
        sourceDb: 'sourceDb',
        sourceCollection: 'sourceCol',
        targetDb: 'targetDb',
        targetCollection: 'targetCol',
        migrationErrorLog: 'migration-errors.json',
        syncErrorLog: 'sync-errors.json'
    }
}));

describe('polling', () => {

    
    const mockModifieds = {
        [Symbol.asyncIterator]: async function* () {
            yield { _id: 'abc123', name: 'Modificado', updatedAt: new Date() };
        },
        sort: vi.fn().mockReturnThis()
    };

    const mockSource = {
        find: vi.fn(() => mockModifieds)
    }

    const mockTarget = {
        replaceOne: vi.fn(() => ({ modifiedCount: 1, upsertedCount: 0 }))
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (fs.writeFileSync as any) = vi.fn();
    })

    it('deberia sincronizar documentos modificados', async() => {
        polling(mockSource, mockTarget);

        await vi.advanceTimersByTimeAsync(5000);

        expect(mockSource.find).toHaveBeenCalled();
        expect(mockTarget.replaceOne).toHaveBeenCalledWith(
            { _id: 'abc123' },
            expect.objectContaining({ name: 'Modificado' }),
            { upsert: true }
        );
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('deberia registrar errores si falla', async () => {
        mockTarget.replaceOne = vi.fn(() => {
            throw new Error('fallo');
        });

        polling(mockSource, mockTarget);
        await vi.advanceTimersByTimeAsync(5000);

        expect(fs.writeFileSync).toHaveBeenCalledWith(
            'sync-errors.json',
            expect.anything()
        );
    });
})