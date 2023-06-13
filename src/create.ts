export type InitOptions = {
    /** 存储库名称 或者用于检测是否需要更新数据数的函数,返回 true 则不更新, 否则执行 upgradeneeded */
    store?: string | ((db: IDBDatabase, itc?: IDBTransaction) => boolean);
    /**
     * 更新数据库
     * @param db IDBDatabase
     * @param event onupgradeneeded的事件对像
     */
    upgradeneeded?: (
        this: IDBOpenDBRequest,
        db: IDBDatabase,
        itc: IDBTransaction,
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
        if (!dbName || typeof dbName !== 'string') {
            return Promise.reject(new TypeError('dbName must be a string'));
        }

        // if (!version) {
        let db = dbMap.get(dbName);
        if (db) {
            try {
                const _db = await dbTest(await db);
                return _db;
            } catch (e) {
                dbMap.delete(dbName);
                if (
                    !(
                        e instanceof Error &&
                        Object.prototype.toString.call(e) ===
                            '[object DOMException]' &&
                        e.message.indexOf(
                            'The database connection is closing.'
                        ) !== -1
                    )
                ) {
                    return Promise.reject(e);
                }
            }
        }
        let p = open();
        dbMap.set(dbName, p);
        p.catch(() => {
            if (p === dbMap.get(dbName)) dbMap.delete(dbName);
        });
        return p;
        // }

        function upgradeneededTest(
            this: any,
            db: IDBDatabase,
            ts?: IDBTransaction
        ) {
            switch (typeof store) {
                case 'string': {
                    let has = db.objectStoreNames.contains(store);
                    return has;
                }
                case 'function': {
                    try {
                        return (
                            store as (
                                db: IDBDatabase,
                                ts?: IDBTransaction
                            ) => boolean
                        ).call(this, db, ts);
                    } catch (err) {
                        // ts.abort();
                        throw err;
                    }
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
                        ? db.transaction([...db.objectStoreNames], 'readonly')
                        : null
                )
            ) {
                return Promise.resolve(db);
            } else {
                let v = db.version + 1;
                return open(v);
            }
        }

        function open(version?) {
            return new Promise<IDBDatabase>((resolve, reject) => {
                let request = global.indexedDB.open(dbName, version);
                // 请求数据库失败的回调函数
                request.onerror = function (_event) {
                    reject(this.error);
                };
                let iserror = false;
                //版本更新的时候或者第一次打开数据库的时候
                request.onupgradeneeded = function (event) {
                    const db = this.result;
                    const transaction = this.transaction;
                    try {
                        if (typeof upgradeneeded === 'function') {
                            upgradeneeded.call(this, db, transaction, event);
                            if (
                                !upgradeneededTest.call(this, db, transaction)
                            ) {
                                throw new Error(
                                    // `虽然已经执行了 upgradeneeded 更新数据库，但仍未通过 store 的检测`
                                    `Parameter "store" contradicts "upgradeneeded"`
                                );
                            }
                        } else if (typeof store === 'string') {
                            if (!db.objectStoreNames.contains(store)) {
                                db.createObjectStore(store, {
                                    autoIncrement: true, //自动生成主键
                                });
                            }
                        } else {
                            if (
                                !upgradeneededTest.call(this, db, transaction)
                            ) {
                                throw new TypeError('Missing or wrong type of "upgradeneeded" parameter');
                            }
                        }
                    } catch (e) {
                        transaction.abort();
                        db.close();
                        reject(e);
                    }
                };
                // 请求数据库成功的回调函数
                request.onsuccess = function (_event) {
                    const db = this.result;
                    db.onversionchange = function () {
                        db.close();
                        dbMap.delete(dbName);
                    };
                    /* c8 ignore next 3 */
                    db.onclose = function () {
                        dbMap.delete(dbName);
                    };
                    dbMap.set(dbName, db);
                    resolve(dbTest(db));
                };
                request.onblocked = function (_event) {
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
            /* c8 ignore next 3 */
            request.onerror = function (_event) {
                reject(this.error);
            };
            // 请求数据库成功的回调函数
            request.onsuccess = function (_event) {
                resolve(null);
            };
            
            // request.onblocked = function (_event) {
            //     let db = dbMap.get(dbName);
            //     console.log('delete onblocked', db);
            // };
        });
    };
    return { idbOpen, idbDelete };
}
