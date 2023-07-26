import { openDB, wrap, unwrap } from 'idb';
// import { idbOpen, idbDelete } from 'idb-open';
const { idbOpen, idbDelete } = window.idbOpen;
class OsCmd1 {
    constructor(dbName, store) {
        this.options = {
            dbName,
            store,
        };
        this.open = () => idbOpen(dbName, { store });
    }
    getos = async (module = "readwrite") => {
        let { store } = this.options;
        const db = await this.open();
        return db.transaction(store, module).objectStore(store);
    };
    get = (id) => {
        return this.getos("readonly").then((os) => {
            return new Promise((resolve, reject) => {
                let request = os.get(id);
                request.onerror = reject;
                request.onsuccess = () => resolve(request.result);
            });
        });
    };
    set = (data, id) => {
        return this.getos("readwrite").then((os) => {
            return new Promise((resolve, reject) => {
                let request = os.put(data, id);
                request.onerror = reject;
                request.onsuccess = () => resolve();
            });
        });
    };
}

class OsCmd {
    constructor(dbName, store) {
        this.options = {
            dbName,
            store,
        };
        this.open = () => idbOpen(dbName, { store });
    }
    getDB = async () => {
        const db = await this.open();
        return wrap(db);
    };
    get = (id) => {
        return this.getDB().then((db) => db.get(this.options.store, id));
    };
    set = (value, id) => {
        return this.getDB().then((db) => db.put(this.options.store, value, id));
    };
}

class IndexOsCmd {
    dbName = "db1";
    store = "my-store";
    upgradeneeded = (db) => {
        if (!db.objectStoreNames.contains("my-store")) {
            var objectStore = db.createObjectStore("my-store", {
                keyPath: "id",
            });
        }
    };
    constructor() {
        this.open = () =>
            idbOpen(this.dbName, {
                store: this.store,
                upgradeneeded: this.upgradeneeded,
            });
    }
    getDB = async () => {
        const db = await this.open();
        return wrap(db);
        // return db;
    };
    get = async (id) => {
        let db = await this.getDB();
        return db.get("my-store", id);
    };
    set = async (obj) => {
        let db = await this.getDB();
        return db.put("my-store", obj);
    };
}

class IndexOsCmd1 {
    dbName = "db1";
    store = function (db, tc) {
        if (!db.objectStoreNames.contains("my-store")) {
            return false;
        }
        var transaction = tc || db.transaction("my-store", "readwrite");
        var myStore = transaction.objectStore("my-store");
        if (!myStore.indexNames.contains("idx_name")) {
            return false;
        }
        return true;
    };
    upgradeneeded = function (db, transaction) {
        if (!db.objectStoreNames.contains("my-store")) {
            db.createObjectStore("my-store", { keyPath: "id" });
        }
        var myStore = transaction.objectStore("my-store");
        myStore.createIndex("idx_name", "index_this", { unique: false });
    };
    constructor() {
        this.open = () =>
            idbOpen(this.dbName, {
                store: this.store,
                upgradeneeded: this.upgradeneeded,
            });
    }
    getDB = async () => {
        const db = await this.open();
        return wrap(db);
        // return db;
    };
    get = async (id) => {
        let db = await this.getDB();
        return db.get("my-store", id);
    };
    set = async (obj) => {
        let db = await this.getDB();
        return db.put("my-store", obj);
    };
}

async function main() {
    await idbDelete("db1");
    const cmd1 = new OsCmd("db1", "os1");
    const cmd2 = new OsCmd("db1", "os2");
    Promise.all([cmd1.get("key"), cmd2.get("key")]).then(console.log);
    cmd1.set(["cmd1"], "key");
    cmd2.set(["cmd2"], "key");
    // console.log(await cmd1.get('key'));
    console.log("1111", await cmd2.get("key"));
    let db = unwrap(await cmd2.getDB());
    console.log(db);
    // db.close();
    await new Promise((resolve, reject) => {
        setTimeout(resolve, 2000);
    });

    await cmd2.set([3333], "key2");
    console.log(await cmd2.get("key2"));
    await cmd1.set([4444], "key2");
    console.log(await cmd1.get("key2"));

    // console.log((await cmd1.open()) === (await cmd2.open()));

    await idbDelete("db1");
    console.log("cmd1>key", await cmd1.get("key"));
    console.log("cmd2>key", await cmd2.get("key"));
    console.log("main end");
}

async function main1() {
    await idbDelete("db1");
    // const cmd = new IndexOsCmd();
    // console.log(await cmd.getDB());
    // cmd.set({ id: 'id', index_this: 'val' });
    // console.log(await cmd.get('id'));
    // try {
    //     const cmd1 = new IndexOsCmd1();
    //     await cmd1.set({ id: 'id1', index_this: 'val1' });
    //     console.log(await cmd1.get('id1'));
    // } catch (e) {
    //     console.log(e);
    // }
    // console.log(await cmd.get('id'));
    const cmd = new IndexOsCmd();
    let k1 = cmd.set({ id: "id", index_this: "val" });
    const cmd1 = new IndexOsCmd1();
    let C1 = cmd1.get("id");
    let k2 = cmd.set({ id: "id1", index_this: "val1" });
    let k3 = cmd.set({ id: "id2", index_this: "val2" });
    console.log(await C1);
    await k1;
    await k2;
    await k3;
    console.log(await cmd1.get("id2"));
    console.log(await idbOpen("dbdbdb1"));
    console.log("main1 end");
}

class Friended {
    dbName = "db1";
    store = "my-friend";
    indexes = "++,name";
    constructor(indexes) {
        this.open = () => {
            const [primary, ...other] = (indexes || this.indexes).split(",");
            const store = this.store;
            return idbOpen(this.dbName, {
                // store: {
                //     [this.store]: indexes || this.indexes,
                // },
                store: `${this.store}|${indexes || this.indexes}`,
                // store: (db, transaction) => {
                //     if (!db.objectStoreNames.contains(store)) {
                //         return function () {
                //             const name = primary.replace(/\+\+/g, "");
                //             const options = {
                //                 autoIncrement: /^\+\+/.test(primary),
                //             };
                //             if (name) options.keyPath = name;
                //             const ost = db.createObjectStore(store, options);
                //             other.forEach((idx) => {
                //                 ost.createIndex(idx, idx, {
                //                     unique: false,
                //                     multiEntry: true,
                //                 });
                //             });
                //         };
                //     } else {
                //         function updateIndex() {
                //             let ost = transaction.objectStore(store);
                //             let indexNames = [...ost.indexNames];
                //             other.forEach((idx) => {
                //                 if (!indexNames.includes(idx)) {
                //                     ost.createIndex(idx, idx, {
                //                         unique: false,
                //                         multiEntry: true,
                //                     });
                //                 }
                //             });
                //         }
                //         let ost = transaction.objectStore(store);
                //         let indexNames = [...ost.indexNames];
                //         // if(other)
                //         let useUp = other.some(idx=>{
                //             return !indexNames.includes(idx);
                //         })
                //         if(useUp) return updateIndex;
                //     }
                // },
            });
        };
    }
    getDB = async () => {
        const db = await this.open();
        return wrap(db);
        // return db;
    };
    get = async (id) => {
        let db = await this.getDB();
        return db.get(this.store, id);
    };
    set = async (obj) => {
        let db = await this.getDB();
        return db.put(this.store, obj);
    };
    find = async (name) => {
        let db = await this.getDB();
        return db
            .transaction(this.store)
            .objectStore(this.store)
            .index("name")
            .getAll(IDBKeyRange.only(name));
    };
    getAll = async (name) => {
        let db = await this.getDB();
        return db.getAll(this.store);
    };
}

async function main2() {
    try {
        await idbDelete("db1");
        let f1 = new Friended();
        await f1.set({ name: "why" });
        console.log(await f1.getAll());
        await f1.set({ name: "why1" });
        await f1.set({ name: "why" });
        await f1.set({ name: "why" });
        let f2 = new Friended("++,name,sex");
        await f2.set({ name: "why", sex: 1 });
        console.log("f2 all", await f2.getAll());
        console.log("f1 all", await f1.getAll());
        console.log("f1 why", await f1.find("why"));
        console.log("f2 why", await f2.find("why"));
        let f3 = new Friended("++,old");
        await f3.set({ name: "why", old: 36 });
        console.log("f3 why", await f3.getAll());
        console.log("f3 why", await f3.find("why"));
    } catch (e) {
        console.error(e);
    }
}
await main2();
// console.log(await idbOpen('dbdbdb1'))
// await main();
// await main1();
