import fs from 'fs';
import https from 'https';

async function run() {
  const imageUrl = 'https://img.freepik.com/fotos-gratis/festa-de-aniversario-safari-em-casa_23-2149591465.jpg'; // Safari party
  const imgRes = await fetch(imageUrl);
  const arrayBuffer = await imgRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  
  // NOTE: You must provide a valid API key to test directly, but since I don't have it,
  // I will just modify the edge function.
}
run();
