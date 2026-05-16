const bcrypt = require('bcryptjs');  // ✅ Change from bcrypt to bcryptjs

const plaintextPassword = 'password123';

bcrypt.hash(plaintextPassword, 10, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log('New Hash:', hash);
});
