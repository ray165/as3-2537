"use strict";

const express = require("express");
const session = require("express-session");
const app = express();
const fs = require("fs");
const { JSDOM } = require("jsdom");
const bodyParser = require("body-parser");
const credentials = fs.readFileSync("./cert.pem");
const {
  MongoClient,
  ObjectID, // we may actually ned the object id
} = require("mongodb");
const { strict } = require("is-typedarray");

const client = new MongoClient(
  "mongodb+srv://wecycle-vancouver.2hson.mongodb.net/myFirstDatabase?authSource=%24external&authMechanism=MONGODB-X509&retryWrites=true&w=majority",
  {
    sslKey: credentials,
    sslCert: credentials,
    useUnifiedTopology: true,
  }
);

// static path mappings
app.use("/js", express.static("public/js"));
app.use("/css", express.static("public/css"));
app.use("/images", express.static("public/images"));
app.use("/html", express.static("public/html"));

app.use(
  session({
    secret: "for logging in",
    name: "openSession",
    resave: false,
    saveUninitialized: true,
  })
);

app.get("/", function (req, res) {
  let doc = fs.readFileSync("./public/html/index.html", "utf8");

  // let's make a minor change to the page before sending it off ...
  let dom = new JSDOM(doc);
  let $ = require("jquery")(dom.window);

  let dateOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  let d = new Date().toLocaleDateString("en-US", dateOptions);
  // where we'll slip in an audio player into the footer's left :)
  $("#footer").append('<div id="left"></div>');
  $("#footer").append(
    `<p id="students-heading">TEAM 15 TEAM MEMBERS </br>
Jason (Jinseok) Ahn A01259569</br>
Johnson Lau A01239870</br>
Mazin Marwan A01242132</br>
Raymond Wong A01248576</br>
Updated on: ${d}</p> `
  );

  initDB();

  res.send(dom.serialize());
});

// async together with await connect to mongodb
async function initDB() {
  client.connect().then(function () {
    console.log("db is running");
  });
}

app.get("/dashboard", function (req, res) {
  // check for a session first!
  if (req.session.loggedIn) {
    // DIY templating with DOM, this is only the husk of the page
    let dash = fs.readFileSync("public/templates/dashboard.html", "utf8");
    let dashDOM = new JSDOM(dash);
    let $dash = require("jquery")(dashDOM.window);

    $dash("#_email").html(req.session.email);
    $dash("#message").html(
      `You have logged in to redeem many coupons. Hello!<br/> logged in on ${req.session.date}`
    );

    res.set("Server", "wecycle is life");
    res.send(dashDOM.serialize());
  } else {
    // not logged in - no session!
    res.redirect("/");
  }
});

// No longer need body-parser!
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Notice that this is a 'POST'
app.post("/authenticate", function (req, res) {
  res.setHeader("Content-Type", "application/json");

  console.log("Email", req.body.email);
  console.log("Password", req.body.password);

  let results = authenticate(
    req.body.email,
    req.body.password,
    function (rows) {
      if (rows == null) {
        // not found
        res.send({
          status: "fail",
          msg: "email or password dont match our records",
        });
      } else {
        // authenticate the user, create a session

        let dateOptions = {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        };
        let currentDate = new Date().toLocaleDateString("en-US", dateOptions);

        console.log(rows.password);
        req.session.loggedIn = true;
        req.session.email = rows.email;
        req.session.date = currentDate;
        req.session.save(function (err) {
          // session saved
        });
        // have to send a message to the browser and let front-end complete
        // the action
        res.send({ status: "success", msg: "Logged in." });
      }
    }
  );
});

function authenticate(emailArg, pwd, callback) {
  client
    .db("WecycleMain")
    .collection("Users")
    .find({ email: emailArg, password: pwd })
    .toArray()
    .then((data) => {
      if (data.length > 0) {
        // email and password found
        // console.log(data);
        return callback(data[0]);
      } else {
        // user not found
        return callback(null);
      }
    });
}

app.post("/logout", function (req, res) {
  req.session.destroy(function (error) {
    if (error) {
      console.log(error);
    }
  });
  // res.redirect("/");
  res.send({ status: "success", msg: "Logged out." });
});

// RUN SERVER
let port = 8000;
app.listen(port, function () {
  console.log("Running on: " + port);
});
