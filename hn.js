const fetch = require('node-fetch'),
  urls = require('./config').fetchUrls,
  Student = require('./student'),
  log = console.log,
  delay = ({ second }) => {
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
  fetchStudents = async (id) => {
    log('id=%s', id);
    let response = await fetch(urls.hanoi, {
      method: 'POST',
      body: JSON.stringify({
        SOBAODANH: id,
        ConfirmCode: 'N48uG',
      }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'ASP.NET_SessionId=e4ip5lq1goxa3x1k1bgmwmik',
      },
    });
    let data = await response.json();
    data = convert(data, id);
    return data;
  },
  convert = (data, id) => {
    // data = {
    //   HO_TEN: '',
    //   SOBAODANH: '',
    //   DIEM_THI:
    //     'Toán:   1.80   Ngữ văn:   6.50   Lịch sử:   4.25   Địa lí:   6.50   GDCD:   6.50   KHXH: 5.75   Tiếng Anh:   3.20   ',
    //   NGAY_SINH: '',
    //   GIOI_TINH: '',
    //   CMND: '',
    // };
    //log(data);
    let rawMarks = data.DIEM_THI.trim().replace(/:   /g, ':').split('   ');
    let marks = {};
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
  for (let i = 0; i < studentIds.length; i++) {
    let studentId = studentIds[i];
    let student = await fetchStudents(studentId);
    await saveToDb(student);
    await delay({ second: 1 });
  }
  // TEST PART
  //   fetchStudents('01000002');
  //   convert(null, 123);
  //   readCaptchaImage();
})();
