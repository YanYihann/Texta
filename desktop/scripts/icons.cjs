const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const target = path.join(__dirname, '../assets');
  await fs.mkdir(target, { recursive: true });
  const png = await sharp(path.join(__dirname, '../../public/favicon.svg')).resize(256, 256).png().toBuffer();
  await fs.writeFile(path.join(target, 'icon.png'), png);
  // ICO supports an embedded 256px PNG image.
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  await fs.writeFile(path.join(target, 'icon.ico'), Buffer.concat([header, png]));
})().catch(error => { console.error(error); process.exitCode = 1; });
