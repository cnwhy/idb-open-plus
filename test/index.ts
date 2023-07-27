import '../node_modules/mocha/mocha.css';
import 'mocha/mocha';

const isAutoTest = (window as any)?.__testEnd__; 
mocha.setup({
    reporter: isAutoTest ? 'spec' : 'html',
    ui: 'bdd',
    color: true,
    timeout: 5000,
});
await import('./bdd');

// function loadScript(url: string): Promise<void> {
//     return new Promise((resolve, reject) => {
//         const script = document.createElement('script');
//         script.type = 'module';
//         script.src = url;
//         script.onload = () => resolve();
//         script.onerror = () => reject(Error('Script load error'));
//         document.body.appendChild(script);
//     });
// }

(async function () {
    let errors = 0;
    mocha.run((_errors) => {
        errors = _errors;
        (window as any)?.__testEnd__?.(errors);
    });
})();
