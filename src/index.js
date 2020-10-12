(async () => {
  const ENV = require("getenv");

  const dotenvFlow = require('dotenv-flow');
  const dotenvExpand = require('dotenv-expand');
  dotenvExpand(dotenvFlow.config());

  const util = require('util');
  const fs = require('fs');

  const bcrypt = require('bcrypt');
  const mysql = require('promise-mysql');

  const express = require('express');
  const session = require("express-session");
  const mySqlStore = require("express-mysql-session")(session);
  const bodyParser = require('body-parser');
  const https = require('https');
  const cors = require('cors');
  const helmet = require('helmet');
  const morgan = require('morgan');

  const passport = require("passport");
  const passportLocal = require("passport-local").Strategy;

  const normalizeUrl = require('normalize-url');

  const sql = require("./sql.js");

  let db = await mysql.createPool({
    connectionLimit: ENV.int('MYSQL_POOL_SIZE'),
    host: ENV.string('MYSQL_HOST'),
    port: ENV.int('MYSQL_PORT'),
    user: ENV.string('MYSQL_USER'),
    password: ENV.string('MYSQL_PASS'),
    database: ENV.string('MYSQL_DB'),
    multipleStatements: true
  });

  db.transact = async (queryStr, queryArgs) => {
    const connection = await db.getConnection();
    await connection.query('START TRANSACTION;');
    const result = await connection.query(queryStr, queryArgs);
    await connection.query("COMMIT;");
    await connection.releaseConnection();

    return result;
  }

  const sessionStore = new mySqlStore({}, db);

  const app = express();

  app.use(morgan("combined"));
  app.use(bodyParser.json());
  app.use(helmet());
  app.use(cors());

  app.use(
    session({
      store: sessionStore,
      secret: ENV.string('SESSION_SECRET'),
      resave: ENV.bool('SESSION_RESAVE'),
      saveUninitialized: ENV.bool('SESSION_SAVE_UNINIT'),
      cookie: {
        secure: ENV.bool('SESSION_COOKIE_SECURE'),
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => { done(null, user) });
  passport.deserializeUser((user, done) => { done(null, user) });

  passport.use(`local-login`, new passportLocal(async (username, password, done) => {
    let rows = await db.query(sql.getUserByUsername, [username]);
    if (rows.length > 1) { return done(`too many results`); }
    if (!(rows.length)) { return done(null, false); }

    bcrypt.compare(password, rows[0].hashword, (err, res) => {
      if (err) { return done(err); }
      if (!(res)) { return done(null, false); }
      return done(null, rows[0]);
    });
  }));

  passport.use(`local-signup`, new passportLocal(async (username, password, done) => {
    try {
      let rows = await db.query(sql.getUserByUsername, [username]);
      if (rows.length) { return done(null, false); }

      bcrypt.genSalt(ENV.int(`BCRYPT_SALT_ROUNDS`), (err, salt) => {
        if (err) { throw err; }
        bcrypt.hash(password, salt, async (err, hashword) => {
          if (err) { throw err; }
          rows = await db.query(sql.createUserLocalCreds, [username, hashword]);
          rows = await db.query(sql.getUserById, [rows.insertId]);
          return done(null, rows[0]);
        });
      });
    } catch (e) {
      return done(err);
    }
  }));

  const isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    } else {
      return res.status(401).json();
    }
  };

  const validURL = (str) => {
    let pattern = new RegExp(
      '^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d#%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$', 'i') // fragment locator
      ;

    return Boolean(pattern.test(str));
  }

  app.get(`/`, (req, res) => {
    return res.status(200).json("It works!");
  });

  app.get(`/db`, async (req, res) => {
    try {
      res.status(200).json((await db.query(sql.helloWorld))[0]);
    } catch (e) {
      console.error(`[EXCEPTION IN ROUTE /db]`, e);
      return res.status(500).json();
    }
  });

  app.post(`/signup`, passport.authenticate(`local-signup`), (req, res) => {
    return res.status(200).json(req.user.username);
  });

  app.post(`/login`, passport.authenticate(`local-login`), (req, res) => {
    return res.status(200).json(req.user.username);
  });

  app.get(`/logout`, isLoggedIn, (req, res) => {
    req.logout();
    return res.status(200).json();
  });

  app.get(`/auth`, isLoggedIn, (req, res) => {
    return res.status(200).json(`Auth for ${req.user.username} works!`);
  });

  app.get(`/getLeaderboard`, async (req, res) => {
    let query = null;
    let countQuery = null;
    let limit = 10;
    let offset = 0;

    if (`sites` in req.query) {
      switch (req.query.sites) {
        case `likes`:
          query = sql.getMostLikedSites;
          break;
        case `controversial`:
          query = sql.getMostControversialSites;
          break;
        default:
          query = sql.getMostViewedSites;
          break;
      }
    } else if (`tags` in req.query) {
      limit = 50;
      switch (req.query.tags) {
        case `random`:
          query = sql.getRandomCategories;
          break;
        default:
          query = sql.getMostUsedSiteCategories;
          countQuery = sql.getMostUsedSiteCategoriesCount;
          break;
      }
      if (countQuery && req.query.page) {
        let page = req.query.page;
        if (!(Number.isInteger(page))) { page = 0; }
        offset = (parseInt(page) * limit) + page;
      }
    } else {
      limit = 50;
      switch (req.query.users) {
        case `siteAdds`:
          query = sql.getMostSiteAddsUsers;
          countQuery = sql.getMostSiteAddsUsersCount;
          break;
        default:
          query = sql.getMostPointsUsers;
          countQuery = sql.getMostPointsUsersCount;
          break;
      }
      if (countQuery && req.query.page) {
        let page = req.query.page;
        if (!(Number.isInteger(page))) { page = 0; }
        offset = (parseInt(page) * limit) + page;
      }
    }

    const resultsRows = await db.query(query, [limit, offset]);
    let count = null;

    if (countQuery) {
      count = (await db.query(countQuery))[0].total_rows;
    }

    const results = resultsRows.map((row) => {
      if (row.address) {
        return {
          address: row.address,
          likes: row.likes,
          dislikes: row.dislikes,
          views: row.views
        }
      }
      if (row.name) {
        return {
          name: row.name,
          count: row.count
        }
      }
      if (row.username) {
        return {
          username: row.username,
          points: row.total_points,
          siteAdds: row.site_adds
        }
      }
    });

    return res.status(200).json({
      total_rows: count ? count : null,
      total_pages: count ? Math.ceil(Number(count) / limit) : null,
      results: results,
    });
  });

  app.get(`/getRandomSite`, async (req, res) => {
    const andTags = req.query.andTags ? req.query.andTags.split(',') : [];
    const orTags = req.query.orTags ? req.query.orTags.split(',') : [];
    const notTags = req.query.notTags ? req.query.notTags.split(',') : [];

    try {
      let userId = 0;
      let user = null;

      if (req.user) {
        userId = req.user.id;
        user = (await db.query(sql.getUserById, [userId]));
        if (user.length) {
          user = user[0];
        } else {
          userId = 0;
        }
      }

      let site = null;
      let userSiteViews = null;
      let proposalCount = 0;
      let proposalAccepted = false;
      
      while (!(proposalAccepted)) {
        if (andTags.length || orTags.length || notTags.length) {
          site = (await db.query(
            sql.getRandomSiteWithTags(andTags.length, orTags.length, notTags.length),
            [andTags, orTags, notTags].flat()
          ))[0];
        } else {
          site = (await db.query(sql.getRandomSite))[0];
        }

        if (!(site)) {
          return res.status(204).json();
        }

        userSiteViews = (await db.query(
          sql.getUserSiteViewsByUserIdAndSiteId,
          [userId, site.id]
        ));

        if (userSiteViews.length) {
          userSiteViews = userSiteViews[0];
          if (
            (userId === 0 && proposalCount >= 1) ||
            (proposalCount >= Math.min(15, 5 * userSiteViews.count))
          ) {
            proposalAccepted = true;
          }
        } else {
          proposalAccepted = true;
        }

        proposalCount++;
      }

      let pointsEarn = 0;
      if (userId != 0 && (
        (user.total_points < 1) ||
        (user.total_points < 3 && user.total_points >= 1 && Math.random() >= 0.1) ||
        (user.total_points < 5 && user.total_points >= 3 && Math.random() >= 0.15) ||
        (user.total_points < 10 && user.total_points >= 5 && Math.random() >= 0.2) ||
        (user.total_points < 15 && user.total_points >= 10 && Math.random() >= 0.25) ||
        (user.total_points < 20 && user.total_points >= 15 && Math.random() >= 0.3) ||
        (user.total_points < 25 && user.total_points >= 20 && Math.random() >= 0.35) ||
        (user.total_points < 50 && user.total_points >= 25 && Math.random() >= 0.4) ||
        (user.total_points < 60 && user.total_points >= 50 && Math.random() >= 0.5) ||
        (user.total_points < 80 && user.total_points >= 60 && Math.random() >= 0.6) ||
        (user.total_points < 100 && user.total_points >= 80 && Math.random() >= 0.7) ||
        (user.total_points < 200 && user.total_points >= 100 && Math.random() >= 0.8) ||
        (user.total_points < 300 && user.total_points >= 200 && Math.random() >= 0.9) ||
        (user.total_points < 500 && user.total_points >= 300 && Math.random() >= 0.95) ||
        (user.total_points < 999 && user.total_points >= 500 && Math.random() >= 0.99) ||
        (Math.random() >= 0.995)
      )) {
        let roll = Math.random();
        if (roll > 0.95) {
          pointsEarn = 3;
        } else if (roll > 0.7) {
          pointsEarn = 2;
        } else {
          pointsEarn = 1;
        }
      }

      db.query(sql.incrementSiteViews, [userId, site.id, pointsEarn]);

      return res.status(200).json({
        address: site.address,
        pointsEarn: pointsEarn
      });
    } catch (e) {
      console.error(`[UNHANDLED EXCEPTION IN ROUTE /getRandomSite]`, e);
      return res.status(500).json();
    }
  });

  app.post(`/addSite`, isLoggedIn, async (req, res) => {
    try {
      const address = req.body.address;
      const tags = req.body.tags;
      const user = (await db.query(sql.getUserById, [req.user.id]))[0];
      const bans = await db.query(sql.getUserBansByUserId, [user.id]);

      let shadowBan = false;

      for (ban of bans) {
        if (ban.name === `submit site ban` || ban.name === `total ban`) {
          return res.status(403).json({
            banned: {
              name: ban.name,
              date: ban.expiration_date,
              reason: ban.reason
            }
          });
        }
        if (ban.name === `submit site shadow ban` || ban.name === `total shadow ban`) {
          shadowBan = true;
        }
      }

      if (user.current_points < 50) {
        return res.status(403).json();
      }

      if (!(address) || !(tags) || address.length <= 0) {
        return res.status(400).json();
      }

      if (tags.length < 3) {
        // must have at least 3 tags to add a site
        return res.status(400).json();
      }

      if (!(validURL(address))) {
        return res.status(400).json();
      }

      let url = normalizeUrl(address);

      if (url.length > 3072) {
        // max legth of a normalized URL is 3072 due to MySQL unique constraint limitations (ASCII)
        return res.status(400).json();
      }

      for (tag of tags) {
        // max length of a tag is 768 due to MySQL unique constraint limitations (UTF8)
        if (tag.length > 768) {
          return res.status(400).json();
        }
      }

      if (!(shadowBan)) {
        const protected = 0;
        let modQueued = 0;
        let enabled = 1;
        if (user.approvals < 2) {
          modQueued = 1;
          enabled = 0;
        }
        const newSiteId = (await db.query(
          sql.addSiteBasic,
          [user.id, user.total_points, url, modQueued, enabled, protected]
        )).map(r => r.insertId).filter(r => r > 0)[0];

        for (tag of tags) {
          db.query(sql.addCategoryToSite, [user.id, user.total_points, tag, newSiteId]);
        }
      } else {
        await db.query(sql.decreaseUserPointsById, [user.id, 50]);
      }

      return res.status(201).json();
    } catch (e) {
      switch (e.code) {
        case `ER_DUP_ENTRY`:
          return res.status(409).json();
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /addSite]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post("/tagSite", isLoggedIn, async (req, res) => {
    try {
      const tags = req.body.tags;
      const user = (await db.query(sql.getUserById, [req.user.id]))[0];
      let pointBonus = 0;

      const bans = await db.query(sql.getUserBansByUserId, [user.id]);
      let shadowBan = false;

      for (ban of bans) {
        if (ban.name === `tag site ban` || ban.name === `total ban`) {
          return res.status(403).json({
            banned: {
              name: ban.name,
              date: ban.expiration_date,
              reason: ban.reason
            }
          });
        }
        if (ban.name === `tag site shadow ban` || ban.name === `total shadow ban`) {
          shadowBan = true;
        }
      }

      if (!(user) || !(user.last_viewed_site_id)) {
        return res.status(403).json();
      }

      if (!(tags) || !(Array.isArray(tags)) || tags.length <= 0 || tags.length > 12) {
        return res.status(400).json();
      }

      for (tag of tags) {
        if (typeof tag !== `string`) {
          return res.status(400).json();
        }
        // max length of a tag is 768 due to MySQL unique constraint limitations (UTF8)
        if (tag.length < 1 || tag.length > 768) {
          return res.status(400).json();
        }
      }

      if (shadowBan) {
        for (tag of tags) {
          if (Math.random() >= 0.997) {
            const roll = Math.random();
            if (roll > 0.85) { pointBonus += 9 } else
            if (roll > 0.65) { pointBonus += 8 } else
            if (roll > 0.5) { pointBonus += 7 } else
            if (roll > 0.3) { pointBonus += 6 } else
            { pointBonus += 5 }
          }
        }
      } else {
        for (tag of tags) {
          const rows = (await db.query(
            sql.addCategoryToSite,
            [user.id, user.total_points, tag, user.last_viewed_site_id]
          ))[0];
          if (rows && rows[0] && rows[0].count) {
            const count = rows[0].count;
            if (count >= 3 && count <= 10) {
              const roll = Math.random();
              if (roll > 0.85) { pointBonus += 9 } else
              if (roll > 0.65) { pointBonus += 8 } else
              if (roll > 0.5) { pointBonus += 7 } else
              if (roll > 0.3) { pointBonus += 6 } else
              { pointBonus += 5 }
            }
          }
        }
      }
      
      if (pointBonus > 0) {
        db.query(sql.increaseUserPointsById, [user.id, pointBonus]);
      }

      return res.status(201).json({
        pointBonus: pointBonus
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /tagSite]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post("/rateSite", isLoggedIn, async (req, res) => {
    try {
      const user = (await db.query(sql.getUserById, [req.user.id]))[0];
      const bans = await db.query(sql.getUserBansByUserId, [user.id]);
      let shadowBan = false;

      for (ban of bans) {
        if (ban.name === `rate site ban` || ban.name === `total ban`) {
          return res.status(403).json({
            banned: {
              name: ban.name,
              date: ban.expiration_date,
              reason: ban.reason
            }
          });
        }
        if (ban.name === `rate site shadow ban` || ban.name === `total shadow ban`) {
          shadowBan = true;
        }
      }

      const rating = req.body.rating;
      let pointBonus = 0;

      if (
        !(user) ||
        !(user.last_viewed_site_id) ||
        user.rated_last_site
      ) {
        return res.status(403).json();
      }

      if (!(rating) || (rating !== `like` && rating !== `dislike`)) {
        return res.status(400).json();
      }

      const site = (await db.query(sql.getSiteById, [user.last_viewed_site_id]))[0];

      if (rating === `like`) {
        if (site.likes >= site.dislikes) {
          if (Math.random() > 0.65) {
            pointBonus += 2;
          } else {
            pointBonus += 1;
          }
        }
        if (!(shadowBan)) {
          db.query(
            sql.addLikeToSite,
            [user.id, user.total_points, user.last_viewed_site_id]
          );
          const sitePointBonus = parseInt(Math.floor(Math.random() * 2) + 2);
          db.query(
            sql.rewardSiteSubmitter,
            [user.last_viewed_site_id, sitePointBonus]
          );
        } else {
          db.query(sql.addFakeRatingToSite, [user.id]);
        }
      } else {
        if (site.dislikes >= site.likes) {
          if (Math.random() > 0.65) {
            pointBonus += 3;
          } else {
            pointBonus += 2;
          }
        }
        if (!(shadowBan)) {
          db.query(
            sql.addDislikeToSite,
            [user.id, user.total_points, user.last_viewed_site_id]
          );
          const sitePointPenalty = parseInt(Math.floor(Math.random() * 2) + 1);
          db.query(
            sql.penalizeSiteSubmitter,
            [user.last_viewed_site_id, sitePointPenalty]
          );
        } else {
          db.query(sql.addFakeRatingToSite, [user.id]);
        }
      }

      if (pointBonus > 0) {
        db.query(sql.increaseUserPointsById, [user.id, pointBonus]);
      }

      res.status(200).json({
        pointBonus: pointBonus
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /rateSite]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get("/getAllSiteFlags", async (req, res) => {
    try {
      const rows = await db.query(sql.getSiteFlags);
      const flags = rows.filter(row => row.enabled === 1).map(row => {
        return {
          id: row.id,
          name: row.name,
          description: row.description
        }
      })
      res.status(200).json({
        flags: flags
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getAllSiteFlags]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post("/flagSite", isLoggedIn, async (req, res) => {
    try {
      if (
        !(req.body.flag) ||
        (req.body.comment && typeof req.body.comment !== "string") ||
        (req.body.comment && req.body.comment.length > 256)
      ) {
        return res.status(400).json();
      }

      const user = (await db.query(sql.getUserById, [req.user.id]))[0];
      const bans = await db.query(sql.getUserBansByUserId, [user.id]);
      let shadowBan = false;

      for (ban of bans) {
        if (ban.name === `flag site ban` || ban.name === `total ban`) {
          return res.status(403).json({
            banned: {
              name: ban.name,
              date: ban.expiration_date,
              reason: ban.reason
            }
          });
        }
        if (ban.name === `flag site shadow ban` || ban.name === `total shadow ban`) {
          shadowBan = true;
        }
      }

      if (
        !(user) ||
        !(user.last_viewed_site_id) ||
        user.flagged_last_site ||
        !(req.body.flag) ||
        parseInt(req.body.flag) !== req.body.flag
      ) {
        return res.status(403).json();
      }

      if (user.total_points > 25) {
        const site = (await db.query(sql.getSiteById, [user.last_viewed_site_id]))[0];

        if (!(shadowBan) && site) {
          let comment = req.body.comment;
          if (!(req.body.comment)) { comment = null; }

          db.query(
            sql.addFlagToSite,
            [user.id, user.total_points, req.body.flag, user.last_viewed_site_id, comment]
          );
        }
      }
      
      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /flagSite]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getThreeRandomTags`, async (req, res) => {
    try {
      const tags = (await db.query(sql.getRandomCategories, [3, 0]))
        .map(row => row.name)
      ;

      res.status(200).json({
        tags: tags
      });
    } catch (e) {
      console.error(`[UNHANDLED EXCEPTION IN ROUTE /getThreeRandomTags]`, e);
      return res.status(500).json();
    }
  });

  app.get(`/getTagAutocomplete`, async (req, res) => {
    try {
      const tag = req.query.tag;

      if (
        !(req.query) ||
        !(req.query.tag) ||
        typeof req.query.tag !== `string` ||
        req.query.tag.length === 0
      ) {
        return res.status(400).json();
      }

      const rows = await db.query(
        sql.getSiteCategoriesLikeNameSafe,
        [`${tag}%`, 3]
      );

      if (!(rows) || !(Array.isArray(rows)) || rows.length === 0) {
        return res.status(204).json();
      }

      return res.status(200).json({
        suggestions: rows.map(row => row.name)
      });
    } catch (e) {
      console.error(`[UNHANDLED EXCEPTION IN ROUTE /getTagAutocomplete]`, e);
      return res.status(500).json();
    }
  });

  app.post(`/banUser`, isLoggedIn, async (req, res) => {
    try {
      if (!(req.body.userIdToBan) || !(req.body.banId)) {
        return res.status(400).json();
      }
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);

      let canBanUsers = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canBanUsers = true;
          break;
        }
      }
      if (!(canBanUsers)) { return res.status(403).json(); }

      const userIdToBan = req.body.userIdToBan;
      const banId = req.body.banId;
      let banExpDate = req.body.banExpDate;
      let banReason = req.body.banReason;

      if (!(req.body.banExpDate)) { banExpDate = null; }
      if (!(req.body.banReason)) { banReason = null; }

      db.query(
        sql.banUserById,
        [req.user.id, userIdToBan, banId, banExpDate, banReason]
      );
      return res.status(201).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /banUser]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getSiteCategoriesLog`, isLoggedIn, async (req, res) => {
    try {
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);

      let canViewCategoryLog = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canViewCategoryLog = true;
          break;
        }
      }
      if (!canViewCategoryLog) { return res.status(403).json(); }

      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      if (!req.query.page) { page = 0; }
      if (!req.query.limit) { limit = 50; }

      const eventLog = await db.query(sql.getSiteCategoriesLog, [
        limit,
        page * limit + page,
      ]);
      const eventLogCount = (
        await db.query(sql.getSiteCategoriesLogCount)
      )[0].total_rows;

      return res.status(200).json({
        total_rows: eventLogCount,
        total_pages: Math.ceil(Number(eventLogCount) / limit),
        site_tags: eventLog,
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getSiteCategoriesLog]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getSiteFlagsLog`, isLoggedIn, async (req, res) => {
    try {
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);

      let canViewFlagsLog = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canViewFlagsLog = true;
          break;
        }
      }
      if (!canViewFlagsLog) { return res.status(403).json(); }

      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      if (!req.query.page) { page = 0; }
      if (!req.query.limit) { limit = 50; }

      const eventLog = await db.query(sql.getSiteFlagsLog, [
        limit,
        page * limit + page,
      ]);
      const eventLogCount = (await db.query(sql.getSiteFlagsLogCount))[0]
        .total_rows;

      return res.status(200).json({
        total_rows: eventLogCount,
        total_pages: Math.ceil(Number(eventLogCount) / limit),
        site_flags: eventLog,
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getSiteFlagssLog]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getUserBansLog`, isLoggedIn, async (req, res) => {
    try {
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);

      let canViewBansLog = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canViewBansLog = true;
          break;
        }
      }
      if (!canViewBansLog) { return res.status(403).json(); }

      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      if (!req.query.page) { page = 0; }
      if (!req.query.limit) { limit = 50; }

      const eventLog = await db.query(sql.getUserBansLog, [
        limit,
        page * limit + page,
      ]);
      const eventLogCount = (await db.query(sql.getUserBansLogCount))[0]
        .total_rows;

      return res.status(200).json({
        total_rows: eventLogCount,
        total_pages: Math.ceil(Number(eventLogCount) / limit),
        user_bans: eventLog,
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getUserBansLog]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getUserSiteviewsLog`, isLoggedIn, async (req, res) => {
    try {
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);

      let canViewSiteviewsLog = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canViewSiteviewsLog = true;
          break;
        }
      }
      if (!(canViewSiteviewsLog)) { return res.status(403).json(); }

      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      if (!req.query.page) { page = 0; }
      if (!req.query.limit) { limit = 50; }

      const eventLog = await db.query(sql.getUserSiteviewsLog, [
        limit,
        page * limit + page,
      ]);
      const eventLogCount = (await db.query(sql.getUserSiteviewsLogCount))[0]
        .total_rows;

      return res.status(200).json({
        total_rows: eventLogCount,
        total_pages: Math.ceil(Number(eventLogCount) / limit),
        user_siteviews: eventLog,
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getUserSiteviewsLog]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getUserRolesLog`, isLoggedIn, async (req, res) => {
    try {
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);

      let canViewRolesLog = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canViewRolesLog = true;
          break;
        }
      }
      if (!(canViewRolesLog)) { return res.status(403).json(); }

      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      if (!req.query.page) { page = 0; }
      if (!req.query.limit) { limit = 50; }

      const eventLog = await db.query(
        sql.getUserRolesLog,
        [limit, (page * limit) + page]
      );
      const eventLogCount = (
        await db.query(sql.getUserRolesLogCount)
      )[0].total_rows;

      return res.status(200).json({
        total_rows: eventLogCount,
        total_pages: Math.ceil(Number(eventLogCount) / limit),
        roles: eventLog,
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getUserRolesLog]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getSitesCreateLog`, isLoggedIn, async (req, res) => {
    try {
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canViewSitesLog = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canViewSitesLog = true;
          break;
        }
      }
      if (!canViewSitesLog) { return res.status(403).json(); }

      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      if (!(req.query.page)) { page = 0; }
      if (!(req.query.limit)) { limit = 50; }

      const sitesCreateLog = await db.query(
        sql.getSitesCreateLog,
        [limit, ((page*limit) + page)]
      );
      const sitesCreateLogCount = (
        await db.query(sql.getSitesCreateLogCount)
      )[0].total_rows;

      return res.status(200).json({
        total_rows: sitesCreateLogCount,
        total_pages: Math.ceil(Number(sitesCreateLogCount) / limit),
        sitesCreateLog: sitesCreateLog,
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getSitesCreateLog]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getSiteCategoriesCreateLog`, isLoggedIn, async (req, res) => {
    try {
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canViewCategoriesLog = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canViewCategoriesLog = true;
          break;
        }
      }
      if (!canViewCategoriesLog) { return res.status(403).json(); }

      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      if (!(req.query.page)) { page = 0; }
      if (!(req.query.limit)) { limit = 50; }

      const categoriesCreateLog = await db.query(
        sql.getSiteCategoriesCreateLog,
        [limit, ((page*limit) + page)]
      );
      const categoriesCreateLogCount = (
        await db.query(sql.getSiteCategoriesCreateLogCount)
      )[0].total_rows;

      return res.status(200).json({
        total_rows: categoriesCreateLogCount,
        total_pages: Math.ceil(Number(categoriesCreateLogCount) / limit),
        categoriesCreateLog: categoriesCreateLog,
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getSiteCategoriesCreateLog]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getSiteModQueue`, isLoggedIn, async (req, res) => {
    try {
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);

      let canViewModQueue = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canViewModQueue = true;
          break;
        }
      }

      if (!canViewModQueue) {
        return res.status(403).json();
      }

      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      if (!(req.query.page)) { page = 0; }
      if (!(req.query.limit)) { limit = 50; }

      const modQueue = await db.query(
        sql.getSiteModQueue,
        [limit, ((page*limit) + page)]
      );
      const modQueueCount = (await (
        db.query(sql.getSiteModQueueCount)
      ))[0].total_rows;

      return res.status(200).json({
        total_rows: modQueueCount,
        total_pages: Math.ceil(Number(modQueueCount) / limit),
        modQueue: modQueue
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getSiteModQueue]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getSiteFlagModQueue`, isLoggedIn, async (req, res) => {
    try {
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);

      let canViewModQueue = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canViewModQueue = true;
          break;
        }
      }

      if (!canViewModQueue) {
        return res.status(403).json();
      }

      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      if (!(req.query.page)) { page = 0; }
      if (!(req.query.limit)) { limit = 50; }

      const modQueue = await db.query(
        sql.getSiteFlagModQueue,
        [limit, ((page*limit) + page)]
      );
      const modQueueCount = (await (
        db.query(sql.getSiteFlagModQueueCount)
      ))[0].total_rows;

      return res.status(200).json({
        total_rows: modQueueCount,
        total_pages: Math.ceil(Number(modQueueCount) / limit),
        modQueue: modQueue
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getSiteFlagModQueue]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post(`/enableSiteById`, isLoggedIn, async (req, res) => {
    try {
      if (!(req.body.sites_id)) { return res.status(400).json(); }

      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canEnableSite = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canEnableSite = true;
          break;
        }
      }
      if (!canEnableSite) { return res.status(403).json(); }

      db.query(sql.enableSiteById, [req.user.id, req.body.sites_id]);

      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /enableSiteById]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post(`/disableSiteById`, isLoggedIn, async (req, res) => {
    try {
      if (!(req.body.sites_id)) { return res.status(400).json(); }

      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canDisableSite = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canDisableSite = true;
          break;
        }
      }
      if (!canDisableSite) { return res.status(403).json(); }

      db.query(sql.disableSiteById, [req.user.id, req.body.sites_id]);

      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /disableSiteById]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post(`/protectSiteById`, isLoggedIn, async (req, res) => {
    try {
      if (!(req.body.sites_id)) { return res.status(400).json(); }

      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canProtectSite = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canProtectSite = true;
          break;
        }
      }
      if (!canProtectSite) { return res.status(403).json(); }

      db.query(sql.protectSiteById, [req.user.id, req.body.sites_id]);

      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /protectSiteById]`, e);
          return res.status(500).json();
      }
    }
  });

    app.post(`/unprotectSiteById`, isLoggedIn, async (req, res) => {
    try {
      if (!(req.body.sites_id)) { return res.status(400).json(); }

      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canUnprotectSite = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canUnprotectSite = true;
          break;
        }
      }
      if (!canUnprotectSite) { return res.status(403).json(); }

      db.query(sql.unprotectSiteById, [req.user.id, req.body.sites_id]);

      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /unprotectSiteById]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post(`/approveSiteFlagById`, isLoggedIn, async (req, res) => {
    try {
      if (!req.body.flag_event_id) { return res.status(400).json(); }

      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canApproveFlag = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canApproveFlag = true;
          break;
        }
      }
      if (!canApproveFlag) { return res.status(403).json(); }

      db.query(
        sql.unqueueSiteFlagEventById,
        [req.user.id, req.body.flag_event_id]
      );

      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /approveFlagById]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post(`/approveSiteById`, isLoggedIn, async (req, res) => {
    try {
      if (!req.body.site_id) { return res.status(400).json(); }

      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canApproveSite = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canApproveSite = true;
          break;
        }
      }
      if (!canApproveSite) { return res.status(403).json(); }

      db.query(
        sql.approveSiteById,
        [req.user.id, req.body.site_id]
      );

      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /approveSiteById]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post(`/dismissSiteById`, isLoggedIn, async (req, res) => {
    try {
      if (!req.body.site_id) { return res.status(400).json(); }

      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canDismissSite = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canDismissSite = true;
          break;
        }
      }
      if (!canDismissSite) { return res.status(403).json(); }

      db.query(
        sql.dismissSiteById,
        [req.user.id, req.body.site_id]
      );

      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /dismissSiteById]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post(`/dismissSiteFlagById`, isLoggedIn, async (req, res) => {
    try {
      if (!(req.body.flag_event_id)) { return res.status(400).json(); }

      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canDismissFlag = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canDismissFlag = true;
          break;
        }
      }
      if (!canDismissFlag) { return res.status(403).json(); }

      db.query(
        sql.unqueueSiteFlagEventById,
        [req.user.id, req.body.flag_event_id]
      );
      db.query(sql.disableSiteFlagEventById,
        [req.user.id, req.body.flag_event_id]
      );

      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /dismissFlagById]`, e);
          return res.status(500).json();
      }
    }
  });



  app.get(`/getTagsBySiteId`, isLoggedIn, async (req, res) => {
    try {
      if (!(req.query.sitesId)) { return res.status(400).json(); }

      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canGetTags = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canGetTags = true;
          break;
        }
      }
      if (!canGetTags) { return res.status(403).json(); }

      let page = 0;
      if (req.query.page) {
        page = req.query.page
      }

      const siteTags = await db.query(
        sql.getSiteCategoriesBySiteId,
        [req.query.sitesId, 100, ((page * 100) + page)]
      );

      return res.status(200).json(siteTags);
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getTagsBySiteId]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post(`/removeTagFromSiteByBridgeId`, isLoggedIn, async (req, res) => {
    try {
      if (!(req.body.bridge_id)) { return res.status(400).json(); }

      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canRemoveTags = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canRemoveTags = true;
          break;
        }
      }
      if (!canRemoveTags) { return res.status(403).json(); }

      db.query(
        sql.removeCategoryFromSiteByBridgeId,
        [req.user.id, req.body.bridge_id]
      );

      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /removeTagFromSiteByBridgeId]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post(`/disableTagById`, isLoggedIn, async (req, res) => {
    try {
      if (!(req.body.tag_id)) { return res.status(400).json(); }

      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canRemoveTags = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canRemoveTags = true;
          break;
        }
      }
      if (!canRemoveTags) { return res.status(403).json(); }

      db.query(sql.disableCategoryById, [req.user.id, req.body.tag_id]);

      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /disableTagById]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getUserRoles`, isLoggedIn, async (req, res) => {
    try {
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      return res.status(200).json(userRoles.map((role) => role.name));
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getUserRoles]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getAllUserRoles`, isLoggedIn, async (req, res) => {
    try {
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canViewAllRoles = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canViewAllRoles = true;
          break;
        }
      }
      if (!canViewAllRoles) {
        return res.status(403).json();
      }

      const allUserRoles = await db.query(sql.getAllUserRoles);

      return res.status(200).json({
        roles: allUserRoles
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getAllUserRoles]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getAllUserBans`, isLoggedIn, async (req, res) => {
    try {
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canViewAllBans = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canViewAllBans = true;
          break;
        }
      }
      if (!canViewAllBans) { return res.status(403).json(); }

      const allUserBans = await db.query(sql.getAllUserBans);

      return res.status(200).json({
        bans: allUserBans
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getAllUserBans]`, e);
          return res.status(500).json();
      }
    }
  });

  app.get(`/getUserRolesByUserId`, isLoggedIn, async (req, res) => {
    try {
      if (!(req.query.usersId)) {
        return res.status(400).json();
      }
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canViewUsersRoles = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canViewUsersRoles = true;
          break;
        }
      }
      if (!canViewUsersRoles) {
        return res.status(403).json();
      }

      const targetUserRoles = await db.query(
        sql.getUserRolesByUserId,
        [req.query.usersId]
      );

      return res.status(200).json({
        roles: targetUserRoles
      });
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /getUserRolesByUserId]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post(`/grantRoleToUser`, isLoggedIn, async (req, res) => {
    try {
      if (!(req.body.users_id) || !(req.body.user_roles_id)) {
        return res.status(400).json();
      }
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canAddRolesToUser = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canAddRolesToUser = true;
          break;
        }
      }
      if (!canAddRolesToUser) {
        return res.status(403).json();
      }

      const targetUserRoles = await db.query(
        sql.getUserRolesByUserId, [req.body.users_id]
      );
      const userRoleToGrant = (await db.query(
        sql.getUserRoleById,
        [req.body.user_roles_id]
      ))[0];

      for (userRole of targetUserRoles) {
        if (userRole.name === userRoleToGrant.name) {
          return res.status(409).json();
        }
      }

      db.query(
        sql.addRoleToUserById,
        [req.user.id, req.body.users_id, req.body.user_roles_id]
      );

      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /grantRoleToUserById]`, e);
          return res.status(500).json();
      }
    }
  });

  app.post(`/revokeRoleFromUser`, isLoggedIn, async (req, res) => {
    try {
      if (!(req.body.users_id) || !(req.body.user_roles_id)) {
        return res.status(400).json();
      }
      const userRoles = await db.query(sql.getUserRolesByUserId, [req.user.id]);
      let canRevokeRolesFromUser = false;
      for (userRole of userRoles) {
        if (userRole.name === "admin") {
          canRevokeRolesFromUser = true;
          break;
        }
      }
      if (!canRevokeRolesFromUser) {
        return res.status(403).json();
      }

      const targetUserRoles = await db.query(
        sql.getUserRolesByUserId, [req.body.users_id]
      );
      const userRoleToRevoke = (await db.query(
        sql.getUserRoleById,
        [req.body.user_roles_id]
      ))[0];

      let targetUserHasRole = false;
      for (userRole of targetUserRoles) {
        if (userRole.name === userRoleToRevoke.name) {
          targetUserHasRole = true;
          break;
        }
      }
      if (!(targetUserHasRole)) {
        return res.status(406).json();
      }

      db.query(
        sql.revokeRoleFromUserById,
        [req.user.id, req.body.users_id, req.body.user_roles_id]
      );

      return res.status(200).json();
    } catch (e) {
      switch (e.code) {
        default:
          console.error(`[UNHANDLED EXCEPTION IN ROUTE /grantRoleToUserById]`, e);
          return res.status(500).json();
      }
    }
  });


  if (ENV.bool('SSL_ENABLED')) {
    https.createServer({
      key: fs.readFileSync(ENV.string('SSL_KEY')),
      cert: fs.readFileSync(ENV.string('SSL_CERT'))
    }, app).listen(ENV.int('API_PORT'), () => {
      console.log(`listening at port ${ENV.int('API_PORT')}`);
    });
  } else {
    app.listen(ENV.int('API_PORT'), () => {
      console.log(`listening at port ${ENV.int('API_PORT')}`);
    });
  }
})();