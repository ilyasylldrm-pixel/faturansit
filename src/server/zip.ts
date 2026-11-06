import { inflateRawSync } from 'node:zlib';

/** First file inside a ZIP (store or deflate). */
export function firstZipFile(zip: Buffer): Buffer | null {
  let offset = 0;
  while (offset + 30 <= zip.length) {
    if (zip.readUInt32LE(offset) !== 0x04034b50) break;
    const method = zip.readUInt16LE(offset + 8);
    const compSize = zip.readUInt32LE(offset + 18);
    const nameLen = zip.readUInt16LE(offset + 26);
    const extraLen = zip.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = zip.subarray(nameStart, nameStart + nameLen).toString('utf8');
    const dataStart = nameStart + nameLen + extraLen;
    const compressed = zip.subarray(dataStart, dataStart + compSize);
    const next = dataStart + compSize;
    if (!name.endsWith('/')) {
      if (method === 0) return Buffer.from(compressed);
      if (method === 8) return inflateRawSync(compressed);
    }
    offset = next;
  }
  return null;
}

export function bytesLookLikePdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 4).toString('utf8') === '%PDF';
}
