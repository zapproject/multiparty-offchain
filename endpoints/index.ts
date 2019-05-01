const http = require('http');
const { parse } = require('querystring');
export function handleRemoteResponses(err, cb) {
const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === "/response") {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString(); // convert Buffer to string
    });
    req.on('end', () => {
        cb(parse(body));
        res.end('ok');
    });
}
   
});
server.listen(3000);
}