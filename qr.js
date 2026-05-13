/* Minimal QR Code encoder — byte mode, ECC level M, auto version 1-10.
   Based on the QR Code Model 2 spec (ISO/IEC 18004).
   Project Nayuki's algorithm — public domain re-implementation.
   Exposes: window.QR.svg(text, opts) -> string with inline SVG.
*/
(function(){
'use strict';

/* GF(256) tables (primitive polynomial 0x11D) */
var EXP = new Uint8Array(256), LOG = new Uint8Array(256);
(function(){ var x=1; for (var i=0;i<255;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if(x&0x100) x^=0x11D; } EXP[255]=EXP[0]; })();

function gfMul(a,b){ return (a===0||b===0)?0:EXP[(LOG[a]+LOG[b])%255]; }

function rsGenPoly(deg){
  var p = [1];
  for (var i=0;i<deg;i++){
    var np = new Array(p.length+1);
    for (var j=0;j<np.length;j++) np[j]=0;
    for (var j=0;j<p.length;j++){
      np[j] ^= gfMul(p[j],1);
      np[j+1] ^= gfMul(p[j], EXP[i]);
    }
    p = np;
  }
  return p;
}

function rsEncode(data, ecLen){
  var gen = rsGenPoly(ecLen);
  var res = new Array(ecLen);
  for (var i=0;i<ecLen;i++) res[i]=0;
  for (var i=0;i<data.length;i++){
    var factor = data[i] ^ res[0];
    res.shift(); res.push(0);
    if (factor !== 0){
      for (var j=0;j<gen.length-1;j++){
        res[j] ^= gfMul(gen[j+1], factor);
      }
    }
  }
  return res;
}

/* Capacity tables for byte mode, ECC=M, version 1-10
   data codewords (after subtracting EC) */
var BYTE_CAP_M = [14,26,42,62,84,106,122,152,180,213]; // bytes for versions 1..10

/* Total codewords per version, version 1..10 */
var TOTAL_CW = [26,44,70,100,134,172,196,242,292,346];

/* Number of EC blocks and per-block EC codewords for ECC=M, version 1..10 */
/* Format: [ecCodewordsPerBlock, [group1Blocks, group1DataCodewords], [group2Blocks, group2DataCodewords]] */
var ECC_M = {
  1:  {ec:10, g1:[1,16], g2:[0,0]},
  2:  {ec:16, g1:[1,28], g2:[0,0]},
  3:  {ec:26, g1:[1,44], g2:[0,0]},
  4:  {ec:18, g1:[2,32], g2:[0,0]},
  5:  {ec:24, g1:[2,43], g2:[0,0]},
  6:  {ec:16, g1:[4,27], g2:[0,0]},
  7:  {ec:18, g1:[4,31], g2:[0,0]},
  8:  {ec:22, g1:[2,38], g2:[2,39]},
  9:  {ec:22, g1:[3,36], g2:[2,37]},
  10: {ec:26, g1:[4,43], g2:[1,44]}
};

/* Alignment pattern positions per version */
var ALIGN_POS = {
  1:[], 2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30],
  6:[6,34], 7:[6,22,38], 8:[6,24,42], 9:[6,26,46], 10:[6,28,50]
};

function pickVersion(byteLen){
  for (var v=1; v<=10; v++) if (byteLen <= BYTE_CAP_M[v-1]) return v;
  throw new Error('QR: data too long ('+byteLen+' bytes)');
}

function encodeText(text){
  // UTF-8 encode
  var bytes = [];
  for (var i=0;i<text.length;i++){
    var c = text.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800){ bytes.push(0xC0|(c>>6)); bytes.push(0x80|(c&0x3F)); }
    else if (c < 0xD800 || c >= 0xE000){
      bytes.push(0xE0|(c>>12)); bytes.push(0x80|((c>>6)&0x3F)); bytes.push(0x80|(c&0x3F));
    } else {
      i++;
      var c2 = text.charCodeAt(i);
      var cp = 0x10000 + (((c & 0x3FF)<<10) | (c2 & 0x3FF));
      bytes.push(0xF0|(cp>>18)); bytes.push(0x80|((cp>>12)&0x3F));
      bytes.push(0x80|((cp>>6)&0x3F)); bytes.push(0x80|(cp&0x3F));
    }
  }
  return bytes;
}

/* BitBuffer */
function BitBuf(){ this.bits = []; }
BitBuf.prototype.put = function(val, len){
  for (var i=len-1;i>=0;i--) this.bits.push((val>>i)&1);
};

function buildCodewords(data, version){
  var bb = new BitBuf();
  // Mode byte = 0100
  bb.put(4, 4);
  // Character count: version 1-9 = 8 bits, 10+ = 16 bits
  bb.put(data.length, version < 10 ? 8 : 16);
  // Data bytes
  for (var i=0;i<data.length;i++) bb.put(data[i], 8);

  var info = ECC_M[version];
  var totalDataBits = (TOTAL_CW[version-1] - info.ec * (info.g1[0]+info.g2[0])) * 8;

  // Terminator (up to 4 zero bits, but don't exceed capacity)
  var pad = Math.min(4, totalDataBits - bb.bits.length);
  for (var i=0;i<pad;i++) bb.bits.push(0);
  // Pad to byte boundary
  while (bb.bits.length % 8 !== 0) bb.bits.push(0);
  // Pad bytes (alternating 0xEC, 0x11)
  var padBytes = [0xEC, 0x11];
  var idx = 0;
  while (bb.bits.length < totalDataBits){
    var b = padBytes[idx++ % 2];
    for (var i=7;i>=0;i--) bb.bits.push((b>>i)&1);
  }

  // Convert to bytes
  var allData = [];
  for (var i=0;i<bb.bits.length;i+=8){
    var b = 0;
    for (var j=0;j<8;j++) b = (b<<1) | bb.bits[i+j];
    allData.push(b);
  }
  return allData;
}

function interleave(dataCw, version){
  var info = ECC_M[version];
  var totalBlocks = info.g1[0] + info.g2[0];
  var blocks = [];
  var off = 0;
  for (var i=0;i<info.g1[0];i++){
    blocks.push(dataCw.slice(off, off+info.g1[1]));
    off += info.g1[1];
  }
  for (var i=0;i<info.g2[0];i++){
    blocks.push(dataCw.slice(off, off+info.g2[1]));
    off += info.g2[1];
  }
  // Compute EC per block
  var ecBlocks = blocks.map(function(b){ return rsEncode(b, info.ec); });
  // Interleave data
  var maxDataLen = Math.max.apply(null, blocks.map(function(b){return b.length;}));
  var interleaved = [];
  for (var i=0;i<maxDataLen;i++){
    for (var j=0;j<blocks.length;j++){
      if (i < blocks[j].length) interleaved.push(blocks[j][i]);
    }
  }
  for (var i=0;i<info.ec;i++){
    for (var j=0;j<ecBlocks.length;j++){
      interleaved.push(ecBlocks[j][i]);
    }
  }
  return interleaved;
}

function buildMatrix(version, cwBits){
  var size = 17 + 4*version;
  var m = []; var rs = []; // reserved (function patterns)
  for (var y=0;y<size;y++){
    m[y] = new Int8Array(size); rs[y] = new Uint8Array(size);
    for (var x=0;x<size;x++) m[y][x] = -1;
  }
  function setReserved(x,y){ rs[y][x] = 1; }
  function place(x,y,val){ m[y][x] = val; setReserved(x,y); }
  function placeFinder(x,y){
    for (var dy=-1; dy<=7; dy++){
      for (var dx=-1; dx<=7; dx++){
        var xx=x+dx, yy=y+dy;
        if (xx<0||yy<0||xx>=size||yy>=size) continue;
        var v;
        if ((dx>=0&&dx<=6) && (dy>=0&&dy<=6)){
          // 7x7 finder
          var on = (dx===0||dx===6||dy===0||dy===6) || (dx>=2&&dx<=4&&dy>=2&&dy<=4);
          v = on?1:0;
        } else {
          v = 0; // separator
        }
        place(xx,yy,v);
      }
    }
  }
  placeFinder(0,0); placeFinder(size-7,0); placeFinder(0,size-7);

  // Timing patterns
  for (var i=8;i<size-8;i++){
    place(i,6, i%2===0 ? 1 : 0);
    place(6,i, i%2===0 ? 1 : 0);
  }
  // Dark module
  place(8, size-8, 1);

  // Alignment patterns
  var pos = ALIGN_POS[version];
  for (var i=0;i<pos.length;i++){
    for (var j=0;j<pos.length;j++){
      var cx = pos[i], cy = pos[j];
      // skip overlaps with finder
      if ((cx<=8&&cy<=8) || (cx<=8&&cy>=size-9) || (cx>=size-9&&cy<=8)) continue;
      for (var dy=-2;dy<=2;dy++){
        for (var dx=-2;dx<=2;dx++){
          var on = (Math.max(Math.abs(dx),Math.abs(dy))!==1);
          place(cx+dx, cy+dy, on?1:0);
        }
      }
    }
  }

  // Reserve format info
  for (var i=0;i<=8;i++){ setReserved(i,8); setReserved(8,i); }
  for (var i=0;i<8;i++){ setReserved(size-1-i,8); setReserved(8,size-1-i); }

  // Place data bits with zigzag
  var bitIdx = 0;
  var totalBits = cwBits.length;
  function getBit(i){ return cwBits[i] ? 1 : 0; }
  var upward = true;
  for (var x=size-1; x>0; x-=2){
    if (x===6) x--; // skip vertical timing column
    for (var k=0; k<size; k++){
      var y = upward ? (size-1-k) : k;
      for (var dx=0; dx<2; dx++){
        var xx = x - dx;
        if (rs[y][xx] === 0){
          var bit = bitIdx<totalBits ? getBit(bitIdx) : 0;
          m[y][xx] = bit;
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }
  return {m:m, size:size, rs:rs};
}

function applyMask(m, size, rs, mask){
  var out = [];
  for (var y=0;y<size;y++){ out[y]=new Int8Array(size); for (var x=0;x<size;x++) out[y][x]=m[y][x]; }
  var maskFn = [
    function(x,y){return (x+y)%2===0;},
    function(x,y){return y%2===0;},
    function(x,y){return x%3===0;},
    function(x,y){return (x+y)%3===0;},
    function(x,y){return (Math.floor(y/2)+Math.floor(x/3))%2===0;},
    function(x,y){return (x*y)%2 + (x*y)%3 === 0;},
    function(x,y){return ((x*y)%2 + (x*y)%3)%2 === 0;},
    function(x,y){return ((x+y)%2 + (x*y)%3)%2 === 0;}
  ][mask];
  for (var y=0;y<size;y++){
    for (var x=0;x<size;x++){
      if (rs[y][x] === 0 && maskFn(x,y)) out[y][x] = 1 - out[y][x];
    }
  }
  return out;
}

function placeFormat(m, size, ecLevel, mask){
  // ecLevel: M=00. But QR format uses M=0 (00), L=1 (01), H=2 (10), Q=3 (11)
  var ecBits = 0; // M
  var data = (ecBits << 3) | mask;
  // BCH (15,5) with generator 0x537
  var bch = data << 10;
  var g = 0x537;
  for (var i=14;i>=10;i--) if ((bch>>i)&1) bch ^= g << (i-10);
  var fmt = ((data << 10) | bch) ^ 0x5412;

  function setBit(x,y,bit){ m[y][x] = bit; }
  // Top-left
  for (var i=0;i<6;i++) setBit(8,i,(fmt>>i)&1);
  setBit(8,7,(fmt>>6)&1);
  setBit(8,8,(fmt>>7)&1);
  setBit(7,8,(fmt>>8)&1);
  for (var i=9;i<15;i++) setBit(14-i,8,(fmt>>i)&1);
  // Bottom-left + top-right
  for (var i=0;i<8;i++) setBit(size-1-i, 8, (fmt>>i)&1);
  for (var i=8;i<15;i++) setBit(8, size-15+i, (fmt>>i)&1);
}

function scoreMask(m, size){
  // Standard QR penalty scoring
  var s = 0;
  // Rule 1: runs of 5+ same color
  for (var y=0;y<size;y++){
    var run=1;
    for (var x=1;x<size;x++){
      if (m[y][x]===m[y][x-1]){ run++; if (run===5) s+=3; else if (run>5) s++; }
      else run=1;
    }
  }
  for (var x=0;x<size;x++){
    var run=1;
    for (var y=1;y<size;y++){
      if (m[y][x]===m[y-1][x]){ run++; if (run===5) s+=3; else if (run>5) s++; }
      else run=1;
    }
  }
  // Rule 2: 2x2 blocks
  for (var y=0;y<size-1;y++) for (var x=0;x<size-1;x++){
    var v=m[y][x]; if (v===m[y][x+1]&&v===m[y+1][x]&&v===m[y+1][x+1]) s+=3;
  }
  // Rule 3: finder-like patterns (simplified)
  // Skip for compactness — affects quality slightly but acceptable
  // Rule 4: ratio of dark/light
  var dark = 0, total = size*size;
  for (var y=0;y<size;y++) for (var x=0;x<size;x++) if (m[y][x]===1) dark++;
  var ratio = dark*100/total;
  s += Math.floor(Math.abs(ratio - 50)/5) * 10;
  return s;
}

function encode(text){
  var data = encodeText(text);
  var version = pickVersion(data.length);
  var cwBytes = buildCodewords(data, version);
  var interleaved = interleave(cwBytes, version);
  // To bits
  var bits = [];
  for (var i=0;i<interleaved.length;i++){
    for (var b=7;b>=0;b--) bits.push((interleaved[i]>>b)&1);
  }
  // Remainder bits to fill
  var size = 17 + 4*version;
  var totalModules = size*size;
  var reservedModules = 64*3 + 5 + 1 + 2*(size-16); // approximate
  // Build matrix
  var built = buildMatrix(version, bits);
  // Try all 8 masks
  var best = null, bestScore = Infinity;
  for (var mask=0; mask<8; mask++){
    var masked = applyMask(built.m, built.size, built.rs, mask);
    placeFormat(masked, built.size, 'M', mask);
    var sc = scoreMask(masked, built.size);
    if (sc < bestScore){ bestScore = sc; best = {m:masked, mask:mask, size:built.size}; }
  }
  return best;
}

function toSVG(text, opts){
  opts = opts || {};
  var quiet = opts.quiet !== undefined ? opts.quiet : 4;
  var fg = opts.fg || '#000';
  var bg = opts.bg || '#fff';
  var qr = encode(text);
  var size = qr.size;
  var total = size + 2*quiet;
  var path = '';
  for (var y=0;y<size;y++){
    for (var x=0;x<size;x++){
      if (qr.m[y][x] === 1){
        var px = x + quiet, py = y + quiet;
        path += 'M'+px+','+py+'h1v1h-1z';
      }
    }
  }
  return '<svg viewBox="0 0 '+total+' '+total+'" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">'+
    '<rect width="100%" height="100%" fill="'+bg+'"/>'+
    '<path d="'+path+'" fill="'+fg+'"/></svg>';
}

window.QR = { svg: toSVG, encode: encode };

})();
