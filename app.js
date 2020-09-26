const student = require('./student');

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

  let studentIds = [
    '02000521',
    '02001618',
    '02001704',
    '02002149',
    '02002689',
    '02002715',
    '02002774',
    '02002776',
    '02002833',
    '02003543',
    '02004049',
    '02005380',
    '02005472',
    '02005733',
    '02005820',
    '02005876',
    '02005878',
    '02006091',
    '02006300',
    '02006364',
    '02006544',
    '02006702',
    '02006712',
    '02006720',
    '02006904',
    '02007169',
    '02007538',
    '02008348',
    '02008351',
    '02008533',
    '02008746',
    '02009196',
    '02009333',
    '02009487',
    '02009886',
    '02010368',
    '02011847',
    '02012257',
    '02012416',
    '02012486',
    '02012503',
    '02012813',
    '02013806',
    '02014744',
    '02015268',
    '02015319',
    '02015894',
    '02016088',
    '02016098',
    '02016574',
    '02016689',
    '02017242',
    '02017801',
    '02017991',
    '02018970',
    '02019028',
    '02019207',
    '02019349',
    '02019593',
    '02019734',
    '02020755',
    '02021009',
    '02021090',
    '02021260',
    '02021365',
    '02022215',
    '02023170',
    '02023599',
    '02023894',
    '02023934',
    '02024069',
    '02024181',
    '02024422',
    '02024536',
    '02024818',
    '02025161',
    '02025377',
    '02025757',
    '02026107',
    '02026343',
    '02026830',
    '02026891',
    '02027212',
    '02028274',
    '02028332',
    '02028433',
    '02028564',
    '02028976',
    '02029062',
    '02029604',
    '02030245',
    '02030495',
    '02030688',
    '02030947',
    '02031588',
    '02031948',
    '02033312',
    '02033762',
    '02035264',
    '02035434',
    '02036046',
    '02036693',
    '02036798',
    '02038448',
    '02039160',
    '02039228',
    '02039582',
    '02039898',
    '02039958',
    '02041490',
    '02042067',
    '02042111',
    '02042343',
    '02042972',
    '02043577',
    '02044668',
    '02045413',
    '02046017',
    '02046177',
    '02046223',
    '02046483',
    '02046496',
    '02046619',
    '02046651',
    '02046766',
    '02046788',
    '02046810',
    '02046841',
    '02046998',
    '02047031',
    '02047122',
    '02047241',
    '02047273',
    '02047304',
    '02047486',
    '02047505',
    '02047594',
    '02047636',
    '02047843',
    '02047856',
    '02047865',
    '02048225',
    '02048271',
    '02048279',
    '02048397',
    '02048424',
    '02048427',
    '02048592',
    '02048660',
    '02048701',
    '02048723',
    '02048793',
    '02048858',
    '02049007',
    '02049069',
    '02049090',
    '02049104',
    '02049164',
    '02049234',
    '02049312',
    '02049383',
    '02049663',
    '02049763',
    '02049775',
    '02049891',
    '02049971',
    '02050378',
    '02050476',
    '02050488',
    '02050516',
    '02050526',
    '02050540',
    '02050576',
    '02050642',
    '02050649',
    '02050685',
    '02050722',
    '02050814',
    '02050899',
    '02050959',
    '02050969',
    '02050978',
    '02050984',
    '02050985',
    '02051006',
    '02051072',
    '02051181',
    '02051191',
    '02051422',
    '02051468',
    '02051472',
    '02051495',
    '02051616',
    '02051674',
    '02051736',
    '02051911',
    '02052013',
    '02052030',
    '02052089',
    '02052314',
    '02052373',
    '02052516',
    '02052591',
    '02052663',
    '02052711',
    '02052791',
    '02052856',
    '02053000',
    '02053106',
    '02053259',
    '02053593',
    '02053699',
    '02053809',
    '02053860',
    '02054235',
    '02054306',
    '02054374',
    '02054508',
    '02054541',
    '02054733',
    '02054767',
    '02055119',
    '02055200',
    '02055290',
    '02055296',
    '02055606',
    '02055683',
    '02055788',
    '02055803',
    '02055829',
    '02055912',
    '02055930',
    '02055986',
    '02055994',
    '02056020',
    '02056032',
    '02056105',
    '02056139',
    '02056186',
    '02056190',
    '02056238',
    '02056273',
    '02056291',
    '02056298',
    '02056333',
    '02056350',
    '02056377',
    '02056393',
    '02056735',
    '02056782',
    '02056823',
    '02056865',
    '02056871',
    '02057014',
    '02057294',
    '02057316',
    '02057410',
    '02057496',
    '02057608',
    '02057996',
    '02058404',
    '02058429',
    '02058498',
    '02058518',
    '02058938',
    '02059095',
    '02059513',
    '02059740',
    '02059751',
    '02059769',
    '02059774',
    '02059807',
    '02059852',
    '02060031',
    '02060462',
    '02060492',
    '02060536',
    '02060610',
    '02060652',
    '02060656',
    '02060660',
    '02060730',
    '02060738',
    '02060987',
    '02061413',
    '02061813',
    '02062212',
    '02062236',
    '02062391',
    '02062440',
    '02062898',
    '02063109',
    '02063112',
    '02063114',
    '02063179',
    '02063180',
    '02063181',
    '02063207',
    '02063272',
    '02063632',
    '02063653',
    '02063707',
    '02063716',
    '02063752',
    '02063754',
    '02063767',
    '02063825',
    '02064256',
    '02064369',
    '02064704',
    '02064783',
    '02064860',
    '02064990',
    '02065104',
    '02065323',
    '02065429',
    '02065604',
    '02065877',
    '02065995',
    '02066106',
    '02066212',
    '02066835',
    '02066893',
    '02067172',
    '02067291',
    '02067316',
    '02067371',
    '02067383',
    '02067401',
    '02067446',
    '02067467',
    '02067550',
    '02067563',
    '02067659',
    '02067672',
    '02067698',
    '02067762',
    '02067909',
    '02067971',
    '02067996',
    '02068119',
    '02068156',
    '02068174',
    '02068178',
    '02068243',
    '02068287',
    '02068365',
    '02068382',
    '02068427',
    '02068453',
    '02068548',
    '02068550',
    '02068627',
    '02068667',
    '02068702',
    '02068732',
    '02068846',
    '02068970',
    '02069028',
    '02069043',
    '02069066',
    '02069156',
    '02069290',
    '02069362',
    '02069397',
    '02069843',
    '02069990',
    '02070203',
    '02070765',
    '02070870',
    '02070923',
    '02071102',
    '02071574',
    '02071606',
    '02071834',
    '02071920',
    '02072480',
    '02072549',
    '02072755',
    '02072823',
    '02073036',
    '02073372',
    '02073378',
    '02073477',
    '02073556',
    '02073719',
    '02073903',
    '02073964',
    '02074135',
    '02074254',
    '02074281',
    '02074367',
    '02074525',
    '02074607',
  ];
  // let ranges = genRangeArray(studentIds, 10)
  // await saveStudentAgainAllRange(14, ranges, ()=>log('done'))
    saveStudentAgainOneRange(0, [
      '02074281',
      '02074367',
      '02074525',
      '02074607',
    ]);
})();
