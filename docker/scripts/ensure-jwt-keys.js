const { generateKeyPairSync } = require('crypto');
const { existsSync, mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');

const targetDir = process.argv[2] || '/app/jwt';
const privateKeyPath = join(targetDir, 'private.key');
const publicKeyPath = join(targetDir, 'public.key');

mkdirSync(targetDir, { recursive: true });

if (!existsSync(privateKeyPath) || !existsSync(publicKeyPath)) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
  writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });
  console.log(`Generated local JWT keys in ${targetDir}`);
} else {
  console.log(`Using existing local JWT keys in ${targetDir}`);
}
