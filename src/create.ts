import {
    buildGlobalSchema,
    getDiffByObjectStore,
    getSchemaDiff,
    updateDbByDiff,
    IncrementalUpdate,
} from "./utils";

export type Upgradeneeded = (
    this: IDBOpenDBRequest,
    db: IDBDatabase,
    transaction: IDBTransaction,
    event: IDBVersionChangeEvent
) => void;

export type InitOptions = {
    /** 存储库名称 或者用于检测是否需要更新数据数的函数,返回 true 则不更新, 否则执行 upgradeneeded */
    store?:
        | string
        | { [name: string]: string }
        | ((
              db: IDBDatabase,
              transaction?: IDBTransaction
          ) => void | Upgradeneeded);
    incrementalUpdate?: IncrementalUpdate;
};

export function create(global: Window) {
    const dbMap = new Map();

    /**
     * 打开指定indexedDb数据库
     * @param dbName 库名
     * @param options 初始化参数
     * @returns Promise<IDBDatabase>
     */
    const idbOpen: (
        dbName: string,
        options?: InitOptions
    ) => Promise<IDBDatabase> = async (
        dbName,
        { store, incrementalUpdate } = {}
    ) => {
        if (!dbName || typeof dbName !== "string") {
            return Promise.reject(new TypeError("dbName must be a string"));
        }

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
                            "[object DOMException]" &&
                        e.message.indexOf(
                            "The database connection is closing."
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

        function upgradeneededTest(
            this: any,
            db: IDBDatabase,
            transaction?: IDBTransaction
        ) {
            const testStore = function (store) {
                const diff = getDiffByObjectStore(
                    store,
                    db,
                    transaction,
                    incrementalUpdate
                );
                if (
                    diff.add?.length ||
                    diff.change?.length ||
                    diff.del?.length
                ) {
                    return false;
                }
                return true;
            };

            switch (typeof store) {
                case "string": {
                    const [name, indexes] = store.split("|");
                    return testStore({ [name]: indexes || "++" });
                }
                case "function": {
                    try {
                        const upgradeneeded = store.call(this, db, transaction);
                        return typeof upgradeneeded !== "function";
                    } catch (err) {
                        // ts.abort();
                        throw err;
                    }
                }
                case "object": {
                    if (store) {
                        return testStore(store);
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
                        ? db.transaction([...db.objectStoreNames], "readonly")
                        : undefined
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
                        switch (typeof store) {
                            case "function": {
                                const run = () =>
                                    store.call(this, db, transaction);
                                const getSchema = () =>
                                    buildGlobalSchema(db, transaction);
                                let upgradeneeded;
                                let oldSchema = getSchema();
                                while (
                                    typeof (upgradeneeded = run()) ===
                                    "function"
                                ) {
                                    upgradeneeded.call(
                                        this,
                                        db,
                                        transaction,
                                        event
                                    );
                                    const newSchema = getSchema();
                                    const diff = getSchemaDiff(
                                        oldSchema,
                                        newSchema,
                                        false
                                    );
                                    oldSchema = newSchema;
                                    if (
                                        !(
                                            diff.add?.length ||
                                            diff.change?.length ||
                                            diff.del?.length
                                        )
                                    ) {
                                        throw new Error(
                                            // `虽然已经执行了 upgradeneeded 更新数据库，但仍未通过 store 的检测`
                                            `Parameter "store" contradicts "upgradeneeded"`
                                        );
                                    }
                                }
                                break;
                            }
                            case "string":
                            case "object": {
                                let _store: { [name: string]: string };
                                if (typeof store === "string") {
                                    const [name, indexes] = store.split("|");
                                    _store = { [name]: indexes || "++" };
                                } else {
                                    _store = store as {
                                        [name: string]: string;
                                    };
                                }
                                const diff = getDiffByObjectStore(
                                    _store,
                                    db,
                                    transaction,
                                    incrementalUpdate
                                );
                                updateDbByDiff(diff, db, transaction);
                                break;
                            }
                            default: {
                                if (
                                    !upgradeneededTest.call(
                                        this,
                                        db,
                                        transaction
                                    )
                                ) {
                                    throw new TypeError(
                                        'Missing or wrong type of "upgradeneeded" parameter'
                                    );
                                }
                            }
                        }
                    } catch (e) {
                        console.error(e);
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
                    try {
                        resolve(dbTest(db));
                    } catch (e) {
                        reject(e);
                    }
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
