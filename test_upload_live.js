async function testUpload() {
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  let body = '';
  body += '--' + boundary + '\r\n';
  body += 'Content-Disposition: form-data; name="files"; filename="test_dummy.pdf"\r\n';
  body += 'Content-Type: application/pdf\r\n\r\n';
  body += 'Dummy PDF content\r\n';
  body += '--' + boundary + '--\r\n';

  try {
    const res = await fetch('https://psych.ssbwithisv.in/api/submissions/6a225f79c72ad5b153429203/piq', {
      method: 'POST',
      headers: {
        'token': 'mock-student',
        'Content-Type': 'multipart/form-data; boundary=' + boundary
      },
      body: body
    });
    
    const text = await res.text();
    console.log("HTTP STATUS:", res.status);
    console.log("RESPONSE DATA:", text.substring(0, 500));
  } catch (error) {
    console.log("FETCH ERROR:", error);
  }
}

testUpload();
