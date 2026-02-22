require('dotenv').config();
const snowflake = require('snowflake-sdk');

const sql = `SELECT DATE_PART(epoch_millisecond, CURRENT_TIMESTAMP()) AS ms_time;`
const config = {
  account: process.env.SNOWFLAKE_ACCOUNT, username: process.env.SNOWFLAKE_USER, password: process.env.SNOWFLAKE_PASSWORD,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE, database: process.env.SNOWFLAKE_DATABASE, schema: process.env.SNOWFLAKE_SCHEMA
};
const conn = snowflake.createConnection(config);
conn.connect((err, conn) => {
  conn.execute({
    sqlText: sql,
    complete: (err, stmt, rows) => {
      console.log(rows[0]);
      process.exit(0);
    }
  });
});
