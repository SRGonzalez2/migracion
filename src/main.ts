import { MongoClient } from "mongodb";
import config from "./config.json";
import fs from 'fs';

interface ErrorLog {
    error: string,
    date: Date
}

export async function main() {

    const cliente = new MongoClient(config.mongoUri);

    try {
        await cliente.connect();
        console.log(`Cliente conectado`);
        

        const source = cliente.db(config.sourceDb).collection(config.sourceCollection);
        const target = cliente.db(config.targetDb).collection(config.targetCollection);

        const cursor = await source.find();
        const errores: ErrorLog[] = [];
        let insertedCount = 0;

        console.log(`Comenzando migración...`);
        for await (const elemento of cursor) {
            try {
                
                const exists = await target.findOne({_id: elemento?._id}, {projection: {_id: 1}})
                if(exists) {
                    throw new Error(`El elemento ${JSON.stringify(elemento, null, 1)} ya existe.`);
                }
    
                if(!elemento.updatedAt) {
                    elemento.updatedAt = new Date();
                }

                await target.insertOne(elemento);
                console.log(`Elemento ${elemento._id} insertado`);
                insertedCount++;
            } catch (error) {
                if(error instanceof Error) {
                    errores.push({'error': error.message, 'date': new Date()});
                }
                continue;
            }
        }

        await cursor.close();
        console.log(`Migración completada, se han insertado ${insertedCount} elementos.`);

        if(errores.length > 0) {
            fs.writeFileSync(config.migrationErrorLog, JSON.stringify(errores, null, 2));
        }
        
        polling(source, target)
    } catch (error) {
        console.error("Error al conectar a MongoDB: ", error)
    }
}

export async function polling(source: any, target: any) {

    let syncDate = new Date();

    setInterval(async () => {
        console.log(`Comenzando polling, fecha de sincronizacion: ${syncDate}`);
        const currentSync = new Date();
        const errores: ErrorLog[] = []

        try {
            const modifieds = await source.find({updatedAt: {$gte: syncDate}}).sort({updatedAt: 1, _id: 1});
            let cantidadModificados = 0;
            
            for await (const element of modifieds) {
                try {
                    const result = await target.replaceOne({_id: element._id}, element, {upsert: true});
                    cantidadModificados += result.modifiedCount += result.upsertedCount;
                } catch (error) {
                    console.error("Se ha producido un error al sincronizar: ", error);
                    if (error instanceof Error) {
                        errores.push({ error: error.message, date: new Date() });
                    }
                }
            }  

            console.log(`Sincronizacion completada, se han sincronizado ${cantidadModificados} elemento(s).`);
        } catch (error) {
            if(error instanceof Error) {
                console.error("Error durante el polling: ", error);
                errores.push({ error: error.message, date: new Date() });
            }
        }

        if(errores.length > 0) {
            fs.writeFileSync(config.syncErrorLog, JSON.stringify(errores, null, 2));
        }
        syncDate = currentSync;

    }, 5000)

}

main();