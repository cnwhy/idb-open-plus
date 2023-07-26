export const isIEOrEdge =
    typeof navigator !== "undefined" &&
    /(MSIE|Trident|Edge)/.test(navigator.userAgent);
/**
 * 字段属性
 */
export interface IndexSpec {
    name: string;
    keyPath: string | Array<string> | undefined;
    unique: boolean | undefined;
    multi: boolean | undefined;
    auto: boolean | undefined;
    compound: boolean | undefined;
    src: string;
}

export interface TableSchema {
    name: string;
    primKey: IndexSpec;
    indexes: IndexSpec[];
    mappedClass: Function;
    idxByName: { [name: string]: IndexSpec };
    readHook?: (x: any) => any;
}

export type DbSchema = { [tableName: string]: TableSchema };

export interface SchemaDiff {
    del: string[];
    add: [string, TableSchema][];
    change: TableSchemaDiff[];
}

export interface TableSchemaDiff {
    name: string;
    recreate: boolean;
    del: string[];
    add: IndexSpec[];
    change: IndexSpec[];
}

export function nameFromKeyPath(keyPath?: string | string[]): string {
    return typeof keyPath === "string"
        ? keyPath
        : keyPath
        ? "[" + [].join.call(keyPath, "+") + "]"
        : "";
}

// 反序列化 成索引结构对像
export const formatStore = (primKeyAndIndexes: string) => {
    return primKeyAndIndexes.split(",").map((index, indexNum) => {
        index = index.trim();
        const name = index.replace(/([&*]|\+\+)/g, ""); // Remove "&", "++" and "*"
        const keyPath = /^\[/.test(name)
            ? name.match(/^\[(.*)\]$/)[1].split("+")
            : name;
        return createIndexSpec(
            name,
            keyPath,
            /\&/.test(index),
            /\*/.test(index),
            /\+\+/.test(index),
            Array.isArray(keyPath),
            indexNum === 0
        );
    });
};

// 创建数据集
export function createTable(
    idbtrans: IDBTransaction,
    tableName: string,
    primKey: IndexSpec,
    indexes: IndexSpec[]
) {
    const store = idbtrans.db.createObjectStore(
        tableName,
        primKey.keyPath
            ? { keyPath: primKey.keyPath, autoIncrement: primKey.auto }
            : { autoIncrement: primKey.auto }
    );
    indexes.forEach((idx) => addIndex(store, idx));
    return store;
}

// 设置索引
export function addIndex(store: IDBObjectStore, idx: IndexSpec) {
    store.createIndex(idx.name, idx.keyPath, {
        unique: idx.unique,
        multiEntry: idx.multi,
    });
}

// 组装成索引结构对像
export function createIndexSpec(
    name: string,
    keyPath: string | string[],
    unique: boolean,
    multi: boolean,
    auto: boolean,
    compound: boolean,
    isPrimKey: boolean
): IndexSpec {
    return {
        name,
        keyPath,
        unique,
        multi,
        auto,
        compound,
        src:
            (unique && !isPrimKey ? "&" : "") +
            (multi ? "*" : "") +
            (auto ? "++" : "") +
            nameFromKeyPath(keyPath),
    };
}

// 组装成数据体结构对像
export function createTableSchema(
    name: string,
    primKey: IndexSpec,
    indexes: IndexSpec[]
): TableSchema {
    return {
        name,
        primKey,
        indexes,
        mappedClass: null,
        idxByName: arrayToObject(indexes, (index) => [index.name, index]),
    };
}

// 当前数据库，所有数据体结构
export function buildGlobalSchema(
    idbdb: IDBDatabase,
    tmpTrans: IDBTransaction
) {
    const globalSchema: DbSchema = {};
    const dbStoreNames = [...idbdb.objectStoreNames];
    dbStoreNames.forEach((storeName) => {
        const store = tmpTrans.objectStore(storeName);
        let keyPath = store.keyPath;
        const primKey = createIndexSpec(
            nameFromKeyPath(keyPath),
            keyPath || "",
            false,
            false,
            !!store.autoIncrement,
            keyPath && typeof keyPath !== "string",
            true
        );
        const indexes: IndexSpec[] = [];
        for (let j = 0; j < store.indexNames.length; ++j) {
            const idbindex = store.index(store.indexNames[j]);
            keyPath = idbindex.keyPath;
            var index = createIndexSpec(
                idbindex.name,
                keyPath,
                !!idbindex.unique,
                !!idbindex.multiEntry,
                false,
                keyPath && typeof keyPath !== "string",
                false
            );
            indexes.push(index);
        }
        globalSchema[storeName] = createTableSchema(
            storeName,
            primKey,
            indexes
        );
    });
    return globalSchema;
}

// 调整索引
export function adjustToExistingIndexNames(
    schema: DbSchema,
    idbtrans: IDBTransaction
) {
    // Issue #30 Problem with existing db - adjust to existing index names when migrating from non-dexie db
    const storeNames = idbtrans.db.objectStoreNames;

    for (let i = 0; i < storeNames.length; ++i) {
        const storeName = storeNames[i];
        const store = idbtrans.objectStore(storeName);

        for (let j = 0; j < store.indexNames.length; ++j) {
            const indexName = store.indexNames[j];
            const keyPath = store.index(indexName).keyPath;
            const dexieName =
                typeof keyPath === "string"
                    ? keyPath
                    : "[" + [...keyPath].join("+") + "]";
            if (schema[storeName]) {
                const indexSpec = schema[storeName].idxByName[dexieName];
                if (indexSpec) {
                    indexSpec.name = indexName;
                    delete schema[storeName].idxByName[dexieName];
                    schema[storeName].idxByName[indexName] = indexSpec;
                }
            }
        }
    }
}

// 比较所有数据集的索引差异
export function getSchemaDiff(
    oldSchema: DbSchema,
    newSchema: DbSchema,
    incrementalUpdate = true
): SchemaDiff {
    const diff: SchemaDiff = {
        del: [], // Array of table names
        add: [], // Array of [tableName, newDefinition]
        change: [], // Array of {name: tableName, recreate: newDefinition, del: delIndexNames, add: newIndexDefs, change: changedIndexDefs}
    };
    let table: string;
    if (!incrementalUpdate) {
        for (table in oldSchema) {
            if (!newSchema[table]) diff.del.push(table);
        }
    }
    for (table in newSchema) {
        const oldDef = oldSchema[table],
            newDef = newSchema[table];
        if (!oldDef) {
            diff.add.push([table, newDef]);
        } else {
            const change = {
                name: table,
                def: newDef,
                recreate: false,
                del: [],
                add: [],
                change: [],
            };
            if (
                // compare keyPaths no matter if string or string[]
                // compare falsy keypaths same no matter if they are null or empty string.
                "" + (oldDef.primKey.keyPath || "") !==
                    "" + (newDef.primKey.keyPath || "") ||
                // Compare the autoIncrement flag also
                (oldDef.primKey.auto !== newDef.primKey.auto && !isIEOrEdge)
            ) {
                // IE has bug reading autoIncrement prop.
                // Primary key has changed. Remove and re-add table.
                change.recreate = true;
                diff.change.push(change);
            } else {
                // Same primary key. Just find out what differs:
                const oldIndexes = oldDef.idxByName;
                const newIndexes = newDef.idxByName;
                let idxName: string;

                if (!incrementalUpdate) {
                    for (idxName in oldIndexes) {
                        if (!newIndexes[idxName]) change.del.push(idxName);
                    }
                }

                for (idxName in newIndexes) {
                    const oldIdx = oldIndexes[idxName],
                        newIdx = newIndexes[idxName];
                    if (!oldIdx) change.add.push(newIdx);
                    else if (oldIdx.src !== newIdx.src)
                        change.change.push(newIdx);
                }
                if (
                    change.del.length > 0 ||
                    change.add.length > 0 ||
                    change.change.length > 0
                ) {
                    diff.change.push(change);
                }
            }
        }
    }
    return diff;
}

export const _hasOwn = {}.hasOwnProperty;

export function hasOwn(obj, prop) {
    return _hasOwn.call(obj, prop);
}

export function shallowClone(obj) {
    var rv = {};
    for (var m in obj) {
        if (hasOwn(obj, m)) rv[m] = obj[m];
    }
    return rv;
}

export function arrayToObject<T, R>(
    array: T[],
    extractor: (x: T, idx: number) => [string, R]
): { [name: string]: R } {
    return array.reduce((result, item, i) => {
        var nameAndValue = extractor(item, i);
        if (nameAndValue) result[nameAndValue[0]] = nameAndValue[1];
        return result;
    }, {});
}

export function getDiffByObjectStore(
    store: { [name: string]: string },
    db: IDBDatabase,
    transaction: IDBTransaction,
    incrementalUpdate?: boolean
) {
    const globalSchema = buildGlobalSchema(db, transaction);
    const thisSchema: DbSchema = {};
    Object.keys(store).forEach((storeName) => {
        const [primKey, ...indexes] = formatStore(store[storeName]);
        thisSchema[storeName] = createTableSchema(storeName, primKey, indexes);
    });
    const diff = getSchemaDiff(globalSchema, thisSchema, incrementalUpdate);
    console.log("[diff]", diff);
    return diff;
}
