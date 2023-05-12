import { idbOpen, idbDelete } from '../src/index';
class osCmd {
    constructor(dbName, store) {
        this.options = {
            dbName,
            store,
        };
        this.open = () => idbOpen(dbName, { store });
    }
    getos = async (module = 'readwrite') => {
        let { store } = this.options;
        const db = await this.open();
        return db.transaction(store, module).objectStore(store);
    };
    get = (id) => {
        return this.getos('readonly').then((os) => {
            return new Promise((resolve, reject) => {
                let request = os.get(id);
                request.onerror = reject;
                request.onsuccess = () => resolve(request.result);
            });
        });
    };
    set = (data, id) => {
        return this.getos('readwrite').then((os) => {
            return new Promise((resolve, reject) => {
                let request = os.put(data, id);
                request.onerror = reject;
                request.onsuccess = () => resolve();
            });
        });
    };
}
async function main() {
    const cmd1 = new osCmd('db1', 'os1');
    const cmd2 = new osCmd('db1', 'os2');
    Promise.all([cmd1.get('key'), cmd2.get('key')]).then(console.log);
    cmd1.set(['cmd1'], 'key');
    cmd2.set(['cmd2'], 'key');
    // console.log(await cmd1.get('key'));
    console.log(await cmd2.get('key'));
    await cmd2.set([3333], 'key2');
    console.log(await cmd2.get('key2'));
    await cmd1.set([4444], 'key2');
    console.log(await cmd1.get('key2'));

    // console.log((await cmd1.open()) === (await cmd2.open()));

    await idbDelete('db1');
    console.log('cmd1>key', await cmd1.get('key'));
    console.log('cmd2>key', await cmd2.get('key'));
}

main();
