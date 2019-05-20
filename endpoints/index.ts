const http = require('http');
export function handleRemoteResponses(err, cb) {
const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === "/response") {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString(); // convert Buffer to string
    });
    req.on('end', () => {
        res.end('ok');
        cb(JSON.parse(body));
    });
}
   
});
server.listen(3000);
}