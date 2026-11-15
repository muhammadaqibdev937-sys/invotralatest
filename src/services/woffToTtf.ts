/**
 * Unpacks a WOFF 1.0 binary buffer into an SFNT (TrueType / OpenType) binary
 * using the browser-native DecompressionStream API so @fontsource .woff files
 * can be embedded directly into jsPDF vector PDFs with zero extra dependencies.
 */
async function inflateZlib(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser does not support native font decompression for vector PDFs.');
  }
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(compressed));
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLen += value.byteLength;
    }
  }

  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return out;
}

export async function unpackWoff1ToTtf(woffBytes: Uint8Array): Promise<Uint8Array> {
  const view = new DataView(woffBytes.buffer, woffBytes.byteOffset, woffBytes.byteLength);
  const signature = view.getUint32(0);
  if (signature !== 0x774f4646) {
    throw new Error('Font asset is not a valid WOFF 1.0 binary.');
  }

  const flavor = view.getUint32(4);
  const numTables = view.getUint16(12);

  interface TableEntry {
    tag: Uint8Array;
    origChecksum: number;
    data: Uint8Array;
  }

  const tables: TableEntry[] = [];
  let offset = 44;

  for (let i = 0; i < numTables; i++) {
    const tag = woffBytes.slice(offset, offset + 4);
    const srcOffset = view.getUint32(offset + 4);
    const compLen = view.getUint32(offset + 8);
    const origLen = view.getUint32(offset + 12);
    const origChecksum = view.getUint32(offset + 16);
    offset += 20;

    const raw = woffBytes.slice(srcOffset, srcOffset + compLen);
    const data = compLen < origLen ? await inflateZlib(raw) : raw;
    tables.push({ tag, origChecksum, data });
  }

  const headerSize = 12 + numTables * 16;
  let totalSize = headerSize;
  for (const t of tables) {
    totalSize += (t.data.length + 3) & ~3;
  }

  const out = new Uint8Array(totalSize);
  const outView = new DataView(out.buffer);

  outView.setUint32(0, flavor);
  outView.setUint16(4, numTables);

  let maxPow2 = 1;
  let entrySelector = 0;
  while (maxPow2 * 2 <= numTables) {
    maxPow2 *= 2;
    entrySelector++;
  }
  const searchRange = maxPow2 * 16;
  outView.setUint16(6, searchRange);
  outView.setUint16(8, entrySelector);
  outView.setUint16(10, numTables * 16 - searchRange);

  let dirOffset = 12;
  let dataOffset = headerSize;

  for (const t of tables) {
    out.set(t.tag, dirOffset);
    outView.setUint32(dirOffset + 4, t.origChecksum);
    outView.setUint32(dirOffset + 8, dataOffset);
    outView.setUint32(dirOffset + 12, t.data.length);
    dirOffset += 16;

    out.set(t.data, dataOffset);
    dataOffset += (t.data.length + 3) & ~3;
  }

  return out;
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
