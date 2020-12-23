//baotayninh.vn/ket-qua-diem-thi-thpt-tay-ninh.html?tensbd=&cumthi=&p=1

const fetch = require('node-fetch'),
  cfg = require('./cfg'),
  cheerio = require('cheerio'),
  fs = require('fs'),
  Student = require('./student'),
  log = console.log,
  delay = ({ second }) => {
    return new Promise((resolve) => setTimeout(resolve, second * 1000));
  },
  fetchTayNinhStudents = async (pageNumber) => {
    log('page= %s', pageNumber);
    let response = await fetch(
      'https://baotayninh.vn/ket-qua-diem-thi-thpt-tay-ninh.html?tensbd=&cumthi=&p=' +
        pageNumber
    );
    let htmlBody = await response.text();
    return convertHtmlToJson(htmlBody);
  },
  convertHtmlToJson = (html) => {
    let $ = cheerio.load(html),
      markTable = $('.table-striped').eq(0),
      markTableStudent = cheerio.load(markTable.html(), { xmlMode: true })(
        'tr'
      ),
      names = [];
    markTableStudent.contents().map((i, el) => {
      if (el.type === 'comment') {
        names.push(el.data.substring(5, el.data.length - 6));
      }
    });
    names.shift();
    //log(names);
    // tr 1,2 are title
    // log(markTableStudent.eq(0).text());
    // log(markTableStudent.eq(1).text());
    let marks = [];
    for (let i = 2; i < markTableStudent.length; i++) {
      let markTableStudentHtml = markTableStudent.eq(i).html().trim();
      //log(markTableStudentHtml);
      let markTableStudentSubjects = cheerio.load(markTableStudentHtml, {
        xmlMode: true,
      })('td');
      let mark = {
        id: markTableStudentSubjects.eq(0).text() || -1,
        name: names[i - 2] || -1,
        date: markTableStudentSubjects.eq(1).text() || -1,
        gender: markTableStudentSubjects.eq(2).text() === 'Nữ' ? 0 : 1,
        toan: markTableStudentSubjects.eq(3).text() || -1,
        vatli: markTableStudentSubjects.eq(6).text() || -1,
        nguvan: markTableStudentSubjects.eq(4).text() || -1,
        sinhhoc: markTableStudentSubjects.eq(8).text() || -1,
        tienganh: markTableStudentSubjects.eq(5).text() || -1,
        tiengnga: markTableStudentSubjects.eq(5).text() || -1,
        lichsu: markTableStudentSubjects.eq(10).text() || -1,
        tiengduc: markTableStudentSubjects.eq(5).text() || -1,
        tiengphap: markTableStudentSubjects.eq(5).text() || -1,
        tiengtrung: markTableStudentSubjects.eq(5).text() || -1,
        hoahoc: markTableStudentSubjects.eq(7).text() || -1,
        tiengnhat: markTableStudentSubjects.eq(5).text() || -1,
        diali: markTableStudentSubjects.eq(11).text() || -1,
        gdcd: markTableStudentSubjects.eq(12).text() || -1,
        khxh: markTableStudentSubjects.eq(13).text() || -1,
        khtn: markTableStudentSubjects.eq(9).text() || -1,
        city: 46,
      };

      marks.push(mark);
    }
    // marks.map((mark, i) => {
    //   mark['name'] = names[i];
    // });
    return marks;
  },
  saveTayNinhStudentsToDb = async (students) => {
    await Student.insertMany(students);
  };

(async () => {
  for (let i = 1; i <= 428; i++) {
    let students = await fetchTayNinhStudents(i);
    await saveTayNinhStudentsToDb(students);
    await delay({ second: 1 });
  }
})();
