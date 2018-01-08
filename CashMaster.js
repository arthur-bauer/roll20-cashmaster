on('ready', function () {
          'use strict';
      
         on('chat:message', function(msg) {
          if (msg.type !== "api" && !playerIsGM(msg.playerid)) return;
          if (msg.content !== '!g' && msg.content !== "!gshare") return;
             var partytotal = 0;
             var output = "";
             var partycounter = 0;
          _.each(msg.selected, function(obj) {
              var token, character;
              token = getObj('graphic', obj._id);
              if (token) {
                  character = getObj('character', token.get('represents'));
              }
              if (character) {
	              partycounter++;
                  var name = getAttrByName(character.id, "character_name");
                  var pp = getAttrByName(character.id, "pp")*1;
                  var gp = getAttrByName(character.id, "gp")*1;                  
                  var ep = getAttrByName(character.id, "ep")*1;                  
                  var sp = getAttrByName(character.id, "sp")*1;
                  var cp = getAttrByName(character.id, "cp")*1;
                  var total = pp*10+gp+ep*0.5+cp/100+sp/10;
                  partytotal = total+partytotal;
                  sendChat ("Cash master","/w gm <b>"+name+"</b> has "+pp+" platinum, "+gp+" gold, "+ep+" elektrum, "+sp+" silver, and "+cp+" copper. Converted, this character has "+total+" gp in total.");
              }
          });
          
          partytotal=Math.round(partytotal*100,0)/100;
          
          sendChat ("Cash master","/w gm <b><u>Total: "+partytotal+"</u></b>");
          
          //if (msg.content === "!gshare")
          {
              
              _.each(msg.selected, function(obj) {
              var token, character;
              token = getObj('graphic', obj._id);
              var cashshare=partytotal/partycounter;
              sendChat ("Cash master","/w gm Everyone gets "+cashshare);
              if (token) {
                  character = getObj('character', token.get('represents'));
              }
              if (character) {
                  
              }
              
      });
                      
      }
    
});

});