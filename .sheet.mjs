import sharp from "sharp"; import fs from "fs";
const [dir, out] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter(f=>f.endsWith(".jpg")).sort();
const tiles = await Promise.all(files.map(async f => {
  const img = await sharp(`${dir}/${f}`).resize(400, 260, {fit:"cover"}).png().toBuffer();
  const label = Buffer.from(`<svg width="400" height="30"><rect width="400" height="30" fill="#000"/><text x="8" y="21" font-size="18" fill="#ff0" font-family="sans-serif">${f}</text></svg>`);
  return sharp({create:{width:400,height:290,channels:3,background:"#000"}}).composite([{input:img,top:0,left:0},{input:label,top:260,left:0}]).png().toBuffer();
}));
const cols = 3, rows = Math.ceil(tiles.length/cols);
await sharp({create:{width:cols*410,height:rows*300,channels:3,background:"#fff"}}).composite(tiles.map((input,i)=>({input,left:(i%cols)*410,top:Math.floor(i/cols)*300}))).png().toFile(out);
