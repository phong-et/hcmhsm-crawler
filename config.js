module.exports = {
  cities: {
    hanoi:{
      url:'http://hanoiedu.vn/TraCuu/TraCuu',
      prefixId:'01',
      cityId:1,
      endId:79236,
      crawlerGroup:'hanoi'
    },
    haiphong:{
      url:'http://diemthi3.haiphong.edu.vn/TraCuu/TraCuu',
      prefixId:'03',
      cityId:1,
      endId:79236,
      crawlerGroup:'hanoi'
    },
    hochiminh:{
      url:'http://diemthi.hcm.edu.vn/Home/Show',
      prefixId:'02',
      cityId:3,
      endId:74669,
    },
    tayninh:{
      url:'https://baotayninh.vn/ket-qua-diem-thi-thpt-tay-ninh.html?tensbd=&cumthi=&p=',
      prefixId:'46',
      cityId:46,
      endId:8564,
    },
  },
  dbUrl: 'mongodb://localhost:27017/mark',
};
