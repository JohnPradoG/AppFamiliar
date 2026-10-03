const http=require('http'),fs=require('fs'),path=require('path');
const root=process.env.WEB_DIR||path.join(__dirname,'web');
const types={'.js':'text/javascript','.html':'text/html','.png':'image/png','.ico':'image/x-icon','.json':'application/json','.ttf':'font/ttf'};
http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split('?')[0]));
 if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()) f=path.join(root,'index.html');
 r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(8099,()=>console.log('web en 8099'));
