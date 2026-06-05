import fs from 'fs';
import path from 'path';

async function testUpload() {
  const dummyText = "Hello World";
  const blob = new Blob([dummyText], { type: 'text/plain' });
  
  const form = new FormData();
  form.append('file', blob, 'test.txt');

  const res = await fetch('https://api.ssbwithisv.in/api/uploadBatteryImage', {
    method: 'POST',
    headers: {
      'token': 'mock-token' // Will fail auth but we want to see if the payload is accepted
    },
    body: form
  });

  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}

testUpload();
