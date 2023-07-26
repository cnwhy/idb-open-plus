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

export type InitOptions = {
    /** 存储库名称 或者用于检测是否需要更新数据数的函数,返回 true 则不更新, 否则执行 upgradeneeded */
    store?:
        | string
        | { [name: string]: string }
        | (( db: IDBDatabase, transaction?: IDBTransaction ) => void | Upgradeneeded);
    /** 增量更新,默认开启 **/
    incrementalUpdate?: boolean;
};
```

### 约定式

```typescript
import idbOpen from "idb-open";

function getDB(){
    return idbOpen('db1', {store:'st1|++,name'}); // 只有一个ObjectStore时可以这样简写
    // 等价于
    return idbOpen('db1', {store:{
        'st1': '++,name'
    }})
}
```

### 自定义

```typescript
import idbOpen from "idb-open";

const getDB = async () => {
    return idbOpen("db1", {
        store: (db)=>{
            if(db.objectStoreNames.contains('ts1'));
            return (db,transaction)=>{
               const os = db.createObjectStore('ts1', {
                    autoIncrement: true,
                })
                // os.createIndex("name", "name", { unique: false });
            }
        }
    });
};
```

> 但要注意 `store` 与返回的处理函数不能相悖, 不然可能会因为死循环报错;

## 开发中

### 约定式创建 `ObjectStore`
||||
|--|--|--|
|*主键约定*|
| ++keyPath | 自动递增主键 |  |
| ++ | 隐藏的自增主键 |  |
| keyPath | 非自增主键 | 需要主动提供主键 |
| *(blank)* | 隐藏的非自增主键 | 将第一个条目留空意味着主键是隐藏的，而不是自动递增的 |
|*索引约定*|
| keyPath | 普通索引 |  |
| &keyPath | 唯一索引 |  |
| *keyPath | Multi-valued | 表示如果key是一个数组，则每个数组值将被视为对象的键 |
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

> 约定式模型参考自[dexie](https://github.com/dfahlander/Dexie.js);
