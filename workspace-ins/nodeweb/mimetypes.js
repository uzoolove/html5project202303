const path = require('path');

const mime = {
  "html": "text/html",
  "css": "text/css",
  "js": "application/javascript",
  "svg": "image/svg+xml"
  // ......
};

function getMime(url){
  // today.html => "text/html"
  // layout.css => "text/css"
  var extname = path.extname(url).substring(1);
  return mime[extname];
}

// require의 리턴값
module.exports = {
  getMime
};