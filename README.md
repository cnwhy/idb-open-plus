# IDB-OPEN-PLUSH

[![Coverage Status](https://coveralls.io/repos/github/cnwhy/idb-open-plush/badge.svg?branch=master)](https://coveralls.io/github/cnwhy/idb-open-plush?branch=master) [![github test](https://github.com/cnwhy/idb-open-plush/workflows/test/badge.svg?branch=master)](https://github.com/cnwhy/idb-open-plush/actions/workflows/test.yml)

**idb-open-plush** 是提供给需要使用 `indexedDB` 却被 `indexedDB version` 机制困扰的人; 使用它之后完全不需要再去处理 `version`, 至始至终都按你的需要 创建/打开/更新 对应的`IDBDatabase`;

## 使用方法及代码示例

### 简单 KV 库实现

```js
import idbOpen from "idb-open-plush";

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

> 上面的代码，虽然两个 kv 对像用的同一个 db, 但我们不需要去处理 `db1` 这个库的更新；  
> 只是必须遵循一个原则，`IDBDatabase` 即用即取，不要缓存它， 即每次要用事务时都先通过 `idbOpen()` 拿到 `IDBDatabase` , 内部是已经做好了缓存的，无需太过当心效率问题；

### 搭配`idb`库使用 代码变得更丝滑

```js
import idbOpen from "idb-open-plush";
import { openDB, wrap, unwrap } from "idb";

class IdbKV {
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
```

## API

```typescript

type idbOpen: (dbName: string, options?: InitOptions) => Promise<IDBDatabase>;

type IncrementalUpdate = boolean | "onlyIndex" | "onlyStore";

type Upgradeneeded = (
    this: IDBOpenDBRequest,
    db: IDBDatabase,
    transaction: IDBTransaction,
    event: IDBVersionChangeEvent
) => void;

type InitOptions = {
    //** 存储库配置 */
    store?:
        | string
        | { [name: string]: string; }
        | ((
              db: IDBDatabase,
              transaction?: IDBTransaction
          ) => void | Upgradeneeded);
    incrementalUpdate?: IncrementalUpdate;
};

```

### 约定式创建/更新 `ObjectStore`

```typescript
import idbOpen from "idb-open";

function getDB() {
    // return idbOpen("db1", { store: "st1|++,name" }); // 只有一个ObjectStore时可以这样简写
    // 等价于
    return idbOpen("db1", {
        store: {
            st1: "++,name",
        },
    });

    // 另外，约定式模式下，只有对像库名时，主键默认为 隐藏自增主键
    // { store: "st1" } <==> { store: "st1|++" } <==> { store: { st1: '++'}}
}
```

#### 约定式 主键，索引规则

> 约定式模型参考自[dexie](https://github.com/dfahlander/Dexie.js);

|  |  |  |
| --- | --- | --- |
| _主键约定_ |
| ++keyPath | 自动递增主键 |  |
| ++ | 隐藏的自增主键 |  |
| keyPath | 非自增主键 | 需要主动提供主键 |
| _(blank)_ | 隐藏的非自增主键 | 将第一个条目留空意味着主键是隐藏的，而不是自动递增的 |
| _索引约定_ |
| keyPath | 普通索引 |  |
| &keyPath | 唯一索引 |  |
| \*keyPath | Multi-valued | 表示如果 key 是一个数组，则每个数组值将被视为对象的键 |
| [keyPath1+keyPath2] | 复合索引 |  |

```js
{
    friends: '++id,name,shoeSize', // Primary Key is auto-incremented (++id)
    pets: 'id, name, kind',        // Primary Key is not auto-incremented (id)
    cars: '++, name',              // Primary Key auto-incremented but not inbound
    enemies: ',name,*weaknesses',  // Primary key is neither inbound nor auto-incr
                                   // 'weaknesses' contains an array of keys (*)
    users: 'meta.ssn, addr.city',  // Dotted keypath refers to nested property
    people: '[name+ssn], &ssn'     // Compound primary key. Unique index ssn
}
```

#### 关于 `InitOptions.incrementalUpdate`

> `incrementalUpdate` 是约定模式下来控制更新规则开关，默认为 `true`

- `true` 更新配置不会删除存储库和索引; 适合多模块各自管理存储表的情况
- `false` 更新配置时会删除未配置的存储库和索引; 适合共用同一配置的情况
- `'onlyIndex'` 更新配置时会删除未配置的存储库，但会保留未配置的索引;
- `'onlyStore'` 更新配置时会删除未配置的索引，但会保留未配置的存储库;

### 自定义创建/更新 `ObjectStore`

```typescript
import idbOpen from "idb-open";

const getDB = async () => {
    return idbOpen("db1", {
        store: (db) => {
            // 判断是否需要更新，不需要直接返回；
            if (db.objectStoreNames.contains("ts1")) return;

            // 返回一个函数则表示需要更新；
            return (db, transaction) => {
                const os = db.createObjectStore("ts1", {
                    autoIncrement: true,
                });
            };
        },
    });
};

const getDB1 = async () => {
    return idbOpen("db1", {
        store: (db) => {
            // 一个判断一个更新方法，适合迭代

            if (!db.objectStoreNames.contains("ts1")) {
                return (db, transaction) => {
                    const os = db.createObjectStore("ts1", {
                        autoIncrement: true,
                    });
                };
            }

            if (!db.objectStoreNames.contains("ts2")) {
                return (db, transaction) => {
                    const os = db.createObjectStore("ts2", {
                        autoIncrement: true,
                    });
                };
            }
        },
    });
};
```

> 注意 `store` 与返回的处理函数不能相悖, 不然可能会因为死循环报错;
