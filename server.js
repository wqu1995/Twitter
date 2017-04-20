var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var app = express();
var serveStatic = require('serve-static');
var session = require('cookie-session');
var mysql = require('mysql');
var crypto = require('crypto');
var cryptoRandomString = require('crypto-random-string');
var nodemailer = require('nodemailer');
//var FileStore = require('session-file-store')(session);
var mongoClient = require('mongodb').MongoClient;
var assert = require('assert');
const dateTime = Date.now();
var fileupload = require('express-fileupload');
var cassandra = require('cassandra-driver');
var amqp = require('amqplib/callback_api');
var amqpConn, chan;
var exchange = 'twitter';

amqp.connect('amqp://test:test@54.227.232.158', function(err,conn){
	amqpConn = conn;
	chan = conn.createChannel(function(err,ch){
		ch.assertExchange('twitter', 'direct');
	})
	console.log("connected to amqp");
})

var cassandraClient = new cassandra.Client({
	contactPoints: ['54.227.232.158'],
	keyspace: 'twitter'
},function(err){
	if(err)
		console.log(err);
	else
		console.log("connected to cassandra")
})

var url = 'mongodb://52.90.176.234:27017/twitter';
//var url = 'mongodb://localhost:27017/twitter';


/*
mongoClient.connect(url,function(err,db){
	assert.equal(null,err);
	console.log("CONNECTION SUCCESS");
	//db.tweets.createIndex({"content": "text"});
	})*/


var connection = mysql.createConnection({
	host: '54.86.36.12',
	user: 'root',
	password: 'cse356',
	database: 'Twitter'
});

/*
var connection = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	password: 'root',
	database: 'twitter'
})*/

connection.connect(function(err){
	if(err){
		console.log(err);
	}
	else{
		console.log("connected to mysql");
	}
});

var mail = nodemailer.createTransport({
	//host: 'smtp.gmail.com',
	//port: 465,
	service: 'gmail',
	auth:{
		user: 'twittercse356@gmail.com',
		pass: 'cse356666'
	}
});

app.use(session({
	name: 'chicken',
	secret: 'no secret',
	saveUninitialized: true,
	resave: false,
	maxAge: 24 * 60 * 60 * 1000

}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));
//app.use(require('morgan')('dev'));
app.use(fileupload());
app.get('/', function(req,res){
	if(typeof req.session.user === 'undefined'){
		res.redirect('/login');
	}else{
		//console.log('in here');
		//console.log(req.session.user);
		res.sendFile('/index.html',{root: __dirname + '/public'});
	}
})

app.use('/',express.static(__dirname + '/public',{

}));

app.get('/adduser', function(req,res){
	res.sendFile('signUp.html',{root: __dirname+'/public'});
})
app.post('/adduser', function(req,res){
	var hash = crypto.createHash('md5').update(req.body.email).digest('hex');
	var post = {
		username : req.body.username,
		password : req.body.password,
		email : req.body.email,
		enabled : false,
		verify: hash
	};
	connection.query('INSERT INTO Users SET ?', post, function(err,result){
		if(err){
			res.send({
				status: "error",
				error: err
			});
		}
		else{
			res.send({status: "OK"});
		}
	})
		
})

app.get('/login', function(req,res){
	res.sendFile('login.html',{root: __dirname+'/public'});
})
app.post('/login', function(req,res){
	connection.query('SELECT * FROM Users WHERE Username = '+mysql.escape(req.body.username)
		+' AND password = '+mysql.escape(req.body.password), function(err, result){
			if(err){
				res.send({
					status: "error",
					error: err
				});
			}else{
				if(result.length===1){
					if(result[0].enabled === 0){
						res.send({
							status: "error",
							error: "Unactivated account!"
						})
					}else{
						req.session.user = req.body.username;
						
						res.send({
							status: "OK"
						})
					}
					
				}
				else{
					res.send({
							status: "error",
							error: "Can not find account!"
						})
				}
			}
		})
})

app.post('/logout',function(req,res){
	if(typeof req.session.user != 'undefined'){
		req.session = null;
		res.send({status: "OK"});
	}else{
		res.send({
			status: "error",
			error: "You are not logged in as any user!"
		})
	}
})

app.get('/verify',function(req,res){
	if(req.query.key === 'abracadabra'){
		var query = connection.query('SELECT username FROM Users WHERE email = '+mysql.escape(req.query.email),function(err,result){
			if(err){
				res.send({
					status: "error",
					error: err
				});
			}
			else{
				if(result.length === 1){
					var query = connection.query('UPDATE Users SET enabled = true WHERE username = '+mysql.escape(result[0].username),function(err,result){
						if(err){
							res.send({
								status: "error",
								error: err
							});
						}else{
							res.send({
								status: "OK"
							});
						}
					})
				}
				else{
					res.send({
						status: "error",
						error: "Fail finding user!"
					})
				}
			}
		})
	}else{
		var query = connection.query('SELECT username FROM Users WHERE email = '+mysql.escape(req.query.email)
			+' AND verify = '+mysql.escape(req.query.key), function(err,result){
			if(err){
				res.send({
					status: "error",
					error: err
				});
			}
			else{
				if(result.length ===1){
					var query = connection.query('UPDATE Users SET enabled = true WHERE username = '+mysql.escape(result[0].username), function(err,result){
						if(err){
							res.send({
								status: "error",
								error: err
							});
						}else{
							res.send({
								status: "OK"
							});
						}
					})
				}else{
					res.send({
						status: "error",
						error: "Fail finding user!"
					});
				}
			}
		})
	}
})
app.post('/verify',function(req,res){
	if(req.body.key === 'abracadabra'){
		var query = connection.query('SELECT username FROM Users WHERE email = '+mysql.escape(req.body.email),function(err,result){
			if(err){
				res.send({
					status: "error",
					error: err
				});
			}
			else{
				if(result.length === 1){
					var query = connection.query('UPDATE Users SET enabled = true WHERE username = '+mysql.escape(result[0].username),function(err,result){
						if(err){
							res.send({
								status: "error",
								error: err
							});
						}else{
							res.send({
								status: "OK"
							});
						}
					})
				}
				else{
					res.send({
						status: "error",
						error: "Fail finding user!"
					})
				}
			}
		})
	}else{
		var query = connection.query('SELECT username FROM Users WHERE email = '+mysql.escape(req.body.email)
			+' AND verify = '+mysql.escape(req.body.key), function(err,result){
			if(err){
				res.send({
					status: "error",
					error: err
				});
			}
			else{
				if(result.length ===1){
					var query = connection.query('UPDATE Users SET enabled = true WHERE username = '+mysql.escape(result[0].username), function(err,result){
						if(err){
							res.send({
								status: "error",
								error: err
							});
						}else{
							res.send({
								status: "OK"
							});
						}
					})
				}else{
					res.send({
						status: "error",
						error: "Fail finding user!"
					});
				}
			}
		})
	}

})

app.post('/additem', function(req,res){
	if(typeof req.session.user == 'undefined'){
		res.send({
			status: "error",
			error: "You are not logged in as any user!"
		})
	}
	else{
	/*	mongoClient.connect(url,function(err,db){
	assert.equal(null,err);
	//console.log(req.body);
	
	var newDoc = {
		content: req.body.content,
		parent: req.body.parent,
		username: req.session.user,
		timestamp: timestamp
	}
	db.collection('tweets').insertOne(newDoc,function(err,result){
		assert.equal(null,err);
		db.close();
		var resultToSend = {
			status: "OK",
			id: newDoc._id,
		}
		res.send(resultToSend);
	})
})*/
//console.log('in add item')
	if(req.body.content.substring(0,3)=="RT "){
		connection.query('UPDATE Tweets SET RTCounter = RTCounter + 1 WHERE content LIKE ' + 
			mysql.escape('%'+req.body.content.substring(3,req.body.content.length)+'%'), function(err,result){
				if(err){
					console.log(err);
				}
			})
	}
var timestamp = Math.floor(dateTime/1000);	
var postid = crypto.createHash('md5').update(req.body.content+cryptoRandomString(10)).digest('hex');
		var post;
		if(req.body.parent != null && req.body.parent != ""){
			if(req.body.media !=null && req.body.media != ""){
				post = {
					id: postid,
					content: req.body.content,
					username: req.session.user,
					timestamp: timestamp,
					parent: req.body.parent,
					media: req.body.media.toString()
				}
			}
			else{
				post = {
					id: postid,
					content: req.body.content,
					username: req.session.user,
					timestamp: timestamp,
					parent: req.body.parent,
					media: null
				}
			}
		}
			
		else{
			if(req.body.media !=null && req.body.media != ""){
				post = {
					id: postid,
					content: req.body.content,
					username: req.session.user,
					timestamp: timestamp,
					parent: null,
					media: req.body.media.toString()
				}
			}
			else{
				post = {
					id: postid,
					content: req.body.content,
					username: req.session.user,
					timestamp: timestamp,
					parent: null,
					media: null,

				}
			}
		}

		connection.query('INSERT INTO Tweets SET ?', post, function(err, result){
			if(err){
				console.log(post);
				console.log(err);
				res.send({
					status:"error",
					error: err
				})
			}else{
				res.send({
					status: "OK",
					id: postid
				})
			}
		})
	}

})

app.get('/item/:id',function(req,res){
	//console.log("in get item   " + req.params.id);
/*mongoClient.connect(url,function(err,db){
	assert.equal(null,err);
	//console.log(req.query.id)
	//console.log("THIS IS ID");
	//console.log(req.params.id)
	var id = require('mongodb').ObjectId(req.params.id);
	//console.log("in get item");
	//console.log(id);
	var queryJson = {
		_id: id
	}


	db.collection('tweets').findOne(queryJson,function(err,result){
		//console.log("THIS IS RESULT" + result);
	
		if (err){
			res.send({
				status: "error"
			})
			db.close();
		}
		
		if(result){
			var resultToRespond = {
			status: "OK",
			item: {
				id: result._id,
				username: result.username,
				content: result.content,
				timestamp: result.timestamp
			}
		}
		res.send(resultToRespond);
		db.close();

		}
		if(!result){
			res.send({
				status: "error"
			})
			db.close();
		}

	})
})*/
	connection.query('SELECT * FROM Tweets WHERE id = '+ mysql.escape(req.params.id), function(err,result){
		if(err){
			console.log(err)
			res.send({
					status:"error",
					error: err
				})
		}else{
			if(result.length != 0){
			//	console.log(result);
			res.send({
				status : "OK",
				item: JSON.parse(JSON.stringify(result[0]))
			})
		}else{

			res.send({
					status:"error",
					error: err
				})
		}
		}
	})
})

app.get('/getAllTweets',function(req,res){
	mongoClient.connect(url,function(err,db){
		assert.equal(null,err);

		db.collection('tweets').find().toArray(function(err,doc){
			res.send(doc);
			db.close();
		})
	})
})

app.post('/searchTweets',function(req,res){
	console.log(req.body);
	var newStamp = Number(req.body.timestamp);
	//console.log("this is time stamp" + newStamp)
		mongoClient.connect(url,function(err,db){
		assert.equal(null,err);
		var query = {
			timestamp: {
				$lte:newStamp 
			}
		}
		db.collection('tweets').find(query).toArray(function(err,doc){
			if (doc != null){
				res.send(doc)
				//console.log(doc)
				db.close();
			}
		})

	})
})
app.post('/search',function(req,res){
	console.log(req.body);
	var newStamp = req.body.timestamp || dateTime;
	var q = req.body.q;
	var following = req.body.following;
	var username = req.body.username;
//	console.log("THIS IS USERNAME " + username);
//	console.log("THIS IS Q " + q);
//	console.log("THIS IS following " + following)
//	console.log("THIS IS USERNAME " + username);
	var parent
	if(req.body.hasOwnProperty('parent')){
		 parent= req.body.parent;
	}else{
		parent = null;
	}
//	console.log("THIS IS PARENT " + parent);
	var replies = req.body.replies;
//	console.log("THIS IS REPLIES " + replies);

	if (req.body.limit != null && req.body.limit != ""){
		if(q != null && following == true && username != null){
			res.send({
				status: "OK",
				items: []
			})
		}
		else if(q != null && following == true && username == null && parent == null && (replies == false || replies == null)){
			connection.query('SELECT T.* FROM Tweets T, Following F WHERE T.username = F.User2 AND F.User1 = ' + mysql.escape(req.session.user)+
				' AND content LIKE '+ mysql.escape('%'+q+'%')+ ' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("472")
						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if(q != null && following == true && username == null && parent == null && replies == true){
				connection.query('SELECT T.* FROM Tweets T, Following F WHERE T.username = F.User2 AND F.User1 = ' + mysql.escape(req.session.user)+
				' AND content LIKE '+ mysql.escape('%'+q+'%')+ ' AND T.parent IS NOT NULL AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("472")
						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q != null && following == true && username == null && parent != null){
			connection.query('SELECT T.* FROM Tweets T, Following F WHERE T.username = F.User2 and F.User1 = ' + mysql.escape(req.session.user) + 
				' AND content like ' + mysql.escape('%'+q+'%') + 'AND timestamp <= '+mysql.escape(newStamp) + 'AND T.parent = ' + mysql.escape(parent)+ 'ORDER by timestamp DESC LIMIT ' + 
				mysql.escape(req.body.limit),function(err,result){
					if (err){
						console.log("472")
						res.send({
							status: "error",
							error: err
						})
					}
					else{
						var response = {
							status: "OK",
							items: []
						}
						for (var i = 0; i<result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if(q != null && following ==false && username != null && parent == null && (replies == false || replies == null)){
			connection.query('SELECT * FROM Tweets WHERE username =' + mysql.escape(username)+
				' AND content LIKE '+ mysql.escape('%'+q+'%')+ ' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("494")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q != null && folllwing == false && username != null && parent == null && replies == true){
			connection.query('SELECT * FROM Tweets WHERE username =' + mysql.escape(username)+
				' AND content LIKE '+ mysql.escape('%'+q+'%')+ ' AND parent IS NOT NULL AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("494")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if(q != null && following == false && username != null && parent != null){
				connection.query('SELECT * FROM Tweets WHERE username =' + mysql.escape(username)+
				' AND content LIKE '+ mysql.escape('%'+q+'%')+ ' AND parent =' + mysql.escape(parent) + ' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("494")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if(q != null && following ==false && username == null && parent == null && (replies == false || replies == null)){
			connection.query('SELECT * FROM Tweets WHERE content LIKE '+ mysql.escape('%'+q+'%')+ ' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("516")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if(q != null && following == false && username == null && parent == null && replies == true){
			connection.query('SELECT * FROM Tweets WHERE content LIKE '+ mysql.escape('%'+q+'%')+ ' AND parent IS NOT NULL' + ' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("516")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q != null && following == false && username == null && parent != null){
			connection.query('SELECT * FROM Tweets WHERE content LIKE '+ mysql.escape('%'+q+'%')+ ' AND parent = ' + mysql.escape(parent)+ ' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("516")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if(q == null && following != null && username != null){
			res.send({
				status: "OK",
				items: []
			})
		}
		else if(q == null && following == true && username == null && parent == null && (replies == false || replies == null)){
			connection.query('SELECT T.* FROM Tweets T, Following F WHERE T.username = F.User2 AND F.User1 = ' + mysql.escape(req.session.user)+
				' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("545")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q == null && following == true && username == null && parent == null && replies == true){
			connection.query('SELECT T.* FROM Tweets T, Following F WHERE T.username = F.User2 AND F.User1 = ' + mysql.escape(req.session.user)+
				' AND parent IS NOT NULL AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("545")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})	
		}
		else if(q == null && following == true && username == null && parent != null){
			connection.query('SELECT T.* FROM Tweets T, Following F WHERE T.username = F.User2 AND F.User1 = ' + mysql.escape(req.session.user)+ ' AND T.parent = ' + 
				mysql.escape(parent) + 
				' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("545")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}

		else if(q == null && following == false && username != null && parent == null && (replies == false || replies == null)){
			connection.query('SELECT * FROM Tweets WHERE username =' + mysql.escape(username)+
				' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("568")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q == null && following == false && username != null && parent == null && replies == true){
			connection.query('SELECT * FROM Tweets WHERE username =' + mysql.escape(username)+
				'AND parent IS NOT NULL AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("568")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q == null && following == false && username != null && parent != null){
			connection.query('SELECT * FROM Tweets WHERE username =' + mysql.escape(username)+ ' AND parent = ' + mysql.escape(parent) + 
				' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +
				mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("568")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})

		}
		else if(q == null && following ==false && username == null && parent == null && (replies == false || replies == null)){
			connection.query('SELECT * FROM Tweets WHERE timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT ' +mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("590")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q == null && following == false && username == null && parnet == null && replies == true){
			connection.query('SELECT * FROM Tweets WHERE timestamp <= '+mysql.escape(newStamp)+ ' AND parent IS NOT NULL ORDER BY timestamp DESC LIMIT ' +mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("590")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if(q == null && following == false && username == null && parent != null){
			connection.query('SELECT * FROM Tweets WHERE timestamp <= '+mysql.escape(newStamp)+ ' AND parent = ' + mysql.escape(parent) + ' ORDER BY timestamp DESC LIMIT ' +mysql.escape(req.body.limit), function(err, result){
					if(err){
						console.log("590")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
	}
	else{
		if(q != null && following == true && username != null){
			res.send({
				status: "OK",
				items: []
			})
		}
		else if(q != null && following == true && username == null && parent == null && (replies == false || replies == null)){

			connection.query('SELECT T.* FROM Tweets T, Following F WHERE T.username = F.User2 AND F.User1 = ' + mysql.escape(req.session.user)+
				' AND content LIKE '+ mysql.escape('%'+q+'%')+ ' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("619")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q != null && following == true && username == null && parent == null && replies == true){
			console.log("WTF2")
			connection.query('SELECT T.* FROM Tweets T, Following F WHERE T.username = F.User2 AND F.User1 = ' + mysql.escape(req.session.user)+
				' AND content LIKE '+ mysql.escape('%'+q+'%')+ ' AND parent is NOT NULL AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("619")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if(q != null && following == true && username == null && parent != null){
					console.log("WTF3")

			connection.query('SELECT T.* FROM Tweets T, Following F WHERE T.username = F.User2 AND F.User1 = ' + mysql.escape(req.session.user)+
				' AND content LIKE '+ mysql.escape('%'+q+'%')+ ' AND parent = ' + mysql.escape(parent)+ ' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("619")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}

		else if(q != null && following ==false && username != null && parent == null  && (replies == false || replies == null)){
			console.log("SEARCH HEREEEEEEEEEEEEEE");
			connection.query('SELECT * FROM Tweets WHERE username = ' + mysql.escape(username)+
				' AND content LIKE '+ mysql.escape('%'+q+'%')+ ' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("641")

						res.send({
							status: "error",
							error: err
						})
					}else{
						console.log(result);
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							console.log("LMAO");
							response.items.push(JSON.parse(JSON.stringify(result[i])))
							if(i == result.length -1){
								console.log("OKAY!!!");
								res.send(response);
							}
						}
					}
				})
		}
		else if (q != null && following == false && username != null && parent == null && replies == true){

			connection.query('SELECT * FROM Tweets WHERE username =' + mysql.escape(username)+
				' AND content LIKE '+ mysql.escape('%'+q+'%')+ ' AND parent IS NOT NULL AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("641")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q != null && following == false && username != null && parent != null){
					console.log("WTF5")

			connection.query('SELECT * FROM Tweets WHERE username =' + mysql.escape(username)+
				' AND content LIKE '+ mysql.escape('%'+q+'%')+ ' AND parent = ' + mysql.escape(parent) + ' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("641")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if(q != null && following ==false && username == null && parent == null  && (replies == false || replies == null)){

			connection.query('SELECT * FROM Tweets WHERE content LIKE '+ mysql.escape('%'+q+'%')+ ' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("662")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if(q != null && following == false && username == null && parent == null && replies == true){
			connection.query('SELECT * FROM Tweets WHERE content LIKE '+ mysql.escape('%'+q+'%')+ ' AND parent IS NOT NULL AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("662")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})

		}

		else if(q != null && following == false && username == null && parent != null){
					console.log("WTF7")

			connection.query('SELECT * FROM Tweets WHERE content LIKE '+ mysql.escape('%'+q+'%')+ ' AND parent = ' + mysql.escape(parent) + ' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("662")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}

		else if(q == null && following != null && username != null){
			res.send({
				status: "OK",
				items: []
			})
		}
		else if(q == null && following == true && username == null && parent == null && (replies == false || replies == null)){
			connection.query('SELECT T.* FROM Tweets T, Following F WHERE T.username = F.User2 AND F.User1 = ' + mysql.escape(req.session.user)+
				' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("690")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q == null && following == true && username == null && parent == null && replies == true){
			connection.query('SELECT T.* FROM Tweets T, Following F WHERE T.username = F.User2 AND F.User1 = ' + mysql.escape(req.session.user)+
				' AND parent IS NOT NULL AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("690")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q == null && following == true && username == null && parent != null){
			onnection.query('SELECT T.* FROM Tweets T, Following F WHERE T.username = F.User2 AND F.User1 = ' + mysql.escape(req.session.user)+ ' AND T.parent = ' + mysql.escape(parent) +
				' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("690")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if(q == null && following == false && username != null && parent == null && (replies == false || replies == null)){
			connection.query('SELECT * FROM Tweets WHERE username =' + mysql.escape(username)+
				' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("712")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q == null && following == false && username != null && parent == null && replies == true){
			connection.query('SELECT * FROM Tweets WHERE username =' + mysql.escape(username)+
				' AND parent IS NOT NULL AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("712")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if(q == null && following == false && username != null && parent != null){
			connection.query('SELECT * FROM Tweets WHERE username =' + mysql.escape(username)+ ' AND parent = ' +
				' AND timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("712")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})	
		}
		else if(q == null && following ==false && username == null && parent == null && (replies == false || replies == null)){

			connection.query('SELECT * FROM Tweets timestamp <= '+mysql.escape(newStamp)+ ' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("733")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
		else if (q == null && following == false && username == null && parent == null && replies == true){
			connection.query('SELECT * FROM Tweets timestamp <= '+mysql.escape(newStamp)+  ' AND parent IS NOT NULL ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("733")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}

		else if(q == null && following == false && username == null && parent != null){
			connection.query('SELECT * FROM Tweets timestamp <= '+mysql.escape(newStamp)+ ' AND parent = '+ mysql.escape(parent) +' ORDER BY timestamp DESC LIMIT 25', function(err, result){
					if(err){
						console.log("733")

						res.send({
							status: "error",
							error: err
						})
					}else{
						var response = {
							status: "OK",
							items: []
						}
						for(var i = 0; i< result.length; i++){
							response.items.push(JSON.parse(JSON.stringify(result[i])))
						}
						res.send(response);
					}
				})
		}
	}
})
app.post('/searchOld',function(req,res){
	var newStamp = req.body.timestamp || dateTime;
	//console.log("THIS IS NEW STAMP"  + newStamp)
	//console.log(req.body);
	//var limit = Number(req.body.limit) || 25;
	//console.log("THIS IS LIMIt" + limit)

	var q = req.body.q;
	
	var query;
if (q != null){
	if(req.body.username != null){
		query = {
			$text:{
				$search:q
			},
			username:req.body.username,
			timestamp:{
				$lte:newStamp
			}
		}
	}
	else{
		query ={
			$text:{
				$search:q
			},
			timestamp:{
				$lte:newStamp
			}
		}
	}	
}
else{
	if(req.body.username != null){
		query = {
			username:req.body.username,
			timestamp:{
				$lte:newStamp
			}
		}
	}
	else{
		query ={
			timestamp:{
				$lte:newStamp
			}
		}
	}	
}


//console.log(query)


	mongoClient.connect(url,function(err,db){
		assert.equal(null,err);
		
	if (req.body.limit != null && req.body.limit != ""){
		db.collection('tweets').find(query).sort({timestamp:-1}).limit(Number(req.body.limit)).toArray(function(err,doc){
						if(err){
				console.log(err)
			}
			if (doc != null){
				var list = [];
				for (var i = 0; i<=doc.length; i++){
					if (i == doc.length){
							if (req.body.following == true){
								connection.query('SELECT User2 From Following where User1 =' + mysql.escape(req.body.user) + ';',function(err,result){
								if(err){
									console.log(err)
								}
								else{
									
									var newList = [];

									var string = JSON.stringify(result);
									var jsonArrayOfFollowing = JSON.parse(string);
									var parsingJsonArray = [];
									for (var k = 0; k<=jsonArrayOfFollowing.length; k++){
										if (k == jsonArrayOfFollowing.length){
											for(var j = 0; j<=list.length; j++){
												if(j == list.length){
													//console.log(newList);
													var toReturn = {
													status:"OK",
													items: newList
													}
													res.send(toReturn);
												}
												else{
													if(parsingJsonArray.indexOf(list[j].username) >= 0){
														newList.push(list[j]);
													}
													else{
													}
												}
											}
										}
										else{
											parsingJsonArray.push(jsonArrayOfFollowing[k].User2)
										}
									}

								}
							})
						}
						else{
							var response = {
								status: "OK",
								items: list
							}
							res.send(response);
						}
					}
					else{
						var json = {
						content: doc[i].content,
						parent: doc[i].parent,
						username: doc[i].username,
						timestamp: doc[i].timestamp,
						id: doc[i]._id
						}
						list.push(json);
					}
					
				}
			}
		})
	}



	else{
		db.collection('tweets').find(query).sort({timestamp:-1}).limit(25).toArray(function(err,doc){
			if(err){
				console.log(err)
			}
			if (doc != null){
				var list = [];
				for (var i = 0; i<=doc.length; i++){
					if (i == doc.length){
							if (req.body.following == true){

								connection.query('SELECT User2 From Following where User1 =' + mysql.escape(req.body.user) + ';',function(err,result){
								if(err){
									console.log(err)
								}
								else{
									
									var newList = [];

									var string = JSON.stringify(result);
									var jsonArrayOfFollowing = JSON.parse(string);
									var parsingJsonArray = [];
									for (var k = 0; k<=jsonArrayOfFollowing.length; k++){
										if (k == jsonArrayOfFollowing.length){
											for(var j = 0; j<=list.length; j++){
												if(j == list.length){
													//console.log(newList);
													var toReturn = {
													status:"OK",
													items: newList
													}
													res.send(toReturn);
												}
												else{
													if(parsingJsonArray.indexOf(list[j].username) >= 0){
														newList.push(list[j]);
													}
													else{
													}
												}
											}
										}
										else{
											parsingJsonArray.push(jsonArrayOfFollowing[k].User2)
										}
									}

								}
							})
						}
						else{
							var response = {
								status: "OK",
								items: list
							}
							res.send(response);
						}
					}
					else{
						var json = {
						content: doc[i].content,
						parent: doc[i].parent,
						username: doc[i].username,
						timestamp: doc[i].timestamp,
						id: doc[i]._id
						}
						list.push(json);
					}
					
				}
			}
		})
	}
	})
})

app.delete('/item/:id',function(req,res){
	//console.log(req.params.id);
	/*var id = require('mongodb').ObjectId(req.params.id);
	mongoClient.connect(url,function(err,db){
	assert.equal(null,err);
	db.collection('tweets').remove({'_id': id},function(err,doc){
		if (err){
			//console.log(err)
			res.send({
				status : "error"
			});
		}
		else{
			//console.log("TWEET DELETED");
			res.send({
				status : "OK"
			})
		}
	})
})*/
//console.log("in delete item")
	connection.query('SELECT media FROM Tweets WHERE id = '+mysql.escape(req.params.id), function(err,result){
		if(err){
			res.send({
				status: "error",
				error: err
			})
		}else{
			if(result.length!=0 && result[0].media != null){
			//	console.log("[\""+result[0].media.toString()+"\"]")
				chan.publish(exchange, 'chicken', new Buffer(result[0].media.toString()));
			}
		}
	})
	connection.query('DELETE FROM Tweets WHERE id = '+mysql.escape(req.params.id), function(err,result){
		if(err){
			res.send({
				status : "error",
				error : err
			})
		}else{
			res.send({
				status : "OK"
			})
		}
	})
})

app.get('/user/:username',function(req,res){
	var email, follower, following;
	connection.query('SELECT email FROM Users WHERE username = '+mysql.escape(req.params.username), function(err,result){
		if(err){
			res.send({
					status: "error",
					error: err
			})
		}else{
			email = result[0].email;
			connection.query('SELECT COUNT(User2) AS Following FROM Following WHERE User1 = '+ mysql.escape(req.params.username), function(err, result){
				if(err){
					res.send({
					status: "error",
					error: err
				})
				}else{
					following = result[0].Following;
					connection.query('SELECT COUNT(User1) AS Follower FROM Following WHERE User2 = '+ mysql.escape(req.params.username), function(err, result){
						if(err){
							res.send({
					status: "error",
					error: err
				})
						}else{
							follower = result[0].Follower;
							var response = {
								email : email,
								followers : follower,
								following : following
							}
							//console.log(response);
							res.send({
								status : "OK",
								user: response
							})
						}
					})
				}
			})
		}
	})
})

app.get('/user/:username/followers',function(req,res){
	//console.log(req.params.username)
	if(req.body.limit != null && req.body.limit != ""){
		connection.query('SELECT User1 From Following where User2 =' + mysql.escape(req.params.username) + ' LIMIT ' + mysql.escape(req.body.limit) + ';',function(err,result){
			if(err){
				console.log(err);
			}
			else{
				//console.log(result)
				res.send({status:"OK"});
			}
		})
	}
	else{
		connection.query('SELECT User1 From Following where User2 =' + mysql.escape(req.params.username) + ' LIMIT 50;',function(err,result){
			if(err){
				console.log(err);
			}
			else{
				var response = {
					status: "OK",
					users: result
				}
				res.send(response);
			}
		})
	}
})

app.get('/user/:username/following',function(req,res){
	//console.log(req.params.username)
	if(req.body.limit != null && req.body.limit != ""){
		connection.query('SELECT User2 From Following where User1 =' + req.params.username + ' LIMIT ' + req.body.limit + ';',function(err,result){
			if(err){
				console.log(err);
			}
			else{
				//console.log(result)
				res.send({status:"OK"});
			}
		})
	}
	else{
		connection.query('SELECT User2 From Following where User1 =' + mysql.escape(req.params.username) + ' LIMIT 50;',function(err,result){
			if(err){
				console.log(err);
			}
			else{
				var response = {
					status: "OK",
					users: result
				}
				res.send(response);
			}
		})
	}
})

app.post('/item/:id/like',function(req,res){
	//console.log('in here');
	if(req.body.like == true){
		//console.log("in true");
		connection.query('UPDATE Tweets SET LikeCounter = LikeCounter + 1 WHERE id =' + mysql.escape(req.params.id) + ';',function(err,result){
			if(err){
				var jsonToSend = {
					status: "error"
				}
				res.send(jsonToSend);
			}
			else{
				var jsonToSend = {
					status: "OK"
				}
				res.send(jsonToSend);
			}
		})
	}else if(req.body.like == false){
		console.log("in false");

		connection.query('UPDATE Tweets SET LikeCounter = LikeCounter - 1 WHERE id =' + mysql.escape(req.params.id) + ';',function(err,result){
			if(err){
				var jsonToSend = {
					status: "error"
				}
				res.send(jsonToSend);
			}
			else{
				var jsonToSend = {
					status: "OK"
				}
				res.send(jsonToSend);
			}
		})
	}
	else{
		res.send("???")
	}
})



app.post('/follow',function(req,res){
	//console.log(req.body);
	if(req.body.follow == true){
		//console.log("TRUE???")
		connection.query('INSERT INTO Following VALUES('+ mysql.escape(req.session.user) + ',' + mysql.escape(req.body.username) + ')', function(err,result){
		if(err){
			console.log(err);
			res.send({
				status: "error",
				error: err
			});
		}
		else{
			res.send({status: "OK"});
		}
	})
	}
	else{
		//console.log("FOLLOW IS NOT TRUE");
		connection.query('DELETE FROM Following WHERE User1 = '+mysql.escape(req.session.user) +' AND User2 = '+ mysql.escape(req.body.username), function(err,result){
			if(err){
				res.send({
				status: "error",
				error: err
			});
			}else{
				console.log(req.session.user +'has unfollow '+req.body.username);
				res.send({status: "OK"});
			}
		})
	}
})

app.post('/addmedia', function(req,res){
	var id = crypto.createHash('md5').update(req.files.content.name+cryptoRandomString(10)).digest('hex');
	var data = [id, req.files.content.data];
	cassandraClient.execute('INSERT INTO Media (id, content) VALUES (?, ?)',data, function(err, result){
		if(err){
			res.send({
				status: "error",
				error: err
			});
		}
		else{
			res.send({
				status: "OK",
				id: id
			});
		}
	})
})

app.get('/media/:id',function(req,res){
	//console.log(req.params.id);
	var query = 'SELECT content FROM Media WHERE id = ?';
	var par = [req.params.id.toString()];
	cassandraClient.execute(query, par, function(err,result){
		if(err){
			res.send({
				status: "error",
				error: err
			})
		}else if(result.rows.length == 0){
			res.send({
				status: "error",
				error: "no item found"
			})
		}else{
			res.writeHead(200,{'content-type': 'image/png'});
			res.write(new Buffer(result.rows[0].content), 'binary');
			res.end();
		}
	})
})


app.listen(8080, "172.31.64.118",function(){
	console.log("Server listening on port " + 9000);
})
