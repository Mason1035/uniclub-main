// Test subprocess only: replace the database boundary before index.js loads.
const mongoose = require('mongoose');
mongoose.connect = async () => { mongoose.connection.readyState = 1; return mongoose; };
mongoose.disconnect = async () => { mongoose.connection.readyState = 0; };
require('../../models/EnrolledUser').countDocuments = async () => 0;
