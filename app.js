// Imports
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");
const read = require("read");
const date = require(__dirname+"/date.js");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname+"/public"));

app.use(session({
    secret: "GiidawfrawscheingeutshRudrrichprogma",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// MongoDB - Database Logics
mongoose.connect("mongodb+srv://admin-yoon:seokjoong8966@cluster-thoughts-urhdc.mongodb.net/thoughtsDB", {useUnifiedTopology:true});
// mongoose.connect("mongodb://localhost:27017/thoughtsDB");
mongoose.set('useCreateIndex', true);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    username: String
});

userSchema.plugin(passportLocalMongoose, {usernameField: 'email'});

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
 
passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

const collectionSchema = new mongoose.Schema({
    name: String,
    description: String,
    userInfo: userSchema
});

const Collection = new mongoose.model("Collection", collectionSchema);

const documentSchema = new mongoose.Schema({
    title: String,
    content: String,
    timestamp: String,
    author: String,
    likeCount: Number,
    collectionInfo: collectionSchema,
    userInfo: userSchema,
    likedUsers: [userSchema],
    range: String
});

const Document = new mongoose.model("Document", documentSchema);

// Authentication
app.post("/register", function(req, res){
    User.register({email: req.body.email, username:req.body.username}, req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.render("root", {authenticated: false, username:"", collections:""});
        } else {
            passport.authenticate("local")(req, res, function(){
                User.findById(req.user._id, function(err, foundUser){
                    Collection.find({userInfo:foundUser},function(err,collections){
                        res.render("root", {authenticated: true, username:user.username, collections: collections});
                    });
                });
            });
        }
    });
});

app.post("/login", function(req, res){
    const user = new User({
        email: req.body.email,
        password: req.body.password,
    });

    req.login(user, function(err){
        if(err){
            console.log(err);
        } else {
            passport.authenticate("local", {successRedirect:"/", failureRedirect:"/loginFailure"})(req, res, function(){
                res.redirect("/")
            });
        }
    });
});

app.post("/logout", function(req, res){
    req.logout();
    res.render("root", {authenticated: false, username:""});
});


// Node Application Logics
app.get("/loginFailure", function(req, res){
    res.render("root", {authenticated: "loginFailed", username: "", collections:""});
});

app.get("/", function(req, res){
    var username = "";
    if(req.isAuthenticated()){
        username = req.user.username;
        User.findById(req.user._id, function(err, foundUser){
            Collection.find({userInfo:foundUser},function(err,collections){
                res.render("root", {authenticated: req.isAuthenticated(), username: username, collections:collections});
            });
        });
    } else {
        res.render("root", {authenticated: req.isAuthenticated(), username: "", collections:""});
    }
});

app.get("/home/:collectionId", function(req, res){
    var collectionId = req.params.collectionId;

    User.findById(req.user._id, function(err, foundUser){
        Collection.find({userInfo:foundUser}, function(err,collections){
            Collection.findOne({_id : collectionId, userInfo:foundUser}, function(err, collection){
                var collectionName = collection.name;
                var collectionDescription = collection.description;
                var collectionAuthor = collection.userInfo.username;
                Document.find({collectionInfo:collection}, function(err, documents){
                    res.render("home", {
                        collections:collections,
                        collectionAuthor:collectionAuthor, 
                        collectionName:collectionName, 
                        collectionDescription:collectionDescription,
                        collectionId: collectionId,
                        documents:documents
                    });
                });
            });
        });
    });
});

app.get("/feed", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        Collection.find({userInfo:foundUser}, function(err,collections){
            Document.find({}, function(err,documents){
                res.render("feed", {documents:documents, collections:collections, currentUser: foundUser});
            });
        });
    });
});

app.get("/addSupport/:documentId", function(req, res){
    Document.findById(req.params.documentId, function(err, document){
        var support = document.likeCount;
        support = support+1;
        Document.findOneAndUpdate({_id: req.params.documentId}, {
            likeCount : support
        }, function(err){
            if(err) {
                console.log(err);
            } else {
                Document.findOne({_id:req.params.documentId}, function(err, document){
                    User.findById(req.user._id, function(err, foundUser){
                        document.likedUsers.push(foundUser);
                        document.save();
                    });
                });
                res.redirect("/feed");
            }
        });
    });
});

app.get("/validation", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        Collection.find({userInfo:foundUser}, function(err,collections){
            res.render("validation", {validationFail:false, collections:collections});
        });
    });
});

app.post("/validation", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        Collection.find({userInfo:foundUser}, function(err, collections){
            User.findById(req.user._id, function(err, foundUser){
                foundUser.authenticate(req.body.password, function(err,model,passwordError){
                    if(passwordError){
                        res.render("validation", {validationFail:true, collections:collections});
                    } else {
                        User.findById(req.user._id, function(err, foundUser){
                            Collection.find({userInfo:foundUser},function(err,collections){
                                res.render("compose", {composeValidation:true, collections:collections});
                            });
                        });
                    }
                });
            });
        });
    });
});

app.get("/collectionValidation", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        Collection.find({userInfo:foundUser}, function(err,collections){
            res.render("collection-validation", {validationFail:false, collections:collections});
        });
    });
});

app.post("/collectionValidation", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        Collection.find({userInfo: foundUser}, function(err,collections){
            User.findById(req.user._id, function(err, foundUser){
                foundUser.authenticate(req.body.password, function(err,model,passwordError){
                    if(passwordError){
                        res.render("collection-validation", {validationFail:true, collections:collections});
                    } else {
                        res.render("collection-creation", {collectionValidation:true, collections:collections});
                    }
                });
            });
        });
    });
});

app.get("/compose", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        Collection.find({userInfo:foundUser},function(err,collections){
            res.render("compose", {composeValidation:false, collections:collections});
        });
    });
});

app.post("/compose", function(req, res){
    const collectionName = req.body.collectionName;
    const composedRange = req.body.composedRange;
    const composedTitle = req.body.composedTitle;
    const composedContent = req.body.composedContent;

    User.findById(req.user._id, function(err, foundUser){
        Collection.findOne({name:collectionName, userInfo: foundUser}, function(err,collection){
            const time = date.getDate();
            const newDocument = new Document({
                title: composedTitle,
                content: composedContent,
                timestamp: time,
                author: foundUser.username,
                likeCount: 0,
                collectionInfo: collection,
                userInfo: foundUser,
                range: composedRange
            })
            newDocument.save();
            res.redirect("/home/"+collection._id);
        });
    });
});

app.get("/collectionCreation", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        Collection.find({userInfo:foundUser}, function(err,collections){
            res.render("collection-creation", {collectionValidation:false, collections:collections});
        });
    });
});

app.post("/collectionCreation", function(req, res){
    const collectionName = req.body.name;
    const collectionDescription = req.body.description;
    User.findById(req.user._id, function(err, foundUser){
        if(err){
            console.log(err);
        } else {
            const newCollection = new Collection({
                name: collectionName,
                description: collectionDescription,
                userInfo: foundUser
            });
        
            newCollection.save(function(){
                Collection.findOne({name: collectionName, userInfo:foundUser}, function(err, collection){
                    res.redirect('/home/'+collection._id);
                });
            });
        }
    });
});

app.get("/documentDetail/:documentId", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        Collection.find({userInfo:foundUser}, function(err,collections){
            Document.findOne({userInfo:foundUser, _id: req.params.documentId}, function(err, document){
                res.render("document-detail", {collections:collections, document:document});
            });
        });
    });
});

app.get("/deleteDocument/:documentId/returnTo/:collectionId", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        Document.deleteOne({userInfo:foundUser, _id: req.params.documentId}, function(err){
            if(err){
                console.log(err);
            } else {
                res.redirect("/home/"+req.params.collectionId);
            }
        });
    });
});

app.get("/updateDocument/:documentId/returnTo/:collectionId", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        Document.findOne({userInfo:foundUser, _id: req.params.documentId}, function(err, document){
            Collection.find({userInfo:foundUser}, function(err, collections){
                res.render("document-update", {collections:collections, document: document});
            });
        });
    });
});

app.post("/updateDocument/:documentId/returnTo/:collectionId", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        Collection.findOne({name:req.body.updatedCollectionName, userInfo:foundUser}, function(err, collection){
            Document.findOneAndUpdate({_id:req.params.documentId}, {
                title: req.body.updatedTitle,
                content: req.body.updatedContent,
                collectionInfo: collection,
                timestamp: date.getDate(),
                range: req.body.updatedRange
            }, function(err){
                if(err){
                    console.log(err);
                } else {
                    res.redirect("/home/"+req.params.collectionId);
                }
            });
        });
    });
});

app.get("/deleteCollection/:collectionId", function(req, res){
    Collection.findOne({_id: req.params.collectionId}, function(err, collection){
        Document.deleteMany({collectionInfo: collection}, function(err){
            if(err){
                console.log(err);
            }
        });
    });

    Collection.deleteOne({_id: req.params.collectionId}, function(err){
        if(err){
            console.log(err);
        } else {
            res.redirect("/")
        }
    });
});

app.get("/updateCollection/:collectionId", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        Collection.findOne({userInfo:foundUser, _id: req.params.collectionId}, function(err, collection){
            Collection.find({userInfo:foundUser}, function(err, collections){
                res.render("collection-update", {collections:collections, collection: collection});
            });
        });
    });
}); 

app.post("/updateCollection/:collectionId", function(req, res){
    User.findById(req.user._id, function(err, foundUser){
        const newCollection = new Collection({
            name: req.body.updatedName,
            description: req.body.updatedDescription,
            userInfo: foundUser
        });
    

        newCollection.save(function(err, savedCollection){
            Collection.findOne({_id: req.params.collectionId}, function(err, collection){
                Document.updateMany({collectionInfo: collection}, {collectionInfo:savedCollection}, function(err){
                    if(err){
                        console.log(err);
                    }
                    Collection.deleteOne({_id: req.params.collectionId}, function(err){
                        if(err){
                            console.log(err);
                        } else {
                            res.redirect("/home/"+newCollection._id);
                        }
                    });
                });
            });
        });
    });
});

app.get("/about", function(req, res){
    if(req.isAuthenticated()){
        User.findById(req.user._id, function(err, foundUser){
            Collection.find({userInfo:foundUser}, function(err,collections){
                res.render("about", {authenticated:true, collections:collections});
            });
        });
    } else {
        res.render("about", {authenticated:false, collections:""});
    }
});

// Server Connection Control
app.listen(process.env.PORT || 3000, function() {
    console.log("Server has started!");
});

// app.listen(3000, function() {
//     console.log("Server has started!");
// });

