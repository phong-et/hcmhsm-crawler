const fetch = require('node-fetch'),
  cfg = require('./cfg'),
  cheerio = require('cheerio'),
  fs = require('fs'),
  log = console.log;

function removeAccents(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}
async function writeFile(fileName, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, content, function (err) {
      if (err) reject(err);
      var statusText = 'write file > ' + fileName + ' success';
      log(statusText);
      resolve(true);
    });
  });
}

async function fetchGTStudent(id) {
  let url = cfg.hcmUrl,
    options = {
      method: 'post',
      body: JSON.stringify({
        sobaodanh: id,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
    response = await fetch(url, options);
  log(`${response.url}: ${response.status}(${response.statusText})`);
  return (await response.text()) || null;
}
async function fetchGTStudents({ startId, endId }) {
  let students = [],
    studentIds = [];
  for (let id = startId; id <= endId; id++) {
    studentIds.push(genStudentIdByInt(id));
  }
  await Promise.all(
    studentIds.map(async (studentId) => {
      await delay(1000);
      students.push(
        generateStudentHtmlToJson(await fetchGTStudent(studentId), studentId)
      );
    })
  );
  writeFile(
    'hcm_' + startId + '__' + endId + '.json',
    JSON.stringify(students)
  );
}
async function fetchGTStudentsRecursive(
  { startId, endId, timeOutEachId },
  students,
  callback
) {
  let startStudentId = genStudentIdByInt(startId);
  await delay(timeOutEachId * 1000);
  return fetchGTStudent(startStudentId).then((student) => {
    students.push(generateStudentHtmlToJson(student, startStudentId));
    startId++;
    if (startId <= endId) {
      return fetchGTStudentsRecursive(
        { startId, endId, timeOutEachId },
        students,
        callback
      );
    } else {
      callback({ startId, endId, students });
    }
  });
}
async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function generateStudentHtmlToJson(htmlBody, id) {
  if (htmlBody && htmlBody.indexOf('Không tìm thấy số báo danh này') <= -1) {
    let $ = cheerio.load(htmlBody);
    let row = $('tr').eq(1);
    let cols = cheerio.load(row.html().trim(), { xmlMode: true })('td');
    let student = {
      Id: id,
      Name: cols.eq(0).text().trim(),
      Date: cols.eq(1).text().trim(),
    };
    let marks = covertMarkArrayToJson(
      convertMarkTextToArray(cols.eq(2).text().trim())
    );
    //log(marks)
    for (mark of marks) student = { ...student, ...mark };
    log(student);
    return student;
  }
  return { Id: id, Name: null, Date: null };
}

function genStudentIdByInt(id) {
  let studentIdPrefix = '020',
    maxLengthStudentId = 5;
  return (
    studentIdPrefix + '0'.repeat(maxLengthStudentId - id.toString().length) + id
  );
}

function convertMarkTextToArray(markText) {
  markText = markText.replace(/KHXH: /g, 'KHXH:   ');
  markText = markText.replace(/KHTN: /g, 'KHTN:   ');
  markText = markText.replace(/:   /g, '__');
  return markText.split('   ');
}

function covertMarkArrayToJson(markArray) {
  return markArray.map((mark) => {
    mark = mark.split('__');
    let markJson = {};
    markJson[removeAccents(mark[0]).replace(/ /, '')] = +mark[1];
    return markJson;
  });
}

(async () => {
  // await fetchGTStudents({ startId: 1, endId: 200 });
  // await delay(20000)
  //await fetchGTStudents({ startId: 201, endId: 400 });
  // var seconds = [ 0, 1, 2, 3, 4, 5, 0.5, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 6,7 ],
  // randomSeconds = () => seconds[Math.floor(Math.random() * seconds.length)];
  let pageRange = { startId: 901, endId: 1200, timeOutEachId: 0.1 };
  fetchGTStudentsRecursive(
    //{ startId: 601, endId: 603, timeOutEachId: 0.1 },
    pageRange,
    [],
    ({ startId, endId, students }) => {
      log(students);
      writeFile(
        'hcm_' + startId + '__' + endId + '.json',
        JSON.stringify(students)
      );
    }
  );
})();
