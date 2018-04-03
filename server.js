const express = require("express");
const bodyParser = require("body-parser");
const sendgrid = require("./sendgrid.js");
const db = require("./database");
const auth = require("./auth");
const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const config = require("./config.js");
const sgMail = require("@sendgrid/mail");
var minify = require("html-minifier").minify;
const axios = require("axios");
const Busboy = require("busboy");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const connections = require("./database/connections");

let app = express();

// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms as well
app.use(bodyParser.urlencoded({ extended: true }));
// Provides access to user sessions via `request.session`
app.use(auth.attachSession);
// Declare static files
app.use(express.static(__dirname + "/client/build"));

const apiLimiter = function(request, response, next) {
  console.log("api limiter called");
  let emails = request.body.contacts.length;
  let numConnections = null;
  connections.returnConnectionsCount(numConnections => {
    let total = parseInt(numConnections) + emails;
    console.log("emails", emails);
    console.log("numConnections: ", numConnections);
    console.log("total: ", total);
    if (total <= 100) {
      connections.incrementConnections(emails, resp => {
        next();
      });
    } else {
      response.status(429).send("Too many requests");
    }
  });
};

//app.use("/exportHTML", apiLimiter);

// TODO: This should really be `/send`
app.post("/exportHTML", apiLimiter, (request, response) => {
  console.log("We are sending an email!", request.body.contacts);
  let { campaignId, htmlEmailContent, sendAt, contacts } = request.body;
  sendAt = parseInt(sendAt);

  // Get the list of email recipients
  db.campaignContacts(campaignId, results => {
    const contacts = results;
    db.getCampaignSubject(campaignId, (error, results) => {
      const subject = results.rows[0].subject;
      sgMail.setApiKey(`${config.TOKEN}`);
      sgMail.setSubstitutionWrappers("{{", "}}");
      const emails = [];
      //for each campaign contact, build their message object and add it to
      //the emails array.
      for (const contact of contacts) {
        // TODO: Make this nicer(?)
        // If they are unsubscribe, skip 'em
        if (contact.unsubscribe) {
          continue;
        }
        console.log(`Making message for ${JSON.stringify(contact)}`);
        const msg = {
          sendAt,
          subject,
          to: contact.email,
          from: "thealex@umich.edu", // TODO: This should be `request.session.username`,
          // TODO: Add substitution string to HTML email
          content: [
            {
              type: "text/html",
              value: htmlEmailContent
            }
          ],
          // Assuming contact.id is userId
          substitutions: {
            trackingImageURL: `${contact.contactid}/${campaignId}/footer.png`,
            // TODO: Change url for production
            unsubscribeURL: `http://localhost:3000/unsubscribe/${
              contact.contactid
            }`,
            foo: "BAR"
          }
        };
        emails.push(msg);
      }
      sgMail
        .send(emails)
        .then(sgResponse => console.log("sgMail -> Sent!"))
        .catch(error => console.log("sgMail -> FAILED"));
    });
  });
});

app.get("/", (request, response) => {
  response.send("Hello");
});

app.get("/:id/:cid/footer.png", (request, response) => {
  var contactID = request.params.id;
  var campaignID = request.params.cid;
  //also need campaign id
  response.set("Content-Type", "image/png");
  res.sendFile("./footer.png", err => {
    if (err) {
      console.log("sending the file", err);
    } else {
      console.log("sent file");
      db.userOpenedEmail(contactID, campaignID, results => {
        // console.log("response from user opened email", results);
      });
    }
  });
});

app.get("/checkUser", (request, response) => {
  db
    .checkUserExists(request.body)
    .then(data => {
      response.send(data);
    })
    .catch(err => {
      console.log(err);
    });
});

app.post("/send", (request, response) => {
  console.log("You're sending a message!", request);
  sendgrid(request, response)
    .then(data => {
      response.send();
    })
    .catch(err => {
      console.log("Error", err);
    });
});

app.get("/campaigns", (request, response) => {
  // console.log("Getting user campaigns in the server", request.query.userID);
  db
    .getUserCampaigns(request.query.userID)
    .then(data => {
      response.send(data);
    })
    .catch(err => {
      console.log(err);
    });
});

app.get("/groups", (request, response) => {
  // console.log("Getting user campaigns in the server", request.query.userID);
  db.getUserGroups(request.query.userID, data => {
    // console.log("response from campaigns,", data);
    response.send(data);
  });
});

app.post("/newCampaign", (request, response) => {
  // console.log("hit new campgiang");
  db
    .addNewCampaign(request.body)
    .then(data => {
      console.log(data);
      response.send(data);
    })
    .catch(err => {
      console.log(err);
    });
});

app.post("/newGroup", (request, response) => {
  console.log("hit new group in server");
  db
    .addNewGroup(request.body)
    .then(data => {
      console.log(data);
      response.send(data);
    })
    .catch(err => {
      console.log(err);
    });
});

app.put("/updateCampaign", (request, response) => {
  // console.log("inside update campaign", request);
  db.updateCampaignStatus(request.body, data => {
    response.send(data.id);
  });
});

app.get("/shouldCampaignUpdate", (request, response) => {
  // console.log("should campaign update", request.query.id);
  var campaign = request.query.id;
  db.checkCampaignTemplate(campaign, data => {
    db.campaignContacts(campaign, res => {
      // console.log('campaign status,', data.length, 'template', res.length)
      if (data.length === 0 && res.length !== 0) {
        response.send(true);
      } else {
        response.send(false);
      }
    });
  });
});

app.get("/campaignContacts", (request, response) => {
  db
    .campaignContacts(request.query.id)
    .then(data => {
      console.log(data.rows, "in campaignconta");
      response.send(data.rows);
    })
    .catch(err => {
      console.log(err);
    });
});

app.get("/groupContacts", (request, response) => {
  db.groupContacts(request.query.id, data => {
    console.log("group contacts data", data);
    response.send(data);
  });
});

app.post("/groupContacts", (request, response) => {
  // console.log("Adding group contact server", request.body)
  db.createGroupContact(
    request.body.params.group,
    request.body.params.id,
    data => {
      response.send(data);
    }
  );
});

app.get("/allContacts", (request, response) => {
  db.allContacts(request.query.id, data => {
    // console.log(data);
    response.send(data);
  });
});

app.post("/newContact", (request, response) => {
  var campaign = request.body.campaign;
  db
    .addNewContact(request.body.name, request.body.email)
    .then(data => {
      // console.log(data)
      db
        .createCampaignContact(campaign, data.rows[0].id)
        .then(data => {
          response.send(data);
        })
        .catch(err => {
          console.log(err);
        });
    })
    .catch(err => {
      console.log(err);
    });
});

app.post("/groupToCampaigns", (request, response) => {
  console.log("server groups to campaigns", request.body);
  var campaign = request.body.campaign;
  db.groupContacts(request.body.id, data => {
    data.forEach(contact => {
      //probably need to query for contact information here
      db.createCampaignContact(campaign, contact.contactid, res => {
        console.log("Campaign contact should be created", res);
      });
      response.send();
    });
  });
});

app.post("/unsubscribe/:contactId", (request, response) => {
  var contactId = request.params.contactId;
  db.unsubscribeContact(contactId, data => {
    response.redirect("/unsubscribe");
  });
});

app.get("/templates/:campaignId", (request, response) => {
  // Get the id from the route
  console.log("in here now");
  const campaignId = request.params.campaignId;
  // console.log(`campaignId: ${campaignId}`);
  // Load the URL from the database
  db.retrieveDraft(campaignId, (err, results) => {
    if (err) {
      throw err;
    }
    // {templateURL: "https://s3.amazonaws.com/..."}
    console.log("campaignid templates", results);
    // console.log(results);
    // Use the URL to get JSON from S3
    axios.get(results.templateurl).then(results => {
      // Send the JSON data back to the client

      response.send({ templateJSON: JSON.stringify(results.data) });
    });
  });
});

// TODO: Refactor constants into their own file, or `config.js`

// TODO: this should be templates/:campaignId
const BUCKET_NAME = "targ-templates";

app.post("/templates", (request, response) => {
  const { campaignId, designJSON, userID } = request.body;
  var file = JSON.stringify(designJSON);
  uploadToS3(userID, campaignId, file, (err, result) => {
    if (err) {
      throw err;
    }
    response.send({ msg: "Saved!" });
  });
});

const uploadToS3 = (userId, campaignId, file, callback) => {
  const fileName = `${userId}-${campaignId}-draft.json`;
  let s3bucket = new AWS.S3({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    Bucket: BUCKET_NAME
  });

  s3bucket.createBucket(() => {
    // TODO: Save each draft per user and dispaly it as an option in the
    // dropdown on the frontend editor component
    var params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file
    };

    s3bucket.upload(params, function(err, data) {
      if (err) {
        console.log("error in callback");
        console.log(err);
      }
      console.log("Made it to s3bucket upload callback");
      // TODO: save to postgres database
      const url = `https://s3.amazonaws.com/${BUCKET_NAME}/${fileName}`;
      db.updateCampaignS3URL(url, campaignId, (err, result) => {
        if (err) {
          callback(err, null);
        }
        callback(null, result);
      });
    });
  });
};

app.post("/drop", (request, response) => {
  // console.log(request.body,"inserver")
  const campaign = request.body.campaign;
  const newData = request.body.data.split("\n");
  var newsplitData = [];
  const objData = { name: [], email: [] };
  for (let i = 0; i < newData.length; i++) {
    var splitData = newData[i].split(",");
    newsplitData.push(
      splitData.filter(function(n) {
        return n !== " " && n !== "";
      })
    );
  }
  var newArray = [].concat.apply([], newsplitData);
  for (let j = 0; j < newArray.length; j++) {
    if (j % 2 === 0) {
      objData.name.push(newArray[j]);
    } else {
      objData.email.push(newArray[j]);
    }
  }
  // console.log(objData, campaign)
  db
    .addContact(objData)
    .then(data => {
      // console.log(data, "inserver");
      db
        .createMultiCampaignContact(campaign, data)
        .then(res => {
          response.send(res);
        })
        .catch(err => {
          console.log(err);
        });
    })
    .catch(err => {
      console.log(err);
    });
  // console.log(data[0].rows[0].id,'add contact')
  // db.createCampaignContact(campaign, data.rows[0].id, res => {
  // console.log("response from add", data);
});

app.delete("/deleteContact", (request, response) => {
  // console.log('here', request.query)
  db
    .deletecampaignsContact(request.query)
    .then(data => {
      db
        .deleteContact(request.query)
        .then(data => {
          response.send(data);
        })
        .catch(err => {
          console.log(err);
        });
    })
    .catch(err => {
      console.log(err);
    });
});

app.get("/getProfile", (request, response) => {
  // console.log(request.query.userID)
  db
    .getProfile(request.query.userID)
    .then(data => {
      // console.log(data.rows[0])
      response.send(data.rows[0]);
    })
    .catch(err => {
      console.log(err);
    });
});

app.post("/saveProfile", (request, response) => {
  // console.log(request.body.data)
  // console.log(request.body.user)
  db
    .saveProfile(request.body)
    .then(data => {
      // console.log(data)
      response.send(data);
    })
    .catch(err => {
      console.log(err);
    });
});

// AUTH ROUTES
app.post("/login", (request, response) => {
  const { username, password } = request.body;
  // Change this function when database check is implemented
  auth.validateUserLogin(username, password).then(results => {
    const { isValid, userID } = results;
    // If credentials are valid, generate a new token and return it.
    if (isValid) {
      const token = auth.genToken();
      auth.setSession({ token, username, userID }, results => {
        console.log(
          "server.js :: /login :: setSession callback :: results -> ",
          results
        );
        response.send({ token, userID });
      });
      // auth.setSession(token, { username, userID });
      // response.send({ token, userID });
    } else {
      response.status(401).send({ err: "Bad Credentials: Access Denied" });
    }
  });
});

app.post("/signup", (request, response) => {
  const { username, password } = request.body;
  db
    .addNewUser({ email: username, password })
    .then(data => {
      console.log(data.rows[0].id);
      const userID = data.rows[0].id;
      const token = auth.genToken();
      auth.setSession({ token, username, userID }, (err, results) => {
        console.log(
          "server.js :: /signup :: setSession callback :: results -> ",
          results
        );
        response.send({ token, userID });
      });
    })
    .catch(err => {
      response.status(400).send({ error: "Bad Request" });
    });
});

app.post("/logout", (request, response) => {
  console.log(request.session);
  if (request.session) {
    auth.deleteSession(request.session.token, (err, results) => {
      console.log("User session destroyed");
      console.log(results);
      response.send({ msg: "Success!" });
    });
    // auth.deleteSession(request.session.token);
    // response.send({ msg: "User session destroyed" });
  } else {
    response.status(401).send({ msg: "Session not valid" });
  }
});

app.post("/auth", (request, response) => {
  // If the session exists, check that it's valid.
  const authenticated = request.session ? true : false;
  if (authenticated) {
    response.send({ authenticated });
  } else {
    response.status(401).send({ authenticated });
  }
});

// SERVER SETUP ------------------------------------------------

let port = process.env.PORT || 3001;

let server = app.listen(port, function() {
  console.log(`listening on port ${port}`);
});
