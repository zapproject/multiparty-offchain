const http = require('http');
import {getInfo} from '../db/infoQueries';
export function handleRemoteResponses(err: any, responders: Array<string>, cb: Function) {
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8002');
    if (req.method === 'POST' && req.url === "/response") {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async() => {
            try {
                await cb(JSON.parse(body));
                res.end(`ok`);
            } catch(err) {
                res.end(JSON.stringify(err))
            }
            
        });          
    }
    else if((req.method === 'POST' || req.method === 'OPTIONS') && req.url === "/info") {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            getInfo(JSON.parse(body)).then(data => res.end(JSON.stringify(data)));
        });
    }
    else if(req.method === 'GET' && req.url === "/responders") {
       res.end(JSON.stringify(responders));
    }
    else {
        res.end('not found')
    }
});
server.listen(3000);
}