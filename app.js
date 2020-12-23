const fetch = require('node-fetch'),
  cfg = require('./cfg'),
  cheerio = require('cheerio'),
  fs = require('fs'),
  Student = require('./student'),
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
function saveStudentsToFile(fromId, toId, data) {
  writeFile('hcm_' + fromId + '__' + toId + '.json', JSON.stringify(data));
}

async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
function genStudentIdByInt(id) {
  let studentIdPrefix = '020',
    maxLengthStudentId = 5;
  return (
    studentIdPrefix + '0'.repeat(maxLengthStudentId - id.toString().length) + id
  );
}
/**
 * @param {*} totalCount
 * @param {*} qpr : quantity id per range
 * @param {*} timeOutEachId
 * qpr = 200, rangeCount = totalCount/qpr
  // i = 1
  // 1 - 200 i - qpr
  // i = 2
  // 201 - 400 (i-1)+qpr+1 - i*oqr
  // i = 3
  // 401 - 600 (i-1)*qpr+1 - i*qpr
 */
function genRangeId(totalCount, qpr, timeOutEachId) {
  let ranges = [],
    rangeCount = Math.floor(totalCount / qpr);
  for (let i = 1; i < rangeCount; i++) {
    let startId = (i - 1) * qpr + 1,
      endId = i * qpr,
      range = { startId: startId, endId: endId, timeOutEachId: timeOutEachId };
    ranges.push(range);
  }
  // push final range
  ranges.push({
    startId: rangeCount * qpr + 1,
    endId: totalCount,
    timeOutEachId: timeOutEachId,
  });
  return ranges;
}
function genRangeArray(array, qpr) {
  let ranges = [],
    rangeCount = Math.floor(array.length / qpr);
  for (let i = 1; i <= rangeCount; i++) {
    let startId = (i - 1) * qpr + 1,
      endId = i * qpr,
      rangeArray = [];
    for (let j = startId; j < endId; j++) rangeArray.push(array[j]);
    ranges.push(rangeArray);
  }
  log(ranges);
  return ranges;
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
    markJson[removeAccents(mark[0]).replace(/ /, '').toLowerCase()] = +mark[1];
    return markJson;
  });
}

function generateStudentHtmlToJson(htmlBody, id) {
  if (htmlBody && htmlBody.indexOf('Không tìm thấy số báo danh này') <= -1) {
    let $ = cheerio.load(htmlBody);
    let row = $('tr').eq(1);
    let cols = cheerio.load(row.html().trim(), { xmlMode: true })('td');
    let student = {
      id: id,
      name: cols.eq(0).text().trim(),
      date: cols.eq(1).text().trim(),
    };
    let marks = covertMarkArrayToJson(
      convertMarkTextToArray(cols.eq(2).text().trim())
    );
    for (mark of marks) student = { ...student, ...mark };
    return student;
  }
  return { id: id, name: null, date: null };
}

async function fetchGTStudent(id) {
  let url = cfg.hcmUrl + '?sobaodanh=' + id,
    options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    response;
  try {
    response = await fetch(url, options);
    log(`${response.url}: ${response.status}(${response.statusText})`);
    return (await response.text()) || null;
  } catch (error) {
    if (error.name === 'AbortError') log('request was aborted');
    log(error);
    log(`${url}: failed`);
    return null;
  }
}

// Deprecated
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
  return await fetchGTStudent(startStudentId).then(async (student) => {
    students.push(generateStudentHtmlToJson(student, startStudentId));
    startId++;
    if (startId <= endId)
      return await fetchGTStudentsRecursive(
        { startId, endId, timeOutEachId },
        students,
        callback
      );
    else callback({ startId, endId, students });
  });
}

async function fetchGTStudentsRecursiveByIds(startIndexId, Ids, students) {
  await delay(500);
  let startStudentId = Ids[startIndexId];
  return await fetchGTStudent(startStudentId).then(async (student) => {
    students.push(generateStudentHtmlToJson(student, startStudentId));
    if (++startIndexId <= Ids.length)
      return await fetchGTStudentsRecursiveByIds(startIndexId, Ids, students);
    else return students;
  });
}

async function saveStudentsToDbOneRange({ startId, endId, timeOutEachId }) {
  await fetchGTStudentsRecursive(
    { startId, endId, timeOutEachId },
    [],
    async ({ students }) => {
      await Student.insertMany(students);
    }
  );
}
async function saveStudentsToDbByAllRanges(startRangeIndex, ranges, callback) {
  let range = ranges[startRangeIndex];
  log(
    `range[${startRangeIndex}/${ranges.length - 1}]: ${JSON.stringify(range)}`
  );
  await saveStudentsToDbOneRange(range);
  startRangeIndex++;
  if (startRangeIndex < ranges.length)
    await saveStudentsToDbByAllRanges(startRangeIndex, ranges, callback);
  else callback();
}
async function findNullStudents() {
  let studentIds = await Student.fetchStudents({ date: null });
  return studentIds.map((e) => e.id);
}

async function saveStudentAgainOneRange(startIndex, studentIds) {
  let students = await fetchGTStudentsRecursiveByIds(
    startIndex,
    studentIds,
    []
  );
  await Student.insertMany(students);
}
async function saveStudentAgainAllRange(startRangeIndex, ranges, callback) {
  let range = ranges[startRangeIndex];
  log(
    `range[${startRangeIndex}/${ranges.length - 1}]: ${JSON.stringify(range)}`
  );
  await saveStudentAgainOneRange(0, range, []);
  if (++startRangeIndex < ranges.length)
    await saveStudentAgainAllRange(startRangeIndex, ranges, callback);
  else callback();
}

(async () => {
  // let ranges = genRangeId(74718, 10, 0.5);
  // await saveStudentsToDbByAllRanges(105, ranges, () => log('Done All Ranges'));
  writeFile('Student_Null_Data.json', JSON.stringify(await findNullStudents()));
})();
