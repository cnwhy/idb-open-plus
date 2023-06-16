# 使用指南

## 简介

**idbOpen** 是提供给需要使用 `indexedDB` 却被 `indexedDB version` 机制困扰的人; 它完全不需要手动处理 `version`, 至始至终都按你的需要 创建/打开/更新 对应的`IDBDatabase`;

## 使用方法及代码示例

```js
/* 简单kv库实现 */
import idbOpen from "idb-open";

class IdbKV {
    constructor(dbName, store) {
        this.options = {
            dbName,
            store,
        };
        this.open = () => idbOpen(dbName, { store }); // 返回 IDBDatabase 对像
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

const kv1 = new IdbKV("db1", "kvStore1");
const kv2 = new IdbKV("db1", "kvStore2");
await kv1.set("value1", "key1");
await kv2.set("value2", "key2");
console.log(await kv1.get("key1"));
console.log(await kv1.get("key2"));
```

> 上面的代码，虽然两个 kv 对像用的同一个 db, 但我们不需要去处理 `db1` 这个库的更新；只是必须遵循一个原则，`IDBDatabase` 即用即取，不要缓存它；即每次要用事务时都先通过 `idbOpen()` 拿到 `IDBDatabase` , 内部是已经做好了缓存的，无需太过当心效率问题；

## API

```typescript
type idbOpen = (dbName: string, opeion: InitOptions) => Promise<IDBDatabase>;

type InitOptions = {
    /** 存储库名称 或者用于检测是否需要更新数据数的函数,返回 true 则不更新, 否则执行 upgradeneeded 来更新数据库 */
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
```

当 `store` 为 `stirng` 时, `upgradeneeded` 可以不传, 默认以如下方式,初始化 `ObjectStore`

```typescript
// 如果库里面没有这个名称的 `ObjectStore` 时
db.createObjectStore(store, {
    autoIncrement: true,
});
```

当然,你也可以用 `upgradeneeded` 参数来创建 `ObjectStore`

```typescript
import idbOpen from "idb-open";

const getDB = async () => {
    return idbOpen("db1", {
        store: "storeName1",
        upgradeneeded: (db, itc) => {
            const os = db.createObjectStore("storeName1", {
                keyPath: "id",
            });
            os.createIndex("name", "name", { unique: false });
            os.createIndex("email", "email", { unique: true });
        },
    });
};
```

以上代码`upgradeneeded`的执行,只会简单判断是否有`storeName1`; 当 `store` 是函数时,可以检查更多的东西以判断是否需要更新数据库;

```js
import idbOpen from "idb-open";

const getDB = async () => {
    return idbOpen("db1", {
        store: (db, itc) => {
            const useStores = ["storeName1", "storeName2"];
            const storeNames = [...db.objectStoreNames];
            return useStores.every((name) => {
                return storeNames.indexOf(name);
            });
        },
        upgradeneeded: (db, itc) => {
            const os = db.createObjectStore("storeName1", {
                keyPath: "id",
            });
            os.createIndex("name", "name", { unique: false });
            os.createIndex("email", "email", { unique: true });
            db.createObjectStore("storeName2", {
                autoIncrement: true,
            });
        },
    });
};
```

> 但要注意 `store` 与 `upgradeneeded` 不能相悖, 不然可能会报错;
