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
app.use("/img", express.static("public/imgs"));
app.use("/fonts", express.static("public/fonts"));
app.use("/html", express.static("public/html"));
app.use("/media", express.static("public/media"));

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
    "<p id='right'>Copyright ©2021, (Team 15, Ray, Maz, Johnson, and Jason), Inc. Updated: " +
      d +
      "</p>"
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
    let templateFile = fs.readFileSync(
      "./assets/templates/profile_template.html",
      "utf8"
    );
    let templateDOM = new JSDOM(templateFile);
    let $template = require("jquery")(templateDOM.window);

    // put the name in
    $template("#profile_name").html(req.session.email);

    // insert the left column from a different file (or could be a DB or ad network, etc.)
    let left = fs.readFileSync("./assets/templates/left_content.html", "utf8");
    let leftDOM = new JSDOM(left);
    let $left = require("jquery")(leftDOM.window);
    // Replace!
    $template("#left_placeholder").replaceWith($left("#left_column"));

    // insert the left column from a different file (or could be a DB or ad network, etc.)
    let middle = fs.readFileSync(
      "./assets/templates/middle_content.html",
      "utf8"
    );
    let middleDOM = new JSDOM(middle);
    let $middle = require("jquery")(middleDOM.window);
    // Replace!
    $template("#middle_placeholder").replaceWith($middle("#middle_column"));

    // insert the left column from a different file (or could be a DB or ad network, etc.)
    let right = fs.readFileSync(
      "./assets/templates/right_content.html",
      "utf8"
    );
    let rightDOM = new JSDOM(right);
    let $right = require("jquery")(rightDOM.window);
    // Replace!
    $template("#right_placeholder").replaceWith($right("#right_column"));

    res.set("Server", "Wazubi Engine");
    res.set("X-Powered-By", "Wazubi");
    res.send(templateDOM.serialize());
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
        res.send({ status: "fail", msg: "email or password dont match our records" });
      } else {
        // authenticate the user, create a session
        console.log(rows.password);
        req.session.loggedIn = true;
        req.session.email = rows.email;
        req.session.save(function (err) {
          // session saved
        });
        // this will only work with non-AJAX calls
        //res.redirect("/profile");
        // have to send a message to the browser and let front-end complete
        // the action
        res.send({ status: "success", msg: "Logged in." });
      }
    }
  );
});

function authenticate(emailArg, pwd, callback) {
    // initDB();
  client.db("WecycleMain").collection("Users")
    .find({ "email": emailArg, "password": pwd })
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
    


//     (error, results) => {
//       if (error) {
//         throw error;
//       }
//       if (results.length > 0) {
//         // email and password found
//         console.log(results);
//         return callback(results[0]);
//       } else {
//         // user not found
//         return callback(null);
//       }
//     }
//   );

  //   connection.query(
  //     "SELECT * FROM user WHERE email = ? AND password = ?",
  //     [email, pwd],
  //     function (error, results) {
  //       if (error) {
  //         throw error;
  //       }

  //       if (results.length > 0) {
  //         // email and password found
  //         return callback(results[0]);
  //       } else {
  //         // user not found
  //         return callback(null);
  //       }
  //     }
  //   );
}

app.get("/logout", function (req, res) {
  req.session.destroy(function (error) {
    if (error) {
      console.log(error);
    }
  });
  res.redirect("/profile");
});

// RUN SERVER
let port = 8000;
app.listen(port, function () {
  console.log("Running on: " + port);
});
