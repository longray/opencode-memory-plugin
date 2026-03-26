const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

export function ulid() {
  let str = '';
  let time = Date.now();

  for (let i = TIME_LEN; i > 0; i--) {
    str = ENCODING[time % ENCODING_LEN] + str;
    time = Math.floor(time / ENCODING_LEN);
  }

  for (let i = 0; i < RANDOM_LEN; i++) {
    str += ENCODING[Math.floor(Math.random() * ENCODING_LEN)];
  }

  return str;
}

export function generateLocalId() {
  return ulid();
}
