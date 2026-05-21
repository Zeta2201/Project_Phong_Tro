const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const { ObjectId } = mongoose.Types;

const refMigrations = [
    { collection: 'posts', fields: ['userId'] },
    { collection: 'favourites', fields: ['userId', 'postId'] },
    { collection: 'apikeys', fields: ['userId'] },
    { collection: 'messagers', fields: ['senderId', 'receiverId'] },
    { collection: 'rechargeusers', fields: ['userId'] },
];

const toObjectId = (value) => {
    if (value instanceof ObjectId) {
        return value;
    }

    if (typeof value === 'string' && ObjectId.isValid(value)) {
        return new ObjectId(value);
    }

    return null;
};

async function migrateCollection(db, { collection, fields }) {
    const docs = await db.collection(collection).find({}).toArray();
    const operations = [];

    for (const doc of docs) {
        const update = {};

        for (const field of fields) {
            const nextValue = toObjectId(doc[field]);
            if (nextValue && !(doc[field] instanceof ObjectId)) {
                update[field] = nextValue;
            }
        }

        if (Object.keys(update).length > 0) {
            operations.push({
                updateOne: {
                    filter: { _id: doc._id },
                    update: { $set: update },
                },
            });
        }
    }

    if (operations.length === 0) {
        console.log(`[skip] ${collection}: no documents needed migration`);
        return;
    }

    const result = await db.collection(collection).bulkWrite(operations);
    console.log(`[done] ${collection}: modified ${result.modifiedCount} documents`);
}

async function main() {
    if (!process.env.CONNECT_DB) {
        throw new Error('CONNECT_DB is missing');
    }

    await mongoose.connect(process.env.CONNECT_DB);
    const db = mongoose.connection.db;

    for (const config of refMigrations) {
        await migrateCollection(db, config);
    }

    await mongoose.disconnect();
    console.log('ObjectId reference migration completed');
}

main().catch(async (error) => {
    console.error(error);
    try {
        await mongoose.disconnect();
    } catch {}
    process.exit(1);
});
