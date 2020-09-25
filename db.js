let mongoose = require('mongoose'),
    //require chalk module to give colors to console text
    chalk = require('chalk'),
    //require database URL from properties file
    dbURL = require('./cfg').dbUrl,
    // color
    connected = chalk.bold.cyan,
    error = chalk.bold.yellow,
    disconnected = chalk.bold.red,
    termination = chalk.bold.magenta

// mongoose.createConnection(dbURL, { useNewUrlParser: true });
// fix autoIncrementId (warning)
mongoose.set('useCreateIndex', true)
// fix warning DeprecationWarning: Mongoose: `findOneAndUpdate()` and `findOneAndDelete()` without the `useFindAndModify` option set to false are deprecated. See: https://mongoosejs.com/docs/deprecations.html#-findandmodify
mongoose.set('useFindAndModify', false)
mongoose.connection.on('connected', function () {
    console.log(connected("Mongoose default connection is open to ", dbURL));
})

mongoose.connection.on('error', function (err) {
    console.log(error("Mongoose default connection has occured " + err + " error"));
})

mongoose.connection.on('disconnected', function () {
    console.log(disconnected("Mongoose default connection is disconnected"));
})

process.on('SIGINT', function () {
    mongoose.connection.close(function () {
        console.log(termination("Mongoose default connection is disconnected due to application termination"));
        process.exit(0)
    })
})

function connect() {
    mongoose.connect(dbURL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
        //serverSelectionTimeoutMS: 150000
    })
    .catch(err => console.log(err.reason));
}
async function close() {
    await mongoose.connection.close()
}
module.exports = { mongoose: mongoose, connect: connect, close: close }
