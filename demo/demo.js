import { openDB, wrap, unwrap } from "idb";
import idbOpen from "../";
import { idbDelete } from "../";

// const { idbOpen, idbDelete } = window.idbOpenPlush;

// window.idbOpen = idbOpen;

/**
 * 实现给我和简单人kv库
 */
class IdbKV {
    constructor(dbName, storeName) {
        this.options = {
            dbName,
            store: storeName,
        };
        this.open = () => idbOpen(dbName, { store: storeName, incrementalUpdate: 'onlyStore'  });
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

/**
 * 搭配 idb 库使用变得更丝滑
 */
class IdbKV1 {
    constructor(dbName, storeName) {
        this.options = {
            dbName,
            store: storeName,
        };
        this.open = () => idbOpen(dbName, { store: storeName });
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
    storeName = "my-store";
    store = "my-store|id,sex";
    constructor() {
        this.open = () => {
            console.log('[store]', this.store);
            return idbOpen(this.dbName, {
                store: this.store,
                // incrementalUpdate: 'onlyStore'
                // incrementalUpdate: 'onlyIndex'
                // incrementalUpdate: true,
                incrementalUpdate: false,
            });
        }
    }
    // getDB = async () => {
    //     const db = await this.open();
    //     return wrap(db);
    //     // return db;
    // };
    // get = async (id) => {
    //     let db = await this.getDB();
    //     return db.get("my-store", id);
    // };
    // set = async (obj) => {
    //     let db = await this.getDB();
    //     return db.put("my-store", obj);
    // };
    getos = async (module = "readwrite") => {
        // let { store } = this.options;
        let store = this.storeName;
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

class IndexOsCmd1 extends IndexOsCmd {
    storeName = "my-store1";
    // store = this.storeName + "|id,name";
    store = {
        'my-store' : 'id,name',
        'my-store1' : 'id,name'
    }
    constructor() {
        super();
    }
    findAll = async (name) => {
        let db = await this.getDB();
        return db.getAllFromIndex("my-store", "name", IDBKeyRange.only(name));
    };
}

async function demo1() {
    await idbDelete("db1");
    const cmd1 = new IdbKV("db1", "os1");
    const cmd2 = new IdbKV("db1", "os2");
    Promise.all([cmd1.get("key"), cmd2.get("key")]).then(console.log);
    await cmd1.set(["cmd1"], "key");
    await cmd2.set(["cmd2"], "key");
    // console.log(await cmd1.get('key'));
    Promise.all([cmd1.get("key"), cmd2.get("key")]).then(console.log);
    // db.close();
    await new Promise((resolve, reject) => {
        setTimeout(resolve, 2000);
    });
    
    Promise.all([cmd1.get("key"), cmd2.get("key")]).then(console.log);
    return;
    
    await cmd2.set([3333], "key2");
    console.log(await cmd2.get("key2"));
    await cmd1.set([4444], "key2");
    console.log(await cmd1.get("key2"));

    // console.log((await cmd1.open()) === (await cmd2.open()));

    await idbDelete("db1");
    console.log("cmd1>key", await cmd1.get("key"));
    console.log("cmd2>key", await cmd2.get("key"));
    console.log("demo1 end");
}

async function demo2() {
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
    const cmd1 = new IndexOsCmd1();
    
    await cmd.set({ id: "id", name: "val" });
    console.log(await cmd.get("id"));
    let C1 = await cmd1.get("id");
    let C2 = await cmd.get("id");
    console.log(C1);
    console.log(C2);
    return;
    await cmd.set({ id: "id1", name: "val1" });
    await cmd.set({ id: "id2", name: "val2" });
    console.log(await cmd1.findAll("val2"));
    console.log(await cmd1.get("id2"));
    await cmd.set({ id: "id3", name: "val2" });
    console.log(await cmd1.findAll("val2"));
    console.log("demo2 end");
}

// await demo1();
await demo2();
