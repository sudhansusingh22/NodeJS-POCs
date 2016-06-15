var graph    = require("../index")
  , FBConfig = require("./config").facebook
  , FireConfig = require("./config").fbase;

var async = require('async');
var firebase = require('firebase');

firebase.initializeApp({
serviceAccount: {
    projectId:   FireConfig.projectId,
    clientEmail: FireConfig.clientEmail,
    privateKey:  FireConfig.privateKey
  },
  databaseURL: FireConfig.kDBBaseRef
});

var db = firebase.database();


graph.setAppSecret(FBConfig.appSecret)
graph.setAccessToken(FBConfig.accessToken)
graph.setVersion("2.6");

var postResults = [];
var userResults = [];
var postDict = {};
var imageDict = {};
var userDict = {};

var postKeys = ["uId", "pName","pMessage", "pUrl", "pUpdatedTime", "pCreatedTime", "pPrice", "pLocation", "pImages"];
var userKeys = ["uId", "uName", "uPosts"];
var imageKeys = ["iId", "iUrl", "submittedBy", "pId"];

function getFBData(){
   async.waterfall([
    function(callback){
    	graph.get(FBConfig.groupUrl, function(err, res) {
  				callback(null, res.data);
		});
    },
    function(arg1, callback){
    	var userIds = [];
    	var str = "";
        arg1.forEach(function(value){
  				userIds.push(value.from.id);
  				str += "," + value.from.id;
		});
		str = str.substring(1,str.length);
		var url = "picture?ids=" +str+ "&redirect=false&type=large";
		graph.get(url, function(err, res) {
			var results = [];
			results.push(arg1);
			results.push(res);
			callback(null,results);
		});
    }
  ], function (err, result) {
	saveData(result);
  });
}


function saveData(result){
	postResults = result[0];
	userResults = result[1];
	postResults.forEach(function(json){
		var post = {};
		var postValue = [];
		
		var pId = json.id;
		var pName = json.name;
		var pMessage = json.message;
		var pUrl = json.link;
		var pCreatedTime = Date.parse(json.created_time)/1000;
		var pUpdatedTime = Date.parse(json.updated_time)/1000;
		var priceAndLoc = getPriceAndLoc(pMessage);
		var pPrice = priceAndLoc[0];
		var pLoc = priceAndLoc[1];
		
		var uId = json.from.id;
		var uName = json.from.name;
		
		var imgIdAndSrcArray = getImageIdAndUrl(json);
		
		var pImages = {};
		imgIdAndSrcArray[0].forEach(function (imgId){
			pImages[imgId] = true;
		});
		
		postValue.push(uId);
		postValue.push(pName);
		postValue.push(pMessage);
		postValue.push(pUrl);
		postValue.push(pUpdatedTime);
		postValue.push(pCreatedTime);
		postValue.push(pPrice);
		postValue.push(pLoc);
		postValue.push(pImages);
		
		for(var i=0; i<postKeys.length;i++){
			if(typeof postValue[i] == 'undefined'){
				post[postKeys[i]] = '';
			}
			else{
				post[postKeys[i]] = postValue[i];
			}
		}
		postDict[pId] = post;
// 		console.log(post);	
	});
	saveToDatabaseWithRef(FireConfig.kDBPostRef,postDict);   
}

function getPriceAndLoc(msg){
	var price = 0;
	var loc = "";
	var msgArray = msg.split("\n");
	if(msgArray.length>2){
		var priceAndLocArray = msgArray[1].split("-");
		if(priceAndLocArray.length>1){
			if(priceAndLocArray[0].trim().toUpperCase()=="FREE"){
				price = -1;
			}
			else if(priceAndLocArray[0].trim().length >0){
				var str = priceAndLocArray[0].trim();
				var p = str.replace( /^\D+/g, '');
				price = parseInt(p.match(/\d+/)[0])
			}
			if(priceAndLocArray[1].length>0){
				loc = priceAndLocArray[1].trim();
			}
		}
	}
	return [price, loc];
}

function getImageIdAndUrl(post){
	var imgSrcArray = [];
	var imgIdArray = [];
	if(typeof post.attachments!= 'undefined'){
		if(typeof post.attachments.data[0].subattachments != 'undefined'){
			var submedia = post.attachments.data[0].subattachments.data;
			submedia.forEach(function(img){
				imgSrcArray.push(img.media.image.src);
				imgIdArray.push(img.target.id);
			});
			return [imgIdArray, imgSrcArray];
		}
		else if(typeof post.attachments != 'undefined'){
			if( typeof post.attachments.data[0].media != 'undefined'){
				var postData = post.attachments.data[0];
					imgSrcArray.push(postData.media.image.src);
					imgIdArray.push(postData.target.id);
				if(typeof imgIdArray[0] == 'undefined'){
					imgIdArray[0] = new Date().getTime();
				}
			}
			return [imgIdArray, imgSrcArray];
		}
	} 
	return [imgIdArray, imgSrcArray];
}

var onComplete = function(error) {
  if (error) {
    console.log('Synchronization failed');
  } else {
    console.log('Synchronization succeeded');
    process.exit();
  }
};
function saveToDatabaseWithRef(childRef, data){
// 	var ref = new Firebase(FireConfig.kDBBaseRef);
// 	var postRef = ref.child(childRef);
	var postRef = db.ref("/posts");

	postRef.update(data,onComplete);

}



getFBData();