const fs=require('fs');
const f=__dirname+'/public/index.html';
let h=fs.readFileSync(f,'utf8');

// Add auth check + user menu at the very start of script
const authCheck=`
// Auth check
var TOKEN=localStorage.getItem('pilot_token');
var USER=JSON.parse(localStorage.getItem('pilot_user')||'null');
if(!TOKEN){window.location.href='/login.html';}

// Add token to all fetch calls
var origFetch=window.fetch;
window.fetch=function(url,opts){
  opts=opts||{};
  opts.headers=opts.headers||{};
  if(typeof opts.headers==='object'&&!(opts.headers instanceof Headers)){
    opts.headers['Authorization']='Bearer '+TOKEN;
  }
  return origFetch(url,opts);
};

function logout(){
  localStorage.removeItem('pilot_token');
  localStorage.removeItem('pilot_user');
  window.location.href='/login.html';
}
`;

// Insert right after <script>
h=h.replace('<script>','<script>\n'+authCheck);

// Add user name + logout to header
h=h.replace(
  'TermuxPilot</div>',
  'TermuxPilot</div><div style="display:flex;align-items:center;gap:8px"><span id="user-name" style="font-size:11px;color:#888"></span><button class="btn btn-sm" onclick="logout()">Logout</button></div'
);

// Add user name display
if(!h.includes('user-name-init')){
  h=h.replace('fp();fe();','if(USER){var un=document.getElementById("user-name");if(un)un.textContent=USER.name||USER.email}/* user-name-init */\nfp();fe();');
}

fs.writeFileSync(f,h,'utf8');
console.log('Auth UI added!');
