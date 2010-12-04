(function() {
    setTimeout(function() {
      new Map();
    });
    
    function Map() {
        var objects = {};
        var $map = $('#map');
        var $orderactivity = $('#order-activity');
        var mapNewWidth = $map.width() * 0.9;
        var mapNewHeight = mapNewWidth * 0.9;
        var mapHeight = $map.height(mapNewHeight).height();
        var mapWidth = $map.width(mapNewWidth).width();
        var mapOffsetX;
        var mapOffsetY;
        var lastRequest = 0;
        var tweetQueue = [];
        var currentTweet = null;
        var lastUpdatedTweetId = 0;
        var oldTweets = [];
        var oldTweetPointer = null;
        var currentPage = 1; // twitter pagination
        var isDoneSearchingOldTweets = false;
        
        $('<div id="map-canvas"/>').appendTo($map).width(mapWidth).height(mapHeight);
        var map = Raphael($('#map-canvas').get(0), mapWidth, mapHeight);
        
        map.canvas.setAttribute('viewBox', '0 0 567 369');
        
        var mapSourceDiffX = (567 / $('svg').width());
        var mapSourceDiffY = (369 / $('svg').height());
        
        map.path(mapVector).attr({stroke: "#555"}).attr({'stroke-width': 0.4});
        
        $map.addClass('centered').css({
            'margin-top': '-' + ((mapHeight / 2) + 200) + 'px',
            'margin-left': '-' + (mapWidth / 2) + 'px'
        });
        
        requestMoreData();         
        // request new tweets every ten seconds
        setInterval(requestMoreData, 10000);
        // display a tweet each 15 seconds 
        setInterval(processQueue, 15000); 

       
        function expireMarkers() {
          var current = new Date().getTime();
          
          $.each(objects, function(i, object) {
            var diff = current - object.lastActivity;
            var opacity = (1 - diff / object.duration);

            if (opacity < 0) {  
              delete objects[object.id];
            }
            
            if (object.$marker) {
              object.$marker.css({opacity: opacity});         
              if (opacity < 0) { object.$marker.remove(); }
            }
          });         
        }
        
        function toFixed(str, dec) {
            var m = Math.pow(10, dec);
            var number = Math.round(str * m, 0) / m;
            if (number.toString().indexOf('.') === -1) {
                number += '.0';
            }
            if (!number.toString().match(/\.[0-9]{2}/)) {
                number += '0';
            }
            if (number.toString().indexOf('-') !== -1) {
                number = '0.00';
            }
            return number;
        }
        
        function replaceURLWithHTMLLinks(text) {
          var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
          return text.replace(exp,"<a href='$1' target='_blank'>$1</a>"); 
        }
        function createTweetMarker(tweet) { 
          var delayBase = 0         
          if(!tweet.hackfest.x || !tweet.hackfest.y) {
           return
          }
          
          // remove the previous tweet
          if(currentTweet){
            currentTweet.$message.remove();
            currentTweet = null;
          }
          
          // Now we attach the tweet to the map.
          tweet.$message = $('<div class="marker standard"></div>').appendTo($map); 
          message_html = "<span class='username'><a target='_blank' href='http://twitter.com/" + tweet.from_user +"'>" + tweet.from_user  + "</a></span><span class='date'>" + prettyDate(tweet.created_at) + "</span><br/>" + replaceURLWithHTMLLinks(tweet.text);
          label_html ="  <div class='meta hidden'>\
                           <div class='city'>" + tweet.hackfest.city + "</div>\
                           <div class='tweet'>\
                             <img class='pic' src='" + tweet.profile_image_url + "'/>\
                             <div class='message'>" + message_html + "</div>\
                           </div>\
                           <div style='clear:both'></div>\
                         </div>" 
          tweet.$label = $(label_html);
          tweet.$label.appendTo(tweet.$message)            
          tweet.$message.css({
            left: tweet.hackfest.x + 'px',
            top: tweet.hackfest.y + 'px'              
          });
          currentTweet = tweet;
            
                    
          setTimeout(function(){tweet.$label.removeClass("hidden")});
        }
        
        function latLngToPx(lat, lng) {
          lng = parseFloat(lng);
          lat = parseFloat(lat);
          
        
          var x = (mapWidth * (180 + lng) / 360) % mapWidth;
       
          lat = lat * Math.PI / 180;
          var y = Math.log(Math.tan((lat / 2) + (Math.PI / 4)));
          y = (mapHeight / 2) - (mapWidth * y / (2 * Math.PI));
        
          if (!mapOffsetX) {
            mapOffsetX = mapWidth * 0.026;
          }
          if (!mapOffsetY) {
            mapOffsetY = mapHeight * 0.141;
          }
          
          return {
            x: (x - mapOffsetX) * 0.97,
            y: (y + mapOffsetY + 200),
            xRaw: x,
            yRaw: y
          };
        }
        
        function geoCode(item) {
          var coords = latLngToPx(item.lat, item.long);
          item.x = coords.x;
          item.y = coords.y;
          return item;
        }


        function processQueue() {
            if (tweetQueue.length > 0) {
              var tweet = tweetQueue.pop();
              geoCode(tweet.hackfest);
              createTweetMarker(tweet);
              // Let's archive this tweet so we can play it back later if there are no more recent tweets.
              oldTweets.push(tweet);
            }
            else if(oldTweets.length > 0){   
              var tweet = oldTweets[Math.floor(Math.random()*oldTweets.length)];      
              geoCode(tweet.hackfest);
              createTweetMarker(tweet);
            }            
        }

        function requestMoreData() {
            // Needs to call tweetQueue.push(tweet)
           // twitterSearch(lastRequest, tweetQueue,false);
              getRecentTweets();
              getOldTweets();
              
              tweetStr=""
              oldTweetStr =""
              for(var i =0; i< tweetQueue.length;i++){
                tweetStr += tweetQueue[i].id_str + ","
              }
              for(var i =0; i< oldTweets.length;i++){
                oldTweetStr += oldTweets[i].id_str + ","
              }
              //console.log("New Tweet Queue: " + tweetStr);
              //console.log("Old Tweets: " + oldTweetStr);
        };
        
        function parseTweet(tweet,queue){
          // console.log(message);
          if(tweet.text) {
            airportCode = tweet.text.match(/\#(\w\w\w)\b/)
            if(airportCode) {
              airportCode = airportCode[1].toUpperCase();
              //console.log("found an airport code! " + airportCode);
              if(hackfests[airportCode]){
                tweet.hackfest = hackfests[airportCode];
                tweet.code = airportCode;
                queue.push(tweet);
                // Here we go into our list of hackfests, and we see if a marker
                // has been set. If it has, then we skip this step. If it hasn't, we attach a little marker.
                // That being said, the markers permanently stay there, but the tweets do not.
                if(hackfests[airportCode].$marker == null){
                  geoCode(hackfests[airportCode]);
                  hackfests[airportCode].$marker = $('<div class="marker standard"><img src="img/marker.png"></div>').appendTo($map);
                  hackfests[airportCode].$marker.css({
                    left: hackfests[airportCode].x + 'px',
                    top: hackfests[airportCode].y + 'px'              
                  });
                }
              }
            }
          }
        }
        
        function getRecentTweets(){
          url = "http://search.twitter.com/search.json?q=%23odhd&callback=?&rpp=100";
          
        
          if(lastUpdatedTweetId){
            url += "&since_id=" + lastUpdatedTweetId;
          }
          
          $.getJSON(url, function(data) {
            //console.log(data);
            messages = data.results;
            
            if(messages.length>0){
              lastUpdatedTweetId = messages[0].id_str;
            }
            
            // console.log(data.results)
            for (var i = messages.length - 1; i >= 0; i--){
              parseTweet(messages[i],tweetQueue);
            }
             // This will only run once after the very first search since oldTweetPointer gets set
             // after the first search
            if(oldTweetPointer==null && messages.length>0){
                processQueue();
                oldTweetPointer = messages[messages.length-1].id_str;
            }
          });
        };
        
        function getOldTweets() {
          if(oldTweetPointer!=null && !isDoneSearchingOldTweets){
            url = "http://search.twitter.com/search.json?q=%23odhd&rpp=100&callback=?&max_id=" + oldTweetPointer ;
          
            $.getJSON(url, function(data) {
             // console.log(data);
              messages = data.results;
            
              if(messages.length <= 0){
                isDoneSearchingOldTweets = true;
              } else{
                oldTweetPointer = messages[messages.length-1].id_str;
              }
        
              // console.log(data.results)
              // Note that we don't go all the way to zero since this tweet should have id = oldTweetPointer,
              // and it was already considered in the last run of getOldTweets.
              for (var i = messages.length - 1; i > 0; i--){
                parseTweet(messages[i],oldTweets);
              }
            });
          }
        }
    }    
  
})();
