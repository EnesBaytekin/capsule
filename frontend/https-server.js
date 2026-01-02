const https = require('https');
const fs = require('fs');
const path = require('path');

// Read SSL certificate
const options = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
};

// Serve static files
const app = https.createServer(options, (req, res) => {
  const filePath = path.join(__dirname, 'static', req.url === '/' ? 'index.html' : req.url);
  
  const ext = path.extname(filePath);
  const contentType = ext === '.html' ? 'text/html' :
                     ext === '.css' ? 'text/css' :
                     ext === '.js' ? 'application/javascript' :
                     'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

const PORT = 3443;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend running on https://localhost:${PORT}`);
  console.log(`Access from other machines: https://YOUR_IP:${PORT}`);
});
