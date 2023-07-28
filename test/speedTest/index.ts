import { idbOpen, idbDelete } from "../../src/";

// 效率测试
async function main2() {
    await idbDelete("flash");
    const config = {
        a: "++,c1,c2,&c3,*c4,[c5+c6],c7,c8,c9,c10",
        b: ",c1,c2,&c3,*c4,[c5+c6],c7,c8,c9,c10",
        c: "++id,c1,c2,&c3,*c4,[c5+c6],c7,c8,c9,c10",
        d: "id,c1,c2,&c3,*c4,[c5+c6],c7,c8,c9,c10",
        e: ",c1,c2,&c3,*c4,[c5+c6],c7,c8,c9,c10",
        f: "++id,c1,c2,&c3,*c4,[c5+c6],c7,c8,c9,c10",
        g: "id,c1,c2,&c3,*c4,[c5+c6],c7,c8,c9,c10",
    };
    const config1 = new Array(10).fill(0).reduce(
        (c, v, i) => {
            Object.keys(config).reduce((c, key) => {
                c[key + i] = config[key];
                return c;
            }, c);
            return c;
        },
        { ...config }
    );

    const open = async () =>
        idbOpen("flash", {
            store: config,
        });
    const open1 = async () =>
        idbOpen("flash", {
            store: config1,
        });
    const open2 = async () =>
        idbOpen("flash", {
            store: {
                a: "++,c1,c2,&c3,*c4,[c5+c6],c7,c8,c9,c10",
            },
        });
    
    console.log('==== 第一次 ====');

    console.time("open ");
    await open();
    console.timeEnd("open ");

    console.time("open1");
    await open1();
    console.timeEnd("open1");

    console.time("open2");
    await open2();
    console.timeEnd("open2");

    console.log('==== 第二次 ====');
    console.time("open ");
    await open();
    console.timeEnd("open ");

    console.time("open1");
    await open1();
    console.timeEnd("open1");

    console.time("open2");
    await open2();
    console.timeEnd("open2");
    
    console.log('==== 多次 ====');
    console.time("open  x1000");
    for (var i = 0; i < 1000; i++) {
        await open();
    }
    console.timeEnd("open  x1000");

    console.time("open2 x1000");
    for (var i = 0; i < 1000; i++) {
        await open2();
    }
    console.timeEnd("open2 x1000");

    console.time("open1 x1000");
    for (var i = 0; i < 1000; i++) {
        await open1();
    }
    console.timeEnd("open1 x1000");
}

// await main();
// await main1();
await main2();
(window as any)?.__testEnd__?.();
