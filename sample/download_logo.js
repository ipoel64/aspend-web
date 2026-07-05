const https = require('https');
const fs = require('fs');

const url = 'https://pkh.kemensos.go.id/logo.webp';

function download() {
  console.log('Trying: ' + url);
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };
  https.get(url, options, (res) => {
    console.log('Status:', res.statusCode);
    if (res.statusCode !== 200) {
      console.log('Failed to download');
      return;
    }
    const data = [];
    res.on('data', (c) => data.push(c));
    res.on('end', () => {
      const buf = Buffer.concat(data);
      console.log('Success! Size:', buf.length);
      fs.writeFileSync('logo_base64.txt', buf.toString('base64'));
      console.log('Saved to logo_base64.txt');
    });
  }).on('error', (e) => {
    console.log('Error:', e.message);
  });
}

download();
