const http = require("http");
const s = http.createServer((q,r) => {
  r.writeHead(200, {"Content-Type":"text/html"});
  r.end("<h1>CodeDeck Preview Works</h1>");
});
s.listen(4000, () => console.log("Running on port 4000"));
