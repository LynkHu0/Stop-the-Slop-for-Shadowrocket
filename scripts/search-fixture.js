// Synthetic protocol fixture, not live traffic.
$request.url='https://grpc.biliapi.net/bilibili.polymer.app.search.v1.Search/SearchAll';
$response.body=new Uint8Array([0,0,0,0,59,34,57,10,20,98,105,108,105,98,105,108,105,58,47,47,118,105,100,101,111,47,49,48,48,18,3,49,48,48,26,2,97,118,170,2,23,10,21,230,144,156,231,180,162,232,167,134,233,162,145,229,142,159,230,160,135,233,162,152]);
var originalDone=$done;
$done=function(result){
 var data=Array.from(result.body || []);
 var needle=Array.from(unescape(encodeURIComponent('「14%」搜索视频原标题')),function(c){return c.charCodeAt(0);});
 var found=data.some(function(_,i){return needle.every(function(b,j){return data[i+j]===b;});});
 originalDone({body:JSON.stringify({data:{items:[{title:found?'「14%」原始视频标题':'FAIL'}]}})});
};
