import { assert } from "chai";
import { idbOpen, idbDelete } from "../src";
// const { idbOpen, idbDelete } = (window as any).idbOpenPlus;
// (window as any).idbOpen = idbOpen;
// (window as any).idbDelete = idbDelete;
const log = function (...arg) {};
// const log = console.log.bind(console, '[mocha]');

async function getAllDB() {
    return window.indexedDB.databases();
}

async function clearAllDB() {
    let dbs = await getAllDB();
    for (let db of dbs) {
        if(db.name){
            await idbDelete(db.name);
        } 
    }
    log("数据库已清理!");
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

describe("idbOpen 报错处理", () => {
    beforeEach(async () => {
        log("beforeEach");
        await clearAllDB();
    });
    it(`upgradeneeded,store 相悖检测`, async () => {
        const dbName = "db2";
        try {
            await idbOpen(dbName, {
                store: (db, t) => {
                    if (db.objectStoreNames.contains("storeXX")) return;
                    return (db, t, event) => {
                        if (!db.objectStoreNames.contains("storeX")) {
                            db.createObjectStore("storeX");
                        }
                    };
                },
            });
        } catch (e) {
            log("err", e);
            assert(true);
        }
    });
    it(`option.store 报错处理`, async () => {
        const dbName = "db2",
            store = "store3";
        try {
            // debugger;
            await idbOpen(dbName, {
                store: (db) => {
                    // return db.objectStoreNames.contains(store);
                    throw "err";
                },
            });
        } catch (e) {
            log("err", e);
            assert.equal(e, "err");
        }
    });
    it(`option.store 自定义的情况下报错`, async () => {
        const dbName = "db2",
            store = "store3";
        await idbOpen(dbName, { store: store });
        try {
            await idbOpen(dbName, {
                store: (db) => {
                    throw "err";
                },
            });
        } catch (e) {
            log("err", e);
            assert.equal(e, "err");
        }
    });
    it(`option.upgradeneeded 报错处理`, async () => {
        const dbName = "db2",
            store = "store3";
        try {
            await idbOpen(dbName, {
                store: (db) => {
                    log("aaa11111");
                    if (db.objectStoreNames.contains(store)) return;
                    return (db, tf, event) => {
                        throw "err123";
                    };
                },
            });
        } catch (e) {
            log("err", e);
            assert.equal(e, "err123");
        }
    });
    it(`更新对像表主键报错`, async () => {
        await idbOpen('db1',{store:'store1|++,name'})
        try{
            await idbOpen('db1',{store:'store1|++id,name'})
        } catch (e) {
            log("err", e);
            assert(true);
        }

    })
});

describe("简易用法 创建，删除数据库", () => {
    const dbName = "53f87445-4dac-4bf5-86bd-8afcb6657f2f";
    // before(async () => {
    //     log('before');
    //     // let dbs = await getAllDB();
    //     // console.log('[dbs]', dbs);
    //     console.log('before');
    //     await clearAllDB(1);
    // });
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
        await idbOpen(dbName);
        let dbs = await getAllDB();
        assert(dbs.length > 0);
        await clearAllDB();
        dbs = await getAllDB();
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

describe("idbOpen", () => {
    beforeEach(async () => {
        log("beforeEach");
        await clearAllDB();
    });
    // afterEach(async () => {
    //     log('afterEach');
    // });
    describe(`idbOpen(string)`, () => {
        it(`idbOpen(string)`, async () => {
            let db = await idbOpen("test1");
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

    describe("idbOpen 高阶用法", () => {
        it(`约定式创建对像表 option: {store: string}`, async () => {
            const db1store1 = () => idbOpen("db1", { store: "store1" });
            const db1store2 = () => idbOpen("db1", { store: "store2" });
            const db = await db1store1();
            assert.isTrue(hasStore("store1", db));
            const ds = db
                .transaction("store1", "readwrite")
                .objectStore("store1");
            ds.put({ abc: 1 });
            db.close();
            const db1 = await db1store2();
            assert.isTrue(hasStore(["store1", "store2"], db1));
            assert.isTrue(hasStore(["store1", "store2"], await db1store1()));
        });
        it(`约定式创建对像表及索引 option: {store: string}`, async () => {
            const db = await idbOpen("db1", { store: "store3|++id,name,&a,*b,[c+d]" });
            const tr = db.transaction(db.objectStoreNames, "readonly");
            const s3 = tr.objectStore("store3");
            assert.equal(s3.keyPath, "id");
            assert.equal(s3.indexNames.length, 4);
            assert.deepInclude(s3.index('name'),{name:'name',keyPath:'name',multiEntry:false,unique:false})
            assert.deepInclude(s3.index('a'),{name:'a',keyPath:'a',multiEntry:false,unique:true})
            assert.deepInclude(s3.index('b'),{name:'b',keyPath:'b',multiEntry:true,unique:false})
            assert.deepInclude(s3.index('[c+d]'),{name:'[c+d]',keyPath:['c','d'],multiEntry:false,unique:false})
        });
        it(`约定式创建多个对像表 option: {store: object}`, async () => {
            const db = await idbOpen("db2", {
                store: {
                    store3: "",
                    store4: "",
                },
            });
            assert.isTrue(hasStore(["store3", "store4"], db));
        });
        it(`约定式创建多个对像表及索引 option: {store: object}`, async () => {
            const db = await idbOpen("db2", {
                store: {
                    store5: "++,name",
                    store6: "++id,name,&a,*b,[c+d]",
                },
            });
            assert.isTrue(hasStore(["store5", "store6"], db));
            const tr = db.transaction(db.objectStoreNames, "readonly");
            const s5 = tr.objectStore("store5");
            assert.equal(s5.keyPath, null);
            assert.equal(s5.indexNames.length, 1);
            assert.deepInclude(s5.index('name'),{name:'name',keyPath:'name',multiEntry:false,unique:false})
            const s6 = tr.objectStore("store6");
            assert.equal(s6.keyPath, "id");
            assert.equal(s6.indexNames.length, 4);
            assert.deepInclude(s6.index('name'),{name:'name',keyPath:'name',multiEntry:false,unique:false})
            assert.deepInclude(s6.index('a'),{name:'a',keyPath:'a',multiEntry:false,unique:true})
            assert.deepInclude(s6.index('b'),{name:'b',keyPath:'b',multiEntry:true,unique:false})
            assert.deepInclude(s6.index('[c+d]'),{name:'[c+d]',keyPath:['c','d'],multiEntry:false,unique:false})
        });
        
        it(`约定非增量更新测试`, async () => {
            const db = await idbOpen("db1", { store: "store3|++id,name", incrementalUpdate: false });
            let s3 = db.transaction(db.objectStoreNames, "readonly").objectStore("store3");
            assert.equal(s3.keyPath, "id");
            assert.equal(s3.indexNames.length, 1);
            assert.deepInclude(s3.index('name'),{name:'name',keyPath:'name',multiEntry:false,unique:false})

            const db1 = await idbOpen("db1", { store: "store3|++id,&a,*b,[c+d]", incrementalUpdate: false });
            s3 = db1.transaction(db.objectStoreNames, "readonly").objectStore("store3");
            assert.equal(s3.indexNames.length, 3);
            assert.deepInclude(s3.index('a'),{name:'a',keyPath:'a',multiEntry:false,unique:true})
            assert.deepInclude(s3.index('b'),{name:'b',keyPath:'b',multiEntry:true,unique:false})
            assert.deepInclude(s3.index('[c+d]'),{name:'[c+d]',keyPath:['c','d'],multiEntry:false,unique:false})
        });
        it(`约定非增量更新测试 多对像表`, async () => {
            const db = await idbOpen("db1", { store: {
                store1: '++',
                store2: '++',
                store3: "++id,name"
            }, incrementalUpdate: false });
            assert.equal(db.objectStoreNames.length, 3);
            let s3 = db.transaction(db.objectStoreNames, "readonly").objectStore("store3");
            assert.equal(s3.keyPath, "id");
            assert.equal(s3.indexNames.length, 1);
            assert.deepInclude(s3.index('name'),{name:'name',keyPath:'name',multiEntry:false,unique:false})
            
            const db1 = await idbOpen("db1", { store: "store3|++id,*name,&a,*b,[c+d]", incrementalUpdate: false });
            assert.equal(db1.objectStoreNames.length, 1);
            s3 = db1.transaction(db1.objectStoreNames, "readonly").objectStore("store3");
            assert.equal(s3.indexNames.length, 4);
            assert.deepInclude(s3.index('name'),{name:'name',keyPath:'name',multiEntry:true,unique:false})
            assert.deepInclude(s3.index('a'),{name:'a',keyPath:'a',multiEntry:false,unique:true})
            assert.deepInclude(s3.index('b'),{name:'b',keyPath:'b',multiEntry:true,unique:false})
            assert.deepInclude(s3.index('[c+d]'),{name:'[c+d]',keyPath:['c','d'],multiEntry:false,unique:false})
        });

        it(`手动创建对像表 option: {store: Function}`, async () => {
            const dbName = "db2",
                stores = ["store1", "store2"];
            const db = await idbOpen(dbName, {
                store: (db, ts) => {
                    const names = [...db.objectStoreNames];
                    // return hasDB(...stores);
                    if (stores.every((name) => names.includes(name))) return;
                    return (db, ts, event) => {
                        stores.forEach((store) => {
                            if(db.objectStoreNames.contains(store)) return;
                            db.createObjectStore(store, {
                                autoIncrement: true,
                            });
                        });
                    };
                },
            });
            assert.isTrue(hasStore(stores, db));
        });


    });
});
