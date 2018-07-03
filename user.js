const mongoose = require('mongoose');
const User = new mongoose.Schema({
  username: String,
  count: Number,
  log : [{ description: String, duration: Number, date: Date }],
});

module.exports = mongoose.model('User', User);