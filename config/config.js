import 'dotenv/config';

export default {
  development: {
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatwave'
  },
  production: {
    mongoUri: process.env.MONGODB_URI
  },
};
