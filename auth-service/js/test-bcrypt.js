const bcrypt = require('bcryptjs');  // ✅ Change from bcrypt to bcryptjs

const storedHash = '$2a$10$9gKsf0BIHc6g7TH2pGQnQeKieiAD5I6BMB.16/d9875fqnmpIRM3O';
const inputPassword = 'password123';

bcrypt.compare(inputPassword, storedHash, (err, result) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log('Password Valid:', result);
});
