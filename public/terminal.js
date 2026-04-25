(function(){
  var timer=null;
  var busy=false;

  async function poll(){
    if(busy)return;
    var tid=window.tid;
    if(!tid)return;
    busy=true;
    try{
      var r=await fetch('/api/terminal/'+tid+'/output',{headers:{'Authorization':'Bearer '+window.TK}});
      var d=await r.json();
      if(d.output&&d.output.length){
        var o=document.getElementById('out');
        if(!o){busy=false;return}
        // Remove all active prompt inputs temporarily
        var active=o.querySelector('.pr input');
        var activeRow=active?active.closest('.pr'):null;
        if(activeRow)o.removeChild(activeRow);
        // Add output lines
        d.output.forEach(function(item){
          (item.text||'').replace(/\x1b\[[0-9;]*[a-zA-Z]/g,'').split('\n').forEach(function(line){
            if(!line.trim())return;
            var div=document.createElement('div');
            div.className='ln'+(item.type==='stderr'?' err':'');
            div.textContent=line;
            o.appendChild(div)})});
        // Put prompt back
        if(activeRow)o.appendChild(activeRow);
        o.scrollTop=o.scrollHeight;
        // Focus input
        var inp=o.querySelector('.pr input');
        if(inp)inp.focus()}
    }catch(e){}
    busy=false}

  document.addEventListener('DOMContentLoaded',function(){
    setTimeout(function(){timer=setInterval(poll,800)},2500);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')poll()});
    window.addEventListener('focus',poll)})
})();
