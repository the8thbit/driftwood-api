const dotenvFlow = require('dotenv-flow');
const dotenvExpand = require('dotenv-expand');

dotenvExpand(dotenvFlow.config());

const mysql = require('mysql')
const fs = require('fs');

const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const normalizeUrl = require('normalize-url');

const app = express();
const db = mysql.createPool({
  connectionLimit: process.env.MYSQL_POOL_SIZE,
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB
});

const validURL = (str) => {
  let pattern = new RegExp(
    '^(https?:\\/\\/)?'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d#%_.~+]*)*'+ // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i') // fragment locator
  ;

  return Boolean(pattern.test(str));
}

const chooseWeighted = (items, chances) => {
  let chanceSum = chances.reduce((acc, curr) => {
    return acc + curr;
  });

  let acc = 0;
  let chancesAcc = chances.map((chance) => {
    return acc += chance;
  });

  let rand = Math.random() * chanceSum;

  return chancesAcc.findIndex((chanceAcc) => {
    return chanceAcc >= rand;
  });
}

app.use(helmet());
app.use(bodyParser.json());
app.use(cors());
app.use(morgan("combined"));


app.get("/", (req, res) => {
  res.status(200).json("It works!");
});

app.get("/db", (req, res) => {
  const query = 'SELECT "Database works!";';
  db.query(query, function (error, results) {
    if (error) {
      console.log(JSON.stringify(error));
      res.status(500).json({
        error: 'Internal server error. Please try again later.'
      });
    } else {
      res.status(200).json(results);
    }
  });
});

app.post("/addSite", (req, res) => {
  let body = JSON.parse(req.body);
  let address = body.address;
  let tags = body.tags;

  if (tags.length < 3) {
    return res.status(405).json({
      error: "less than 3 tags",
    });
  }

  if (!validURL(address)) {
    return res.status(405).json({
      error: "invalid URL",
    });
  }

  let url = normalizeUrl(address);

  // TODO: check to see if site exists in db

  // if (<site exists in db>) {
  //   return res.status(405).json({
  //     error: `${url} is already indexed`,
  //     address: url
  //   });
  // }

  let tagsObj = {};
  for (tag of tags) {
    tagsObj[tag] = {
      score: 100,
      count: 1,
    };
  }

  // TODO: add site with following defaults
  // address: url
  // create_date: new Date()
  // last_fetch: new Date()
  // views: 0
  // score: 0
  // likes: 0
  // dislikes: 0
  // flags: 0

  for (tag in tagsObj) {
    // TODO: check to see if tag exists in db

    // if (<tag exists>) {
      // TODO: update the following columns in tag db entry
      // score: +tagsObj[tag].score
      // count: +1
    // } else {
      // TODO: add tag to db with the following defaults
      // name: tag
      // create_date: new Date()
      // count: 1
      // score: tagsObj[tag].score
      // views: 0
      // likes: 0
      // dislikes: 0
      // flags: 0
    // }
  }

  return res.status(201).json({
    address: url
  });
});

app.post("/likeSite", (req, res) => {
  let body = JSON.parse(req.body);
  let address = body.address;

  // TODO: add like site functionality

  res.status(200);
});

app.post("/dislikeSite", (req, res) => {
  let body = JSON.parse(req.body);
  let address = body.address;

  // TODO: add dislike site functionality

  res.status(200);
});

app.get("/getRandomSite", (req, res) => {
  //TODO: get random site from db weighted by views and score

  res.status(200).json({
    // address: siteQueryRes.docs[choiceIndex].data().address
  });
});

app.get("/getThreeRandomTags", (req, res) => {
  //TODO: get 3 random tags from db

  res.status(200).json({
    // tags: <array of tag names>
  });
});

app.get("/getTokenfieldAutocomplete", (req, res) => {
  const query = req.query.q;

  //TODO: get top 3 matching tags from DB, sorted by score

  // res.status(200).json(tagData.map((doc, id) => {
  //   return { id: id, name: doc.tag }
  // }));
});


const privateKey = fs.readFileSync(process.env.SSL_KEY);
const  certificate = fs.readFileSync(process.env.SSL_CERT);

https.createServer({
  key: privateKey,
  cert: certificate
}, app).listen(process.env.API_PORT, () => {
  console.log(`listening at port ${process.env.API_PORT}`);
});
