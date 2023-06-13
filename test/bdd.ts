import { assert } from 'chai';
import { idbOpen, idbDelete } from '../src';
// (window as any).idbOpen = idbOpen;
// (window as any).idbOpen = idbDelete;
const log = function (...arg) {};
// const log = console.log.bind(console, '[mocha]');

async function getAllDB() {
    return window.indexedDB.databases();
}

async function clearAllDB() {
    let dbs = await getAllDB();
    for (let db of dbs) {
        idbDelete(db.name);
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

describe('idbOpen 报错处理', () => {
    beforeEach(async () => {
        log('beforeEach');
        await clearAllDB();
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
            log('err', e);
            assert(true);
        }
    });
    it(`upgradeneeded 参数缺失`, async () => {
        const dbName = 'db2';
        try {
            await idbOpen(dbName, {
                store: (db) => {
                    return db.objectStoreNames.contains('storeXX');
                }
            });
        } catch (e) {
            // log('err', e);
            assert(true);
        }
    });

    it(`option.store 报错处理`, async () => {
        const dbName = 'db2',
            store = 'store3';
        try {
            // debugger;
            await idbOpen(dbName, {
                store: (db) => {
                    // return db.objectStoreNames.contains(store);
                    throw 'err';
                },
                upgradeneeded(db, event) {
                    db.createObjectStore(store);
                },
            });
        } catch (e) {
            log('err', e);
            assert.equal(e, 'err');
        }
    });
    it(`option.store 现在db的情况下报错`, async () => {
        const dbName = 'db2',
            store = 'store3';
        await idbOpen(dbName, {store: store});
        try {
            await idbOpen(dbName, {
                store: (db) => {
                    throw 'err';
                },
                upgradeneeded(db, event) {
                    db.createObjectStore(store);
                },
            });
        } catch (e) {
            log('err', e);
            assert.equal(e, 'err');
        }
    });
    it(`option.upgradeneeded 报错处理`, async () => {
        const dbName = 'db2',
            store = 'store3';
        try {
            await idbOpen(dbName, {
                store: (db) => {
                    log('aaa11111');
                    return db.objectStoreNames.contains(store);
                },
                upgradeneeded(db, event) {
                    throw 'err123';
                },
            });
        } catch (e) {
            log('err', e);
            assert.equal(e, 'err123');
        }
    });
});

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
        // assert.fail('故意出错！');
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
            const db1store1 = () => idbOpen('db1', { store: 'store1' });
            const db1store2 = () => idbOpen('db1', { store: 'store2' });
            const db = await db1store1();
            assert.isTrue(hasStore('store1', db));
            const ds = db.transaction('store1', 'readwrite').objectStore('store1')
            ds.put({abc:1});
            db.close();
            const db1 = await db1store2();
            assert.isTrue(hasStore(['store1', 'store2'], db1));
            assert.isTrue(hasStore(['store1', 'store2'], await db1store1()));
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
    });
});
