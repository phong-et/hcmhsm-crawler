const fs = require('fs'),
  log = console.log;
function appendFile(fileName, content) {
  return new Promise((resolve, reject) => {
    fs.appendFile(fileName, content + '\r\n', function (err) {
      if (err) reject(err);
      var statusText = 'write file > ' + fileName + ' success';
      log(statusText);
      resolve();
    });
  });
}
module.exports = { appendFile };
