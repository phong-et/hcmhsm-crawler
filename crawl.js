module.exports = (city) => {
  const fetch = require('node-fetch'),
    config = require('./config').cities[city],
    Student = require('./student')(city),
    appendFile = require('./utils').appendFile,
    log = console.log,
    delay = ({ second }) => {
      return new Promise((resolve) => setTimeout(resolve, second * 1000));
    },
    studentFields = [
      'id',
      'cmnd',
      'name',
      'date',
      'city',
      'gender',
      'gdcd',
      'nguvan',
      'lichsu',
      'diali',
      'toan',
      'vatli',
      'hoahoc',
      'sinhhoc',
      'tienganh',
      'tiengnga',
      'tiengduc',
      'tiengphap',
      'tiengtrung',
      'tiengnhat',
      'khxh',
      'khtn',
    ],
    //studentFields = Object.keys(Student.schema.paths),

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
        log(json);
        //let data = await response.json();
        let data = await JSON.parse(json);
        data = convert(data, id);
        return data;
      } catch (error) {
        log(error);
        if (error.message.indexOf(url) > -1) {
          log('Fetch again id=%s', id);
          delay({ second: 1 });
          fetchStudents(id);
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
        appendFile('./logs_' + city + '.txt', id);
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
            case 'name':
              student[field] = data.HO_TEN || '';
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
      return student;
    },
    generateStudentId = (from, to) => {
      let studentIds = [],
        studentIdPrefix = config.prefixId,
        maxLengthStudentId = 5;
      for (let i = from; i < to; i++) {
        studentIds.push(
          studentIdPrefix +
            '0'.repeat(maxLengthStudentId - i.toString().length) +
            i
        );
      }
      return studentIds;
    },
    run = async ({ cookie, captchaCode }) => {
      let fetchStudentConfig = {
        cookie: 'ASP.NET_SessionId=' + cookie,
        captchaCode: captchaCode,
      };
      //log(fetchStudentConfig);
      //log(await fetchStudents('03000001', fetchStudentConfig));
      let studentIds = generateStudentId(1, 79236);
      let students = [],
        quantityStudentPerFetch = 5,
        count = 1;
      for (let i = 0; i < studentIds.length; i++) {
        let studentId = studentIds[i];
        let student = await fetchStudents(studentId, fetchStudentConfig);
        if (student) {
          students.push(student);
          count++;
        }
        if (count > quantityStudentPerFetch) {
          await Student.insertMany(students);
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
    .option(
      '-code, --captcha-code <value>',
      'captcha code of config.url and cookie'
    );
  program.parse(process.argv);
  let city = process.argv[2],
    cookie = program.cookie,
    captchaCode = program.captchaCode;
  if (city) require('./crawl')(city).run({ cookie, captchaCode });
  else console.log('You miss out city param');
})();
