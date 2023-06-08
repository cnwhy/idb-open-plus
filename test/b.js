const path = require('path');
const puppeteer = require('puppeteer');
const pti = require('puppeteer-to-istanbul');
const { createServer } = require('vite');
const NYC = require('nyc');
// const { exec } = require('child_process');
const open = require('open');
// import puppeteer from 'puppeteer';
// import pti from 'puppeteer-to-istanbul';
// import { fileURLToPath } from 'url';
// import { createServer } from 'vite';

// const __dirname = fileURLToPath(new URL('.', import.meta.url));
const codePath = path.join(__dirname, '..').replace(/\\/g, '/');
const coverageInclude = new RegExp(codePath + '/(lib|src)');

const startServer = async () => {
    const server = await createServer({
        // 任何合法的用户配置选项，加上 `mode` 和 `configFile`
        configFile: false,
        root: __dirname,
        server: {
            port: 3300,
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
            const out = jsCoverage.filter((item) => {
                const isLib = coverageInclude.test(item.url);
                // const isLib = item.url.indexOf('/idbConnection/(lib|src)/') !== -1;
                if (isLib) {
                    let url = new URL(item.url);
                    url.pathname = url.pathname.replace(/\:/g, '_');
                    item.url = url.toString();
                    return true;
                }
                return false;
            });
            pti.write([...out], { storagePath: './.nyc_output' });
            var nyc = new NYC({ report: ['html', 'text'] });
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
    await page.goto('http://127.0.0.1:3300', { waitUntil: 'load' });
}

main();
