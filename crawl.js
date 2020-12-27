module.exports = (city) => {
  const fetch = require('node-fetch'),
    config = require('./config').cities[city],
    Student = require('./student')(city),
    appendFile = require('./utils').appendFile,
    log = console.log;
  log(city);
  let delay = ({ second }) => {
      return new Promise((resolve) => setTimeout(resolve, second * 1000));
    },
    studentFields = [
      'id',
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
        log(await response.text());
        let data = await response.json();

        data = convert(data, id);
        return data;
      } catch (error) {
        log(error);
        if (error.message.indexOf(url) > -1) {
          // log('Fetch again id=%s', id);
          // delay({ second: 1 });
          // fetchStudents(id);
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

      let marks = {};
      if (data.Message && data.Message === 'Không tìm thấy thí sinh') {
        appendFile('./logs_' + city + '.txt', id);
        log(id);
        log(data);
        marks = null;
      } else {
        let rawMarks = data.DIEM_THI.trim().replace(/:   /g, ':').split('   ');
        rawMarks.forEach((mark) => {
          mark = mark.split(':');
          let m = {};
          m[removeAccents(mark[0]).replace(/ /g, '').toLowerCase()] = +mark[1];
          marks = { ...marks, ...m };
        });
        studentFields.forEach((field) => {
          switch (field) {
            case 'id':
              marks[field] = id;
              break;
            case 'name':
            case 'date':
              marks[field] = '';
              break;
            case 'gender':
              marks[field] = -1;
              break;
            case 'city':
              marks[field] = 1;
              break;
            default:
              marks[field] = marks[field] || -1;
              break;
          }
        });
      }
      return marks;
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
    run = async () => {
      let fetchStudentConfig = {
        cookie: 'ASP.NET_SessionId=dbm5wl4trksdakalwqfanxlg',
        captchaCode: 'yoNDd',
      };
      fetchStudents('03000001', fetchStudentConfig);
      //   log(config);
      //   let studentIds = generateStudentId(61758, 79236);
      //   let students = [],
      //     quantityStudentPerFetch = 15,
      //     count = 1;
      //   for (let i = 0; i < studentIds.length; i++) {
      //     let studentId = studentIds[i];
      //     let student = await fetchStudents(studentId, fetchStudentConfig);
      //     if (student) {
      //       students.push(student);
      //       count++;
      //     }
      //     if (count > quantityStudentPerFetch) {
      //       await Student.insertMany(students);
      //       count = 1;
      //       students = [];
      //       await delay({ second: 1 });
      //     }
      //   }
    };
  return { run };
  //run();
};

(async () => {
  require('./crawl')(process.argv[2] || 'undefined').run();
})();
