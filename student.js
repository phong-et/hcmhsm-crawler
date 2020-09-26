const db = require('./db');
const mongoose = db.mongoose;
const Schema = mongoose.Schema;
const log = console.log;
const COLLECTION_NAME = 'students';
const studentSchema = new Schema({
  _id: Number,
  id: String,
  name: String,
  date: String,
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
  khtn: Number
});
const Student = mongoose.model('student', studentSchema, COLLECTION_NAME);
async function insertMany(jsonStudents) {
  try {
    db.connect();
    await Student.insertMany(jsonStudents, async (err) => {
      if (err) return error(err);
      log('Saved all to %s collection.', Student.collection.name);
      await db.close();
    });
  } catch (error) {
    log(error);
  }
}
async function fetchStudents(query) {
  var query = query
  log(`query : ${JSON.stringify(query)}`)
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
module.exports = {
  fetchStudents,
  insertMany,
};
// (async function () { await fetchstudents(2) }())
