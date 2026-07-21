import fs from 'fs';
import https from 'https';

// Create a dummy 1x1 base64 image
const dummyImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function testEdge() {
  try {
    console.log("Sending request to edge function...");
    const response = await fetch('https://ksbivaolyusmrcblnnfe.supabase.co/functions/v1/analyze-theme', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imagesBase64: [dummyImage],
        temasCadastrados: [{nome: "Festa Teste", apelidos: []}]
      })
    });

    const text = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, text);
  } catch(e) {
    console.error("Fetch error:", e);
  }
}
testEdge();
