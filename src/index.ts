const dbMap = new Map();

export type InitOptions = {
    /** 存储库名称 或者用于检测是否需要更新数据数的函数,返回 true 则不新, 否则执行 upgradeneeded */
    store?: string | ((db: IDBDatabase) => boolean);
    /**
     * 打开数据库时的version参数； 一般无需提供 version，除非你很清楚 indexedDB version 的机制
     */
    version?: number;
    /**
     * 更新数据库
     * @param db IDBDatabase
     * @param event onupgradeneeded的事件对像
     */
    upgradeneeded?: (
        this: IDBOpenDBRequest,
        db: IDBDatabase,
        event: IDBVersionChangeEvent
    ) => void;
};
/**
 * 打开指定indexedDb数据库
 * @param dbName 库名
 * @param options 初始化参数
 * @returns Promise<IDBDatabase>
 */
export const idbOpen: (
    /** */
    dbName: string,
    options?: InitOptions
) => Promise<IDBDatabase> = (
    dbName,
    { store, version, upgradeneeded } = {}
) => {
    if (!dbName || typeof dbName !== 'string') {
        return Promise.reject(new TypeError('dbName must be a string'));
    }
    if (!version) {
        let db = dbMap.get(dbName);
        if (db) {
            try {
                return test(db);
            } catch (e) {
                return Promise.reject(e);
            }
        }
    }

    function upgradeneededTest(db: IDBDatabase) {
        switch (typeof store) {
            case 'string': {
                let has = db.objectStoreNames.contains(store);
                has || console.log(`未找到名称为${store}的ObjectStore`);
                return has;
            }
            case 'function': {
                return (store as (db: IDBDatabase) => boolean)(db);
            }
            default:
                return true;
        }
    }

    function test(db: IDBDatabase) {
        if (upgradeneededTest(db)) {
            return Promise.resolve(db);
        } else {
            let v = (db.version || 1) + 1;
            return idbOpen(dbName, { store, version: v, upgradeneeded });
        }
    }

    return new Promise<IDBDatabase>((resolve, reject) => {
        let request = window.indexedDB.open(dbName, version);
        // 请求数据库失败的回调函数
        request.onerror = function (_event) {
            console.log('打开数据库失败,错误信息为:', this.error);
            reject(this.error);
        };
        let iserror= false;
        //版本更新的时候或者第一次打开数据库的时候
        request.onupgradeneeded = function (event) {
            console.log('进入 onupgradeneeded');
            try {
                const db = this.result;
                if (typeof upgradeneeded === 'function') {
                    upgradeneeded.call(this, db, event);
                    if (!upgradeneededTest(db)) {
                        throw new Error(
                            `虽然已经执行了 upgradeneeded 更新数据库，但仍未通过 store 的检测`
                        );
                    }
                } else if (typeof store === 'string') {
                    if (!db.objectStoreNames.contains(store)) {
                        db.createObjectStore(store, {
                            autoIncrement: true, //自动生成主键
                        });
                        console.log('成功创建数据的ObjectStore', store);
                    }
                } else {
                    if (!upgradeneededTest(db)) {
                        throw new TypeError('缺少 upgradeneeded 参数');
                    }
                }
            } catch (e) {
                iserror = true;
                reject(e);
            }
        };
        // 请求数据库成功的回调函数
        request.onsuccess = function (_event) {
            if(iserror) return;
            console.log('onsuccess:');
            const db = this.result;
            dbMap.set(dbName, db);
            resolve(test(db));
            db.onversionchange = function () {
                console.log('onversionchange');
                db.close();
                dbMap.delete(dbName);
            };
            db.onclose = function () {
                console.log('onclose');
                dbMap.delete(dbName);
            };
        };
        request.onblocked = function (_event) {
            // console.log('onblocked');
            let db = dbMap.get(dbName);
            if (db) db?.close?.();
        };
    });
};

export const idbDelete = (dbName: string) => {
    return new Promise((resolve, reject) => {
        let request = window.indexedDB.deleteDatabase(dbName);
        // 请求数据库失败的回调函数
        request.onerror = function (err) {
            console.log('删除数据库失败,错误信息为:', err);
            reject(err);
        };
        //版本更新的时候或者第一次打开数据库的时候
        request.onupgradeneeded = function (_event) {
            console.log('数据库有变化??.....');
        };
        // 请求数据库成功的回调函数
        request.onsuccess = function (_event) {
            console.log('删除数据库成功');
            dbMap.delete(dbName);
            resolve(null);
        };
        request.onblocked = function (_event) {
            console.log('上一次的数据库未关闭');
            let db = dbMap.get(dbName);
            if (db) db.close();
        };
    });
};

export default idbOpen;
