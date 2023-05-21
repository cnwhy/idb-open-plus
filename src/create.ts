export type InitOptions = {
    /** 存储库名称 或者用于检测是否需要更新数据数的函数,返回 true 则不新, 否则执行 upgradeneeded */
    store?: string | ((db: IDBDatabase, ts?: IDBTransaction) => boolean);
    /**
     * 更新数据库
     * @param db IDBDatabase
     * @param event onupgradeneeded的事件对像
     */
    upgradeneeded?: (
        this: IDBOpenDBRequest,
        db: IDBDatabase,
        tc: IDBTransaction,
        event: IDBVersionChangeEvent
    ) => void;
};

export default function create(global: Window) {
    const dbMap = new Map();

    /**
     * 打开指定indexedDb数据库
     * @param dbName 库名
     * @param options 初始化参数
     * @returns Promise<IDBDatabase>
     */
    const idbOpen: (
        /** */
        dbName: string,
        options?: InitOptions
    ) => Promise<IDBDatabase> = async (
        dbName,
        { store, upgradeneeded } = {}
    ) => {
        if (!dbName || typeof dbName !== "string") {
            return Promise.reject(new TypeError("dbName must be a string"));
        }

        // if (!version) {
        let db = dbMap.get(dbName);
        if (db) {
            try {
                return dbTest(await db);
            } catch (e) {
                return Promise.reject(e);
            }
        }
        let p = open();
        dbMap.set(dbName, p);
        return p;
        // }

        function upgradeneededTest(
            this: any,
            db: IDBDatabase,
            ts?: IDBTransaction
        ) {
            switch (typeof store) {
                case "string": {
                    let has = db.objectStoreNames.contains(store);
                    // has || console.log(`未找到名称为${store}的ObjectStore`);
                    return has;
                }
                case "function": {
                    return (
                        store as (
                            db: IDBDatabase,
                            ts?: IDBTransaction
                        ) => boolean
                    ).call(this, db, ts);
                }
                default:
                    return true;
            }
        }

        function dbTest(db: IDBDatabase) {
            if (
                upgradeneededTest(
                    db,
                    db.objectStoreNames.length
                        ? db.transaction([...db.objectStoreNames], "readonly")
                        : null
                )
            ) {
                return Promise.resolve(db);
            } else {
                let v = (db.version || 1) + 1;
                return open(v);
                // return idbOpen(dbName, { store, version: v, upgradeneeded });
            }
        }

        function open(version?) {
            return new Promise<IDBDatabase>((resolve, reject) => {
                let request = global.indexedDB.open(dbName, version);
                // 请求数据库失败的回调函数
                request.onerror = function (_event) {
                    console.log("打开数据库失败,错误信息为:", this.error);
                    reject(this.error);
                };
                let iserror = false;
                //版本更新的时候或者第一次打开数据库的时候
                request.onupgradeneeded = function (event) {
                    console.log("进入 onupgradeneeded", request);
                    try {
                        const db = this.result;
                        const transaction = this.transaction;
                        if (typeof upgradeneeded === "function") {
                            upgradeneeded.call(this, db, transaction, event);
                            if (
                                !upgradeneededTest.call(this, db, transaction)
                            ) {
                                throw new Error(
                                    `虽然已经执行了 upgradeneeded 更新数据库，但仍未通过 store 的检测`
                                );
                            }
                        } else if (typeof store === "string") {
                            if (!db.objectStoreNames.contains(store)) {
                                db.createObjectStore(store, {
                                    autoIncrement: true, //自动生成主键
                                });
                                console.log("成功创建数据的ObjectStore", store);
                            }
                        } else {
                            if (
                                !upgradeneededTest.call(this, db, transaction)
                            ) {
                                throw new TypeError("缺少 upgradeneeded 参数");
                            }
                        }
                    } catch (e) {
                        iserror = true;
                        reject(e);
                    }
                };
                // 请求数据库成功的回调函数
                request.onsuccess = function (_event) {
                    if (iserror) return;
                    console.log("onsuccess:", request.transaction);
                    const db = this.result;
                    dbMap.set(dbName, db);
                    resolve(dbTest(db));
                    db.onversionchange = function () {
                        console.log("onversionchange");
                        db.close();
                        dbMap.delete(dbName);
                    };
                    db.onclose = function () {
                        console.log("onclose");
                        dbMap.delete(dbName);
                    };
                };
                request.onblocked = function (_event) {
                    // console.log('onblocked');
                    let db = dbMap.get(dbName);
                    if (db) db?.close?.();
                };
            });
        }
    };

    const idbDelete = (dbName: string) => {
        return new Promise((resolve, reject) => {
            let request = global.indexedDB.deleteDatabase(dbName);
            // 请求数据库失败的回调函数
            request.onerror = function (err) {
                console.log("删除数据库失败,错误信息为:", err);
                reject(err);
            };
            // 请求数据库成功的回调函数
            request.onsuccess = function (_event) {
                console.log("删除数据库成功");
                dbMap.delete(dbName);
                resolve(null);
            };
            request.onblocked = function (_event) {
                console.log("上一次的数据库未关闭");
                let db = dbMap.get(dbName);
                if (db) db.close();
            };
        });
    };
    return { idbOpen, idbDelete };
}