// use v8-to-istanbul
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer");
const pti = require("puppeteer-to-istanbul");
const { createServer } = require("vite");
const NYC = require("nyc");
const open = require("open");
const v8toIstanbul = require("v8-to-istanbul");
// const { exec } = require('child_process');

const port = 3300;


// 覆盖率 json 输出目录
const outDir = path.join(__dirname, "../.nyc_output");
// vite 启动测试服务的路径
const root = path.join(__dirname,'../test');
// 项目目录
const codePath = path.join(__dirname, "..").replace(/\\/g, "/");
// 筛选需要导出覆盖率的文件
const coverageInclude = new RegExp(codePath + "/(lib|src)");

console.log('[config]',{
    outDir,
    root,
    codePath,
    coverageInclude
})

const args = process.argv.slice(2);
const noOpen = args.includes("--noOpen");
const coverage = args.includes("--coverage");

const startServer = async () => {
    const server = await createServer({
        // 任何合法的用户配置选项，加上 `mode` 和 `configFile`
        configFile: false,
        root: root,
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

const outCoverageReporter = async () => {
    var nyc = new NYC({ reporter: ["text", "html"] });
    return nyc.report();
}

async function main() {
    const server = await startServer();
    const serverPort = server.config.server.port || port;
    const browser = await puppeteer.launch({
        args: ["--no-sandbox"],
        headless: "new",
    });
    const page = await browser.newPage();
    async function end(errors) {
        await runConsole(["====> 自动测试完成，一共有%s个错误", errors]);

        // if (true) {
        if (!errors && coverage) {
            console.log("====> 开始分析覆盖率");
            // await page.close();
            const jsCoverage = await page.coverage.stopJSCoverage();

            let out = jsCoverage.filter((item) => {
                const isLib = coverageInclude.test(item.url);
                if (isLib) {
                    return true;
                }
                return false;
            });

            let outJson = {};

            for (let k of out) {
                let url = new URL(k.url);
                url = url.pathname.replace("/@fs/", path.sep === "/" ? "/" : '');
                const converter = v8toIstanbul(url, undefined, {
                    source: k.text,
                });
                await converter.load();
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
                path.join(outDir, "out.json"),
                JSON.stringify(outJson),
                { flag: "w" }
            );

            console.log("====> 分析完成");
            console.log("====> 开始生成覆盖率报告");
            await outCoverageReporter(); // 将覆盖率数据转为可读报告。
            let htmlFile = path.join(__dirname, "../coverage/index.html");
            console.log(`详细报告: ${htmlFile}`);
            noOpen || open(htmlFile);
        }

        await browser.close();
        await server.close();
    }
    page.on("error", (error) => console.error(error));
    page.on("pageerror", (error) => console.error(error));
    page.on("console", onConsole);
    await page.exposeFunction("__testEnd__", async (errors) => {
        await end(errors);
        if (errors) process.exit(1);
    });

    // await run(t, page);
    if(coverage){
        await page.coverage.startJSCoverage({ includeRawScriptCoverage: true });
    }
    await page.goto(`http://localhost:${serverPort}`, { waitUntil: "load" });
}

main();
