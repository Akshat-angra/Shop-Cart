const mongoose = require('mongoose');

const LastLoginActivitySchema = new mongoose.Schema({
    email: {type: String, required: true, unique: true}, lastLoginDates: {type: [Date], default: []},
});

module.exports = mongoose.model('LastLoginActivity', LastLoginActivitySchema);
