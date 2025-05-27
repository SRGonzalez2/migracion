import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MongoClient } from 'mongodb';
import { main } from '../main'
import fs from 'fs';


vi.mock('mongodb');
vi.mock('fs');


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
    

describe('migracion inicial', () => {
    const mockCursor = {
        [Symbol.asyncIterator]: async function* () {
            yield {_id: 'abc123', name: 'Test'}
        },  
        close: vi.fn()
    }   

    const mockCollection: any = {
        find: vi.fn(() => mockCursor),
        findOne: vi.fn(() => null),
        insertOne: vi.fn(),
        replaceOne: vi.fn()
    }

    beforeEach(() => {
        (MongoClient as any).mockImplementation(() => ({
            connect: vi.fn(),
            db: vi.fn(() => ({ collection: vi.fn(() => mockCollection) })) //Devuelve el mockCollection que falsifica las funciones de una coleccion de mongo
        }));
        
        (fs.writeFileSync as any) = vi.fn();
    });

    it('deberia insertar los datos nuevos sin errores', async () => {
        await main();
        expect(mockCollection.insertOne).toHaveBeenCalled();
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('deberia de registrar el error si ya existe', async () => {
        mockCollection.findOne = vi.fn(() => ({ _id: 'abc123' })); 
        await main();
        expect(fs.writeFileSync).toHaveBeenCalledWith('migration-errors.json', expect.anything());
    });

})

