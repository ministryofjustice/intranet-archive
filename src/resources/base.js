import { debug } from './debug';

let app = {
    init: () => {
        debug.active = true
        debug.log('Application initialised')
    }
};

export { app };
