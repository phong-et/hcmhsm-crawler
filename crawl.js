module.exports = (city) => {
  const fetch = require('node-fetch'),
    fs = require('fs'),
    QUANTITY_STUDENT_PER_FETCH = 5,
    YEAR = 2020,
    config = require('./config').cities[city],
    Student = require('./student')(city),
    appendFile = require('./utils').appendFile,
    log = console.log,
    delay = ({ second }) => {
      return new Promise((resolve) => setTimeout(resolve, second * 1000));
    },
    studentFields = Object.keys(Student.schema.paths).filter(
      (field) => field !== '_id' && field !== '__v'
    ),
    removeAccents = (str) => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
    },
    fetchStudents = async (id, { cookie, captchaCode }) => {
      let url = config.url;
      log('id=%s', id);
      try {
        let response = await fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            SOBAODANH: id,
            ConfirmCode: captchaCode,
          }),
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
        });

        let json = await response.text();
        //log(json);
        //let data = await response.json();
        let data = await JSON.parse(json);
        data = convert(data, id);
        return data;
      } catch (error) {
        log(error);
        if (error.message.indexOf(url) > -1) {
          log('Fetch again id=%s', id);
          delay({ second: 1 });
          fetchStudents(id, { cookie, captchaCode });
        }
      }
    },
    convert = (data, id) => {
      // ===> Template response data
      // data = {
      //   HO_TEN: '',
      //   SOBAODANH: '',
      //   DIEM_THI:
      //     'Toán:   1.80   Ngữ văn:   6.50   Lịch sử:   4.25   Địa lí:   6.50   GDCD:   6.50   KHXH: 5.75   Tiếng Anh:   3.20   ',
      //   NGAY_SINH: '',
      //   GIOI_TINH: '',
      //   CMND: '',
      // };

      let student = {};
      if (data.Message && data.Message === 'Không tìm thấy thí sinh') {
        appendFile('./log/' + city + '.txt', id);
        log(id);
        log(data);
        student = null;
      } else {
        let rawMarks = data.DIEM_THI.trim().replace(/:   /g, ':').split('   ');
        rawMarks.forEach((mark) => {
          mark = mark.split(':');
          let m = {};
          m[removeAccents(mark[0]).replace(/ /g, '').toLowerCase()] = +mark[1];
          student = { ...student, ...m };
        });
        studentFields.forEach((field) => {
          switch (field) {
            case 'id':
              student[field] = id;
              break;
            case 'cmnd':
              student[field] = data.CMND || '';
              break;
            case 'name':
              student[field] = data.HO_TEN || '';
              break;
            case 'year':
              student[field] = YEAR;
              break;
            case 'date':
              student[field] = data.NGAY_SINH || '';
              break;
            case 'gender':
              student[field] = data.GIOI_TINH
                ? data.GIOI_TINH === 'Nam'
                  ? 1
                  : 0
                : -1;
              break;
            case 'city':
              student[field] = config.cityId;
              break;
            default:
              student[field] = student[field] || -1;
              break;
          }
        });
      }
      //log(student);
      return student;
    },
    generateStudentId = (from, to) => {
      let studentIds = [],
        cityId = config.cityId,
        studentIdPrefix = cityId <= 9 ? '0' + cityId : cityId;
      for (let i = from; i <= to; i++) {
        // 0.[00000] = 6 so 0, max = 99.000 => use 5
        studentIds.push(
          studentIdPrefix + '0'.repeat(6 - i.toString().length) + i
        );
      }
      return studentIds;
    },
    toCsvHeader = (csvFile) => {
      fs.writeFile(
        './' + csvFile,
        studentFields.toString() + '\r\n',
        'utf8',
        (err) => (err ? log(err) : log(csvFile))
      );
    },
    toCsvBody = (body, csvFile) => {
      let csv = [];
      body.forEach((student) => {
        let line = '';
        studentFields.forEach((field) => {
          line += student[field] + ',';
        });
        csv.push(line);
      });
      appendFile('./' + csvFile, csv.join('\r\n'), 'utf8', (err) =>
        err ? log(err) : log(csvFile)
      );
    },
    run = async ({
      cookie,
      captchaCode,
      startId = 1,
      endId = config.endId,
      qSPF = QUANTITY_STUDENT_PER_FETCH,
    }) => {
      let fetchStudentConfig = {
        cookie: 'ASP.NET_SessionId=' + cookie,
        captchaCode: captchaCode,
      };
      //log(fetchStudentConfig);
      //log(await fetchStudents('03000001', fetchStudentConfig));
      let studentIds = generateStudentId(startId, endId);
      let students = [],
        count = 1,
        csvFile = './csv/' + city + '.csv';
      if (startId === 1) toCsvHeader(csvFile);
      for (let i = 0; i < studentIds.length; i++) {
        let studentId = studentIds[i];
        let student = await fetchStudents(studentId, fetchStudentConfig);
        if (student) {
          students.push(student);
          count++;
        }
        if (count > qSPF || i === studentIds.length - 1) {
          await Student.insertMany(students);
          toCsvBody(students, csvFile);
          count = 1;
          students = [];
          await delay({ second: 1 });
        }
      }
    };
  return { run };
};

(async () => {
  const { program } = require('commander');
  program
    .version('0.0.1', '-v, --vers', 'output the current version')
    .option('-d, --debug', 'output extra debugging')
    .option('-c, --cookie <value>', 'cookie of config.url')
    .option('-s, --start-id <value>', 'start id student')
    .option('-e, --end-id <value>', 'end id student')
    .option('-q, --quantity-student-per-fetch <value>', 'end id student')
    .option(
      '-code, --captcha-code <value>',
      'captcha code of config.url and cookie'
    );
  program.parse(process.argv);
  let city = process.argv[2],
    cookie = program.cookie,
    captchaCode = program.captchaCode,
    startId = program.startId,
    endId = program.endId,
    qSPF = program.quantityStudentPerFetch;
  if (city)
    require('./crawl')(city).run({ cookie, captchaCode, startId, endId, qSPF });
  else console.log('You miss out city param');
})();
