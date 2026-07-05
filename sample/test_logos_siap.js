const https = require('https');
https.get('https://siap.kemensos.go.id/', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
}, (res) => {
  let html = '';
  res.on('data', (c) => html += c);
  res.on('end', () => {
    const regex = /<img[^>]+src=["']([^"']+)["']/gi;
    let match;
    console.log('Matches:');
    while ((match = regex.exec(html)) !== null) {
      console.log(match[1]);
    }
  });
}).on('error', (e) => {
  console.log('Error:', e.message);
});
