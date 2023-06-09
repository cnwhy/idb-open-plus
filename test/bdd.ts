import { assert } from 'chai';
import { idbOpen, idbDelete } from '../src';
const log = function (...arg) {};
// const log = console.log.bind(console, "[mocha]");

async function getAllDB() {
    return window.indexedDB.databases();
}

async function clearAllDB() {
    let dbs = await getAllDB();
    for (let db of dbs) {
        await idbDelete(db.name);
    }
    log('数据库已清理!');
}

async function hasDB(...name) {
    let dbs = await getAllDB();
    let names = dbs.map((db) => db.name);
    if (Array.isArray(name)) {
        return name.map((n) => names.includes(n)).every((v) => v);
    }
    return names.includes(name);
}

function hasStore(name, db) {
    const stores = db.objectStoreNames;
    if (Array.isArray(name)) {
        return name.map((n) => stores.contains(n)).every((v) => v);
    }
    log(stores, stores.contains(name));
    return stores.contains(name);
}

describe('简易用法 创建，删除数据库', () => {
    const dbName = '53f87445-4dac-4bf5-86bd-8afcb6657f2f';
    before(async () => {
        // log('before');
        await clearAllDB();
    });
    // after(async () => {
    //     log('after');
    // });
    // beforeEach(async () => {
    //     log('beforeEach');
    // });
    // afterEach(async () => {
    //     log('afterEach');
    // });
    it(`数据库清理`, async () => {
        let dbs = await getAllDB();
        assert.equal(dbs.length, 0);
    });

    it(`idbOpen创建 数据库`, async () => {
        await idbOpen(dbName);
        assert.isTrue(await hasDB(dbName));
        assert.fail("故意出错！");
    });

    it(`idbDelete删除 数据库`, async () => {
        await idbDelete(dbName);
        assert.notOk(await hasDB(dbName));
    });
});

describe('idbOpen', () => {
    beforeEach(async () => {
        log('beforeEach');
        await clearAllDB();
    });
    // afterEach(async () => {
    //     log('afterEach');
    // });
    describe(`idbOpen(string)`, () => {
        it(`idbOpen(string)`, async () => {
            let db = await idbOpen('test1');
            assert.isTrue(!!db.version);
        });
        [undefined, null, 1, NaN].map((name: any) => {
            it(`idbOpen(string) 参数错误 - ${name}`, async () => {
                try {
                    await idbOpen(name);
                    assert.fail();
                } catch (e) {
                    assert.instanceOf(e, TypeError);
                }
            });
        });
    });

    describe('idbOpen 高阶用法', () => {
        it(`自动创建对像表 option: {store: string}`, async () => {
            const db = await idbOpen('db1', { store: 'store1' });
            assert.isTrue(hasStore('store1', db));
        });

        it(`自定义创建对像表 option: {store: string, upgradeneeded: (db) => void}`, async () => {
            const db = await idbOpen('db2', {
                store: 'store1',
                upgradeneeded(db, event) {
                    db.createObjectStore('store1');
                },
            });
            assert.isTrue(hasStore('store1', db));
        });

        it(`自定义检测数据库并自定义创建对像表 option: {store: (db) => void, upgradeneeded: (db) => void}`, async () => {
            const dbName = 'db2',
                stores = ['store1', 'store2'];
            const db = await idbOpen(dbName, {
                store: (db, ts) => {
                    const names = [...db.objectStoreNames];
                    // return hasDB(...stores);
                    return stores.every((name) => names.includes(name));
                },
                upgradeneeded(db, event) {
                    stores.forEach((store) => {
                        db.createObjectStore(store, { autoIncrement: true });
                    });
                },
            });
            assert.isTrue(hasStore(stores, db));
        });

        it(`upgradeneeded,store 相悖检测`, async () => {
            const dbName = 'db2';
            try {
                await idbOpen(dbName, {
                    store: (db) => {
                        return db.objectStoreNames.contains('storeXX');
                    },
                    upgradeneeded(db, event) {
                        db.createObjectStore('storeX');
                    },
                });
            } catch (e) {
                assert(true);
            }
        });
        // it(`option.store 报错处理`, async () => {
        //     const dbName = 'db2',
        //         store = 'store3';
        //     const db = await idbOpen(dbName, {
        //         store: (db) => {
        //             // return db.objectStoreNames.contains(store);
        //             throw 'err';
        //         },
        //         upgradeneeded(db, event) {
        //             db.createObjectStore(store);
        //         },
        //     }).catch((e) => {
        //         log(e);
        //         assert(true);
        //     });
        // });
        // it(`option.upgradeneeded 报错处理`, (done) => {
        //     const dbName = 'db2',
        //         store = 'store3';
        //     idbOpen(dbName, {
        //         store: (db) => {
        //             log('aaa11111');
        //             return db.objectStoreNames.contains(store);
        //         },
        //         upgradeneeded(db, event) {
        //             throw 'err123';
        //         },
        //     }).catch((e) => {
        //         log(e);
        //         done();
        //     });
        // });
    });
});
