import fs from 'fs';
import https from 'https';

async function run() {
  // A simple 1x1 red pixel jpeg image
  const base64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  
  console.log("Sending to Edge Function...");
  const response = await fetch('https://ksbivaolyusmrcblnnfe.supabase.co/functions/v1/analyze-theme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imagesBase64: [base64],
      temasCadastrados: []
    })
  });
  
  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Response:", text);
}
run();
