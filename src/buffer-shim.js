// jpeg-js encoder's browser build uses only these byte-array operations.
export const Buffer = {
  from: value => new Uint8Array(value),
  alloc: size => new Uint8Array(size),
};
