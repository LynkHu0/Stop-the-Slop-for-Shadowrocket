import jpeg from 'jpeg-js';

const FONT = {
  "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  "N": ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],

  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
};

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return new Uint8Array(value);
  if (typeof value === 'string') {
    const result = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) result[i] = value.charCodeAt(i) & 255;
    return result;
  }
  throw new Error('Unsupported response body');
}

export function drawTestBadge(image, text = 'TEST', color = [64,224,139]) {
  const { data, width, height } = image;
  const scale = Math.max(1,Math.round(width / 240));
  const pad = scale * 4;
  const left = Math.min(10,scale * 5);
  const top = Math.min(10,scale * 5);
  const label = [...text];
  const boxWidth = label.length * 6 * scale - scale + pad * 2;
  const boxHeight = 7 * scale + pad * 2;
  if (left + boxWidth >= width || top + boxHeight >= height) throw new Error('Cover is too small');

  for (let y = top; y < top + boxHeight; y++) {
    for (let x = left; x < left + boxWidth; x++) {
      const p = (y * width + x) * 4;
      data[p] = 18;
      data[p + 1] = 22;
      data[p + 2] = 31;
      data[p + 3] = 255;
    }
  }
  for (let n = 0; n < label.length; n++) {
    const glyph = FONT[label[n]] || FONT['-'];
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy][gx] !== '1') continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const x = left + pad + n * 6 * scale + gx * scale + sx;
            const y = top + pad + gy * scale + sy;
            const p = (y * width + x) * 4;
            data[p] = color[0];
            data[p + 1] = color[1];
            data[p + 2] = color[2];
            data[p + 3] = 255;
          }
        }
      }
    }
  }
  return image;
}

// Inspect JPEG frame headers before spending an API call on an unsupported image.
export function supportedJpeg(input) {
  const bytes = asBytes(input);
  if (bytes.length > 800000 || bytes[0] !== 255 || bytes[1] !== 216) return false;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 255) return false;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 217 || marker === 218) return false;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (offset + 2 > bytes.length) return false;
    const length = bytes[offset] * 256 + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return false;
    if ([192, 193, 194].includes(marker)) {
      if (length < 8) return false;
      const height = bytes[offset + 3] * 256 + bytes[offset + 4];
      const width = bytes[offset + 5] * 256 + bytes[offset + 6];
      return width >= 80 && width <= 800 && height >= 50 && height <= 1200 && width * height <= 480000;
    }
    offset += length;
  }
  return false;
}

export function rewriteJpeg(input, label = 'TEST', color) {
  const bytes = asBytes(input);
  if (bytes.length > 800000 || bytes[0] !== 255 || bytes[1] !== 216) return null;
  const image = jpeg.decode(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: 1,
    maxMemoryUsageInMB: 16,
    tolerantDecoding: false,
  });
  if (image.width > 800 || image.height > 1200 || image.width * image.height > 480000 || image.width < 80 || image.height < 50) return null;
  drawTestBadge(image, label, color);
  return jpeg.encode({ data: image.data, width: image.width, height: image.height }, 82).data;
}

