// Synthetic protocol fixture, not live traffic.
$request.url='https://grpc.biliapi.net/bilibili.app.dynamic.v2.Dynamic/DynAll';
$response.body=new Uint8Array([0,0,0,0,55,10,53,10,51,8,2,26,47,42,45,18,43,10,21,229,133,179,230,179,168,232,167,134,233,162,145,229,142,159,230,160,135,233,162,152,56,100,64,200,1,210,1,12,66,86,49,50,51,52,53,54,55,56,57,48]);
var originalDone=$done;
$done=function(result){
 var data=Array.from(result.body || []);
 var needle=Array.from(unescape(encodeURIComponent('「14%」关注视频原标题')),function(c){return c.charCodeAt(0);});
 var found=data.some(function(_,i){return needle.every(function(b,j){return data[i+j]===b;});});
 originalDone({body:JSON.stringify({data:{items:[{title:found?'「14%」原始视频标题':'FAIL'}]}})});
};
