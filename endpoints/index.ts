const http = require('http');
import {getInfo} from '../db/infoQueries';
export function handleRemoteResponses(err: any, responders: Array<string>, cb: Function) {
const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === "/response") {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            res.end('ok');
            cb(responders, JSON.parse(body));
        });
    }
    else if(req.method === 'POST' && req.url === "/info") {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
           getInfo(JSON.parse(body)).then(data => res.end(JSON.stringify(data)));
        });
    }
    else {
        res.end(111)
    }
});
server.listen(3000);
}