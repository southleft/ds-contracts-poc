export type PortableUtf8Implementation =
  "native-text-decoder" | "strict-rfc3629-fallback";

export interface PortableUtf8Result {
  value: string;
  implementation: PortableUtf8Implementation;
}

const continuation = (value: number | undefined): value is number =>
  value !== undefined && value >= 0x80 && value <= 0xbf;

/**
 * Decodes exactly the Unicode scalar values admitted by RFC 3629. Invalid
 * bytes are named and refused; no replacement-character path exists.
 */
export function decodeRfc3629Utf8(
  bytes: Uint8Array,
  errorName = "STRICT-UTF8",
): string {
  let result = "";
  for (let index = 0; index < bytes.length;) {
    const start = index;
    const first = bytes[index++]!;
    let point: number;
    if (first <= 0x7f) {
      point = first;
    } else if (first >= 0xc2 && first <= 0xdf) {
      if (index >= bytes.length)
        throw new TypeError(`${errorName}:TRUNCATED@${start}`);
      const second = bytes[index++];
      if (!continuation(second))
        throw new TypeError(`${errorName}:CONTINUATION@${start}`);
      point = ((first & 0x1f) << 6) | (second & 0x3f);
    } else if (first >= 0xe0 && first <= 0xef) {
      if (index + 1 >= bytes.length)
        throw new TypeError(`${errorName}:TRUNCATED@${start}`);
      const second = bytes[index++];
      const third = bytes[index++];
      if (!continuation(second) || !continuation(third))
        throw new TypeError(`${errorName}:CONTINUATION@${start}`);
      if (first === 0xe0 && second < 0xa0)
        throw new TypeError(`${errorName}:OVERLONG@${start}`);
      if (first === 0xed && second > 0x9f)
        throw new TypeError(`${errorName}:SURROGATE@${start}`);
      point = ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f);
    } else if (first >= 0xf0 && first <= 0xf4) {
      if (index + 2 >= bytes.length)
        throw new TypeError(`${errorName}:TRUNCATED@${start}`);
      const second = bytes[index++];
      const third = bytes[index++];
      const fourth = bytes[index++];
      if (
        !continuation(second) ||
        !continuation(third) ||
        !continuation(fourth)
      )
        throw new TypeError(`${errorName}:CONTINUATION@${start}`);
      if (first === 0xf0 && second < 0x90)
        throw new TypeError(`${errorName}:OVERLONG@${start}`);
      if (first === 0xf4 && second > 0x8f)
        throw new TypeError(`${errorName}:OUT-OF-RANGE@${start}`);
      point =
        ((first & 0x07) << 18) |
        ((second & 0x3f) << 12) |
        ((third & 0x3f) << 6) |
        (fourth & 0x3f);
    } else {
      const reason =
        first === 0xc0 || first === 0xc1
          ? "OVERLONG"
          : first >= 0xf5
            ? "OUT-OF-RANGE"
            : "LEAD-BYTE";
      throw new TypeError(`${errorName}:${reason}@${start}`);
    }
    if (point <= 0xffff) {
      result += String.fromCharCode(point);
    } else {
      point -= 0x10000;
      result += String.fromCharCode(
        0xd800 + (point >> 10),
        0xdc00 + (point & 0x3ff),
      );
    }
  }
  return result;
}

export const FIGMA_RUNTIME_API_AUDIT = {
  artifactVersion: "figma-runtime-api-audit-v1",
  requiredEcmaBuiltins: [
    "Array",
    "DataView",
    "JSON",
    "Map",
    "Math.imul",
    "Object.entries",
    "Object.fromEntries",
    "Promise",
    "Set",
    "String.fromCharCode",
    "Uint8Array",
    "Uint32Array",
    "eval",
  ],
  webApis: {
    TextDecoder:
      "optional; selected only after fatal-mode conformance probes and exact fallback equality",
    TextEncoder: "not used",
    atob: "not used; strict portable base64 decoder",
    btoa: "not used",
    crypto: "not used; audited portable SHA-256",
    subtle: "not used; audited portable SHA-256",
    structuredClone: "not used",
    Buffer: "host-only; never emitted into Figma runtime",
    CompressionStream: "not used",
    DecompressionStream: "not used",
    fetch: "not used",
    URL: "not used",
    Blob: "not used",
    FileReader: "not used",
  },
} as const;

export const FIGMA_PORTABLE_RUNTIME = String.raw`
const runtimeUtf8Continuation=value=>value!==undefined&&value>=128&&value<=191;
const runtimeStrictUtf8=(bytes,errorName="STRICT-UTF8")=>{
  let result="";
  for(let index=0;index<bytes.length;){
    const start=index,first=bytes[index++];
    let point;
    if(first<=127){point=first;}
    else if(first>=194&&first<=223){
      if(index>=bytes.length)throw new TypeError(errorName+":TRUNCATED@"+start);
      const second=bytes[index++];
      if(!runtimeUtf8Continuation(second))throw new TypeError(errorName+":CONTINUATION@"+start);
      point=((first&31)<<6)|(second&63);
    }else if(first>=224&&first<=239){
      if(index+1>=bytes.length)throw new TypeError(errorName+":TRUNCATED@"+start);
      const second=bytes[index++],third=bytes[index++];
      if(!runtimeUtf8Continuation(second)||!runtimeUtf8Continuation(third))throw new TypeError(errorName+":CONTINUATION@"+start);
      if(first===224&&second<160)throw new TypeError(errorName+":OVERLONG@"+start);
      if(first===237&&second>159)throw new TypeError(errorName+":SURROGATE@"+start);
      point=((first&15)<<12)|((second&63)<<6)|(third&63);
    }else if(first>=240&&first<=244){
      if(index+2>=bytes.length)throw new TypeError(errorName+":TRUNCATED@"+start);
      const second=bytes[index++],third=bytes[index++],fourth=bytes[index++];
      if(!runtimeUtf8Continuation(second)||!runtimeUtf8Continuation(third)||!runtimeUtf8Continuation(fourth))throw new TypeError(errorName+":CONTINUATION@"+start);
      if(first===240&&second<144)throw new TypeError(errorName+":OVERLONG@"+start);
      if(first===244&&second>143)throw new TypeError(errorName+":OUT-OF-RANGE@"+start);
      point=((first&7)<<18)|((second&63)<<12)|((third&63)<<6)|(fourth&63);
    }else{
      const reason=first===192||first===193?"OVERLONG":first>=245?"OUT-OF-RANGE":"LEAD-BYTE";
      throw new TypeError(errorName+":"+reason+"@"+start);
    }
    if(point<=65535)result+=String.fromCharCode(point);
    else{point-=65536;result+=String.fromCharCode(55296+(point>>10),56320+(point&1023));}
  }
  return result;
};
const runtimeUtf8InvalidProbes=[
  [192,128],
  [224,128,128],
  [237,160,128],
  [240,128,128,128],
  [244,144,128,128],
  [226,130],
  [226,40,161],
  [128],
];
const runtimeDecodeUtf8=(bytes,errorName="STRICT-UTF8")=>{
  const fallback=runtimeStrictUtf8(bytes,errorName);
  const NativeDecoder=globalThis.TextDecoder;
  if(typeof NativeDecoder!=="function")return{value:fallback,implementation:"strict-rfc3629-fallback"};
  try{
    const decoder=new NativeDecoder("utf-8",{fatal:true});
    if(!decoder||typeof decoder.decode!=="function")return{value:fallback,implementation:"strict-rfc3629-fallback"};
    const validProbe=new Uint8Array([0,65,194,162,226,130,172,240,159,152,128]);
    if(decoder.decode(validProbe)!=="\0A¢€😀")return{value:fallback,implementation:"strict-rfc3629-fallback"};
    for(const probe of runtimeUtf8InvalidProbes){
      let refused=false;
      try{decoder.decode(new Uint8Array(probe));}catch{refused=true;}
      if(!refused)return{value:fallback,implementation:"strict-rfc3629-fallback"};
    }
    const nativeValue=decoder.decode(bytes);
    if(nativeValue===fallback)return{value:nativeValue,implementation:"native-text-decoder"};
  }catch{}
  return{value:fallback,implementation:"strict-rfc3629-fallback"};
};
const runtimeBase64Value=character=>{
  const code=character.charCodeAt(0);
  if(code>=65&&code<=90)return code-65;
  if(code>=97&&code<=122)return code-71;
  if(code>=48&&code<=57)return code+4;
  if(character==="+")return 62;
  if(character==="/")return 63;
  return-1;
};
const runtimeDecodeBase64=value=>{
  if(typeof value!=="string"||!(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).test(value))throw new Error("PORTABLE-BASE64:INVALID");
  const padding=value.endsWith("==")?2:value.endsWith("=")?1:0;
  const output=new Uint8Array(value.length/4*3-padding);
  let outputIndex=0;
  for(let index=0;index<value.length;index+=4){
    const a=runtimeBase64Value(value[index]),b=runtimeBase64Value(value[index+1]),c=value[index+2]==="="?0:runtimeBase64Value(value[index+2]),d=value[index+3]==="="?0:runtimeBase64Value(value[index+3]);
    if(a<0||b<0||c<0||d<0)throw new Error("PORTABLE-BASE64:INVALID");
    if(index+4===value.length&&((padding===2&&(b&15)!==0)||(padding===1&&(c&3)!==0)))throw new Error("PORTABLE-BASE64:NONCANONICAL");
    const bits=(a<<18)|(b<<12)|(c<<6)|d;
    if(outputIndex<output.length)output[outputIndex++]=(bits>>>16)&255;
    if(outputIndex<output.length)output[outputIndex++]=(bits>>>8)&255;
    if(outputIndex<output.length)output[outputIndex++]=bits&255;
  }
  return output;
};
const runtimeSha256=bytes=>{
  const K=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
  const h=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];
  const length=bytes.length,padded=new Uint8Array(Math.ceil((length+9)/64)*64);
  padded.set(bytes);padded[length]=128;
  const bitLength=length*8,view=new DataView(padded.buffer);
  view.setUint32(padded.length-8,Math.floor(bitLength/4294967296));view.setUint32(padded.length-4,bitLength>>>0);
  const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let offset=0;offset<padded.length;offset+=64){
    const w=new Uint32Array(64);
    for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=rotr(a,7)^rotr(a,18)^(a>>>3),s1=rotr(b,17)^rotr(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
    let [a,b,c,d,e,f,g,q]=h;
    for(let i=0;i<64;i++){const s1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^((~e)&g),t1=(q+s1+ch+K[i]+w[i])>>>0,s0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&b)^(a&c)^(b&c),t2=(s0+maj)>>>0;q=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    h[0]=(h[0]+a)>>>0;h[1]=(h[1]+b)>>>0;h[2]=(h[2]+c)>>>0;h[3]=(h[3]+d)>>>0;h[4]=(h[4]+e)>>>0;h[5]=(h[5]+f)>>>0;h[6]=(h[6]+g)>>>0;h[7]=(h[7]+q)>>>0;
  }
  return h.map(value=>value.toString(16).padStart(8,"0")).join("");
};
const runtimePreflight=()=>{
  const missing=[];
  if(typeof Array==="undefined")missing.push("Array");
  if(typeof DataView==="undefined")missing.push("DataView");
  if(typeof JSON==="undefined")missing.push("JSON");
  if(typeof Map==="undefined")missing.push("Map");
  if(typeof Math==="undefined")missing.push("Math");
  if(typeof Object==="undefined")missing.push("Object");
  if(typeof Promise==="undefined")missing.push("Promise");
  if(typeof Set==="undefined")missing.push("Set");
  if(typeof String==="undefined")missing.push("String");
  if(typeof Uint8Array==="undefined")missing.push("Uint8Array");
  if(typeof Uint32Array==="undefined")missing.push("Uint32Array");
  if(typeof Object!=="undefined"&&typeof Object.entries!=="function")missing.push("Object.entries");
  if(typeof Object!=="undefined"&&typeof Object.fromEntries!=="function")missing.push("Object.fromEntries");
  if(typeof Math!=="undefined"&&typeof Math.imul!=="function")missing.push("Math.imul");
  if(typeof eval!=="function")missing.push("eval");
  if(missing.length>0)throw new Error("FIGMA-RUNTIME-UNSUPPORTED:"+missing.join(","));
  if(runtimeStrictUtf8(new Uint8Array([0,65,194,162,226,130,172,240,159,152,128]))!=="\0A¢€😀")throw new Error("FIGMA-RUNTIME-UTF8-CONFORMANCE");
  if(runtimeStrictUtf8(runtimeDecodeBase64("AGFiYw=="))!=="\0abc")throw new Error("FIGMA-RUNTIME-BASE64-CONFORMANCE");
  if(runtimeSha256(new Uint8Array([97,98,99]))!=="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")throw new Error("FIGMA-RUNTIME-SHA256-CONFORMANCE");
  return{portableBase64:true,portableSha256:true,strictUtf8:true,unsupportedDependencies:[]};
};`;
