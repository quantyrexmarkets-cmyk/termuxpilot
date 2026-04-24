const fs=require('fs');
const f=__dirname+'/src/server.js';
let s=fs.readFileSync(f,'utf8');

// Fix middleware order - static files must come before auth
s=s.replace(
`app.use(express.json());
app.use(auth.middleware);
app.use(express.static(path.join(__dirname, '..', 'public')));`,
`app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(auth.middleware);`
);

fs.writeFileSync(f,s,'utf8');
console.log('Order fixed!');
