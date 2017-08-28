/**
* AWS Lambda function (Node JS) for Discogs Auto-Dig get release endpoint
* Aug 2017 Neil Kempin
*/

'use strict';
const doc = require('dynamodb-doc');
const dynamo = new doc.DynamoDB();
const http = require('https');

const TABLE_NAME = "<db table name>";
const DISCOGS_KEY = "<discogs api key>";
const DISCOGS_SECRET = "<discogs secret key>";
let id;

// is object empty
function objectEmpty(obj){
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

function discogsRequestCallback(res){
  return new Promise((resolve,reject)=>{
    res.setEncoding('utf8');
    let rawData = '';
    if(res.statusCode !== 200){
      // return useful information when not successful
      resolve({
        "headers": res.headers,
        "statusCode": res.statusCode,
      });
    }else{
      // 200 OK
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(rawData);
          resolve({
              "headers": res.headers,
              "statusCode": res.statusCode,
              "data" : parsedData
              });

        } catch (e) {
          console.log('http request error', e.message);
          reject(e);
        }
      });
    }
  });
}

// retrieve release data from discogs api
function fetchDataFromDiscogs(){
  return new Promise(function(resolve, reject){
    let options = {
        host: "api.discogs.com",
        path: `/releases/${id}`,
        headers: {
            'User-Agent': 'Discogs Auto-Dig',
            "Authorization": `Discogs key=${DISCOGS_KEY}, secret=${DISCOGS_SECRET}`
        }
    }
    http.get(options, function(res){
      discogsRequestCallback(res).then(function(data){
        resolve(data);
      }).catch(function(e){
        console.log('error ', e.message);
        reject(e);
      });
    });
  });
}


exports.handler = (event, context, callback) => {
    try{
      id = event.params.querystring.id;
      let payload = {
        "TableName" : TABLE_NAME,
        "Key" : {"id" : id}
      };
      dynamo.getItem(payload, function(err, data){
        if(err){
          callback(err);
          return
        }
        if(!objectEmpty(data)){
          // listing was found in dynamo database
          let response = JSON.parse(data['Item']['data']);
          callback(null, {'data': response});
        }else{
          // get data from discogs api instead
          fetchDataFromDiscogs().then(function(data){
            callback(null, data);
          });
        }
      });
    }catch(e){
      console.error('Error: ', e.message);
      callback(e);
    }
};
