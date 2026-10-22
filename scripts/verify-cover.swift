import Foundation
import JavaScriptCore
import ImageIO

// Local fixture only: verifies the shipped JS bundle in Apple's JSCore.
let context = JSContext()!
var finished = false
var failure: String?
var timerID: Int32 = 0
var timers: [Int32: DispatchWorkItem] = [:]
let setTimer: @convention(block) (JSValue?, Double) -> Int32 = { callback, milliseconds in
    timerID += 1
    let identifier = timerID
    let item = DispatchWorkItem {
        timers.removeValue(forKey: identifier)
        _ = callback?.call(withArguments: [])
    }
    timers[identifier] = item
    DispatchQueue.main.asyncAfter(deadline: .now() + milliseconds / 1000, execute: item)
    return identifier
}
let clearTimer: @convention(block) (Int32) -> Void = { identifier in
    timers.removeValue(forKey: identifier)?.cancel()
}
let done: @convention(block) (JSValue?) -> Void = { value in
    defer { finished = true }
    guard let body=value?.forProperty("body"),body.isObject else {failure="No JPEG body";return}
    let count=Int(body.forProperty("length").toInt32());var bytes=Data(capacity:count)
    for i in 0..<count {bytes.append(UInt8(truncatingIfNeeded:body.atIndex(i).toInt32()))}
    guard let src=CGImageSourceCreateWithData(bytes as CFData,nil),let image=CGImageSourceCreateImageAtIndex(src,0,nil),image.width==480,image.height==854 else {failure="Invalid JPEG or aspect ratio";return}
    try? bytes.write(to:URL(fileURLWithPath:"xcode-probe/Xcode-BoundCover-9x16.jpg"))
    print("PASS | Apple JavaScriptCore | bound video/subtitle fixtures → AI JPEG | 480x854")
}
context.exceptionHandler = { _, exception in failure = exception?.toString() ?? "JS exception"; finished = true }
context.setObject(setTimer, forKeyedSubscript: "setTimeout" as NSString)
context.setObject(clearTimer, forKeyedSubscript: "clearTimeout" as NSString)
context.setObject(done, forKeyedSubscript: "$done" as NSString)
_ = context.evaluateScript(#"""
var console={log:function(){}};
var $request={url:'https://app.bilibili.com/x/v2/feed/index'};
var $response={body:JSON.stringify({code:0,data:{items:[{goto:'av',param:'100',title:'原始视频标题'}]}}),headers:{}};
var $argument='key=fixture-not-a-real-key';
var $persistentStore={values:{},read:function(k){return this.values[k]||null;},write:function(v,k){this.values[k]=v;return true;}};
$persistentStore.write(JSON.stringify({cookie:'SESSDATA=fixture',until:Date.now()+86400000}),'noaitext.ios.v1.session');
function mock(request,callback){
 var payload;
 if(request.url.indexOf('/x/web-interface/view')>=0)payload={code:0,data:{aid:100,bvid:'BV1234567890',pages:[{cid:200}]}};
 else if(request.url.indexOf('/x/web-interface/nav')>=0)payload={code:0,data:{isLogin:true,wbi_img:{img_url:'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',sub_url:'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png'}}};
 else if(request.url.indexOf('/x/player/wbi/v2')>=0)payload={code:0,data:{aid:100,cid:200,subtitle:{subtitles:[{lan:'ai-zh',subtitle_url:'https://aisubtitle.hdslb.com/bfs/subtitle/fixture.json'}]}}};
 else if(request.url.indexOf('/bfs/subtitle/')>=0)payload={body:[{content:'仅供本地模拟接口与标题测试的字幕，不是实际视频的检测结果。'.repeat(5)}]};
 else payload={choices:[{finish_reason:'stop',message:{content:'{"score":0.14}'}}]};
 callback(null,{status:200},JSON.stringify(payload));
}
var $httpClient={get:mock,post:mock};
"""#)
// Run the actual shipped list and image-request stages before the AI cover stage.
_ = context.evaluateScript("$response.body=JSON.stringify({code:0,data:{items:[{goto:'vertical_av',param:'100',player_args:{cid:200},title:'原始视频标题',cover:'https://i0.hdslb.com/bfs/archive/fixture.jpg'}]}}); var finalDone=$done; $done=function(r){globalThis.listResult=r;};")
let root="dist/NoAIText-iOS-Cover-0.3.2/Script/"
_ = context.evaluateScript(try String(contentsOfFile:root+"NoAIText.CoverList.js",encoding:.utf8))
_ = context.evaluateScript("if(!listResult.body)throw new Error('List failed'); $request={url:JSON.parse(listResult.body).data.items[0].cover+'@480w_854h_1c.webp'}; delete globalThis.$response; $done=function(r){globalThis.imageRequest=r;};")
_ = context.evaluateScript(try String(contentsOfFile:root+"NoAIText.CoverRequest.js",encoding:.utf8))
let imageBytes=try String(contentsOfFile:"scripts/cover-bytes-fixture.json",encoding:.utf8)
_ = context.evaluateScript("$request=imageRequest;$response={body:new Uint8Array("+imageBytes+"),headers:{}};$done=finalDone;")
_ = context.evaluateScript(try String(contentsOfFile:root+"NoAIText.Cover.js",encoding:.utf8))
let deadline = Date().addingTimeInterval(5)
while !finished && Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.02)) }
if let failure { print("FAIL | \(failure)"); exit(1) }
if !finished { print("FAIL | harness timeout"); exit(1) }
