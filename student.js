module.exports = (city) => {
  const db = require('./db');
  const mongoose = db.mongoose;
  const Schema = mongoose.Schema;
  const log = console.log;
  const COLLECTION_NAME = city;
  const schema = new Schema({
    _id: Number,
    id: String,
    cmnd: String,
    name: String,
    date: String,
    gender: Number,
    city: Number,
    toan: Number,
    vatli: Number,
    nguvan: Number,
    sinhhoc: Number,
    tienganh: Number,
    tiengnga: Number,
    lichsu: Number,
    tiengduc: Number,
    tiengphap: Number,
    tiengtrung: Number,
    hoahoc: Number,
    tiengnhat: Number,
    diali: Number,
    gdcd: Number,
    khxh: Number,
    khtn: Number,
  });
  const Student = mongoose.model('student', schema, COLLECTION_NAME);
  async function insertMany(jsonStudents) {
    try {
      db.connect();
      await Student.insertMany(jsonStudents, async (err) => {
        if (err) return error(err);
        log('Saved all to %s collection.', Student.collection.name);
        await db.close();
      });
    } catch (err) {
      log(err);
    }
  }
  async function fetchStudents(query) {
    var query = query;
    log(`query : ${JSON.stringify(query)}`);
    db.connect();
    try {
      let students = await Student.find(query, 'id').exec();
      log('students.length=%s', students.length);
      await db.close();
      return students;
    } catch (error) {
      log(error);
    }
  }
  return { fetchStudents, insertMany, schema };
};
// (async function () { await fetchstudents(2) }())
