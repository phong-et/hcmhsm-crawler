const fetch = require('node-fetch'),
  urls = require('./config').fetchUrls,
  Student = require('./student'),
  appendFile = require('./utils').appendFile,
  log = console.log,
  fs = require('fs'),
  delay = ({ second }) => {
    return new Promise((resolve) => setTimeout(resolve, second * 1000));
  },
  headers = {
    'Content-Type': 'application/json',
    Cookie: 'ASP.NET_SessionId=xcuy24jfmk2jnructghd45fr',
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
  fetchStudents = async (id) => {
    log('id=%s', id);
    let response = await fetch(urls.hanoi, {
      method: 'POST',
      body: JSON.stringify({
        SOBAODANH: id,
        ConfirmCode: '3M370',
      }),
      headers: headers,
    });
    let data = await response.json();
    //log(data);
    data = convert(data, id);
    return data;
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
      appendFile('./logs', id);
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
      studentIdPrefix = '010',
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
  saveToDb = async (students) => {
    await Student.insertMany(students);
  },
  readCaptchaImage = () => {
    var tesseract = require('node-tesseract');

    // Recognize text of any language in any format
    tesseract.process(__dirname + '/img/1234.png', function (err, text) {
      if (err) {
        console.error(err);
      } else {
        console.log(text);
      }
    });
  };

(async () => {
  let studentIds = generateStudentId(1, 79236);
  let students = [],
    quantityStudentPerFetch = 20,
    count = 1;
  for (let i = 0; i < studentIds.length; i++) {
    let studentId = studentIds[i];
    let student = await fetchStudents(studentId);
    if (student) {
      students.push(student);
      count++;
    }
    if (count > quantityStudentPerFetch) {
      await saveToDb(students);
      count = 1;
      students = [];
      await delay({ second: 1 });
    }
  }
  // TEST PART
  //   fetchStudents('01000002');
  //   convert(null, 123);
  //   readCaptchaImage();
})();
