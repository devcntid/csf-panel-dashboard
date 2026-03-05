import { getSqlClient } from "./lib/db";

async function test() {
  const client = getSqlClient();
  try {
    const query = `SELECT trx_no, regexp_replace(trx_no, '\\D', '', 'g') as r1, regexp_replace(trx_no, '\\\\D', '', 'g') as r2 FROM transactions LIMIT 5`;
    const result = await client(query);
    console.log(result);
  } catch (err) {
    console.error(err);
  }
}

test();
