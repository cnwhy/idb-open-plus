// use v8-to-istanbul
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const pti = require('puppeteer-to-istanbul');
const { createServer } = require('vite');
const NYC = require('nyc');
const open = require('open');
const v8toIstanbul = require('v8-to-istanbul');
// const { exec } = require('child_process');

// const __dirname = fileURLToPath(new URL('.', import.meta.url));
const codePath = path.join(__dirname, '..').replace(/\\/g, '/');
const coverageInclude = new RegExp(codePath + '/(lib|src)');
const port = 3300;

const outDir = path.join(__dirname, '../.nyc_output');

const startServer = async () => {
    const server = await createServer({
        // 任何合法的用户配置选项，加上 `mode` 和 `configFile`
        configFile: false,
        root: __dirname,
        server: {
            port: port,
        },
    });
    await server.listen();
    server.printUrls();
    return server;
};

let outLog = Promise.resolve();
const onConsole = async (e) => {
    const args = Promise.all(e.args().map((a) => a.jsonValue()));
    outLog = outLog.then(() => args);
    runConsole(args);
};
const runConsole = async (args) => {
    await outLog;
    console.log(...(await args));
};

async function main() {
    const server = await startServer();
    const serverPort = server.config.server.port || port;
    let outLog = Promise.resolve();
    // let executionQueue = Promise.resolve();
    const browser = await puppeteer.launch({
        args: ['--no-sandbox'],
        headless: 'new',
    });
    const page = await browser.newPage();
    async function end(errors) {
        await runConsole(['====> 自动测试完成，一共有%s个错误', errors]);

        if (true) {
            // if(!errors){
            console.log('====> 开始分析覆盖率');
            // await page.close();
            const jsCoverage = await page.coverage.stopJSCoverage();
            // jsCoverage.forEach((item) => {
            //     const { url } = item;
            //     console.log(url);
            // });
            let out = jsCoverage.filter((item) => {
                const isLib = coverageInclude.test(item.url);
                // const isLib = item.url.indexOf('/idbConnection/(lib|src)/') !== -1;
                if (isLib) {
                    // let url = new URL(item.url);
                    // url.pathname = url.pathname.replace(/\:/g, '_');
                    // item.url = url.toString();
                    return true;
                }
                return false;
            });
            // for (let k of out) {
            //     let url = new URL(k.url);
            //     const converter = v8toIstanbul(
            //         url.pathname.replace('/@fs/', ''),
            //         undefined,
            //         { source: k.text }
            //     );
            //     converter.load();
            //     converter.applyCoverage(k.rawScriptCoverage.functions);
            //     console.info(JSON.stringify(converter.toIstanbul()));
            // }

            // out = out.map((item) => {
            //     let url = new URL(item.url);
            //     url.pathname = url.pathname.replace(/\:/g, '_');
            //     // item.url = url.toString();
            //     return {
            //         ...item,
            //         url: url.toString(),
            //     };
            // });
            // pti.write([...out], { storagePath: './.nyc_output' });

            let outJson = {};
            for (let k of out) {
                let url = new URL(k.url);
                url = url.pathname.replace('/@fs/', '');
                const converter = v8toIstanbul(url, undefined, {
                    source: k.text,
                });
                converter.load();
                converter.applyCoverage(k.rawScriptCoverage.functions);
                // console.info(JSON.stringify(converter.toIstanbul()));
                // outJson[url] = converter.toIstanbul();
                outJson = {
                    ...outJson,
                    ...converter.toIstanbul(),
                };
            }
            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(
                path.join(outDir, 'out.json'),
                JSON.stringify(outJson),
                { flag: 'w' }
            );

            console.log('====> 分析完成');
            console.log('====> 开始生成覆盖率报告');
            var nyc = new NYC({ reporter: ['text', 'html'] });
            await nyc.report();
            let htmlFile = path.join(__dirname, '../coverage/index.html');
            console.log(`详细报告: ${htmlFile}`);
            open(htmlFile);
        }

        await browser.close();
        await server.close();
    }
    page.on('error', (error) => console.error(error));
    page.on('pageerror', (error) => console.error(error));
    page.on('console', onConsole);
    await page.exposeFunction('polendinaEnd', (errors) => {
        end(errors);
    });

    // await run(t, page);
    await page.coverage.startJSCoverage({ includeRawScriptCoverage: true });
    await page.goto(`http://127.0.0.1:${serverPort}`, { waitUntil: 'load' });
}

main();
