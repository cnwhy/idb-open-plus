import '../node_modules/mocha/mocha.css';
import 'mocha/mocha';
mocha.setup({ reporter: 'spec', ui: 'bdd', color: true});
function loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = url;
        script.onload = () => resolve();
        script.onerror = () => reject(Error('Script load error'));
        document.body.appendChild(script);
    });
}

(async function () {
    let errors = 0;
    await loadScript('./bdd.ts');
    mocha
        .run((_errors) => {
            errors = _errors;
            // console.log('run',errors);
            (window as any)?.polendinaEnd?.(errors);
        })
        // .on('end', (...args) => {
        //     console.log(args);
        //     (window as any)?.polendinaEnd?.(errors);
        // });
})();
