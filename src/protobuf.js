import { strToU8,strFromU8,gzipSync,gunzipSync } from 'fflate';
const MAX=3145728;
export function bytes(input) {
  if(input instanceof Uint8Array)return input;
  if(input instanceof ArrayBuffer)return new Uint8Array(input);
  if(ArrayBuffer.isView(input))return new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
  if(Array.isArray(input))return new Uint8Array(input);
  if(typeof input==='string')return Uint8Array.from(input,c=>c.charCodeAt(0)&255);
  throw new Error('BODY');
}
export function concat(parts) {
  const out=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));let offset=0;
  for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
}
export function varint(value) {
  if(!Number.isSafeInteger(value)||value<0)throw new Error('VARINT');
  const out=[];do {let byte=value%128;value=Math.floor(value/128);out.push(byte+(value?128:0));}while(value);return new Uint8Array(out);
}
function readVarint(data,start) {
  let value=0,multiplier=1,offset=start;
  for(let i=0;i<10;i++) {
    if(offset>=data.length)throw new Error('TRUNCATED');
    const byte=data[offset++];value+=(byte&127)*multiplier;
    if(!(byte&128))return {value:Number.isSafeInteger(value)?value:null,offset};
    multiplier*=128;
  }
  throw new Error('VARINT');
}
export function parseMessage(input) {
  const data=bytes(input),fields=[];let offset=0;
  if(data.length>MAX)throw new Error('SIZE');
  while(offset<data.length) {
    if(fields.length>30000)throw new Error('FIELDS');
    const start=offset,tag=readVarint(data,offset);offset=tag.offset;
    if(tag.value===null || tag.value<8)throw new Error('TAG');
    const number=Math.floor(tag.value/8),wire=tag.value%8,field={number,wire};
    if(wire===0){const v=readVarint(data,offset);field.value=v.value;offset=v.offset;}
    else if(wire===1)offset+=8;
    else if(wire===5)offset+=4;
    else if(wire===2) {
      const length=readVarint(data,offset);offset=length.offset;
      if(length.value===null || length.value>MAX)throw new Error('LENGTH');
      field.data=data.subarray(offset,offset+length.value);offset+=length.value;
    } else throw new Error('WIRE');
    if(offset>data.length)throw new Error('TRUNCATED');
    field.raw=data.subarray(start,offset);fields.push(field);
  }
  return {data,fields};
}
export const fields=(message,number)=>message.fields.filter(f=>f.number===number);
export function child(field) {
  if(field.wire!==2)throw new Error('MESSAGE');
  if(!field.child)field.child=parseMessage(field.data);
  return field.child;
}
export function text(message,number) {const f=fields(message,number).find(f=>f.wire===2);return f?strFromU8(f.data):'';}
export function integer(message,number) {return fields(message,number).find(f=>f.wire===0)?.value ?? 0;}
export function setText(message,number,value) {
  const f=fields(message,number).find(f=>f.wire===2);if(!f)throw new Error('TITLE');
  f.data=strToU8(value);f.changed=true;
}
export function serialize(message) {
  let changed=false;const parts=[];
  for(const f of message.fields) {
    const data=f.child?serialize(f.child):f.data;
    if(f.changed || (f.child && data!==f.child.data)) {
      changed=true;parts.push(concat([varint(f.number*8+2),varint(data.length),data]));
    } else parts.push(f.raw);
  }
  return changed?concat(parts):message.data;
}
export function grpcFrames(input) {
  const data=bytes(input);if(data.length>MAX)throw new Error('SIZE');
  const frames=[];let offset=0;
  while(offset<data.length) {
    if(offset+5>data.length)throw new Error('FRAME');
    const start=offset,flag=data[offset++];
    if(![0,1,128].includes(flag))throw new Error('COMPRESSION');
    const length=data[offset]*16777216+data[offset+1]*65536+data[offset+2]*256+data[offset+3];offset+=4;
    if(length>MAX || offset+length>data.length)throw new Error('FRAME');
    const payload=data.subarray(offset,offset+length);offset+=length;
    let decoded=payload;
    if(flag===1) {
      if(payload.length<18 || payload[0]!==31 || payload[1]!==139)throw new Error('GZIP');
      const n=payload.length,expanded=(payload[n-4]+payload[n-3]*256+payload[n-2]*65536+payload[n-1]*16777216);
      if(expanded>MAX)throw new Error('SIZE');decoded=gunzipSync(payload);
    }
    frames.push({flag,payload,decoded,raw:data.subarray(start,offset)});
    if(frames.length>40)throw new Error('FRAMES');
  }
  return frames;
}
export function encodeFrame(data,flag=0) {
  const payload=flag===1?gzipSync(data):data,n=payload.length;
  return concat([new Uint8Array([flag,(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]),payload]);
}
