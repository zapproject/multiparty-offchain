const http = require('http');
export function handleRemoteResponses(err: any, responders: Array<string>, cb: Function) {
const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === "/response") {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString(); // convert Buffer to string
    });
    req.on('end', () => {
        res.end('ok');
        cb(responders, JSON.parse(body));
    });
}
   
});
server.listen(3000);
}