
/*

CASHMASTER
v0.1
arthurbauer@me.com

*/



on('ready', function () {
          'use strict';
      
         on('chat:message', function(msg) {
          if (msg.type !== "api" && !playerIsGM(msg.playerid)) return;
          if (msg.content !== '!g' && msg.content !== "!gshare") return;
             var partytotal = 0;
             var output = "/w gm &{template:desc} {{desc=<b>Party's cash overview</b><hr>";
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
                  var total = Math.round((pp*10+gp+ep*0.5+cp/100+sp/10)*10000)/10000;
                  partytotal = total+partytotal;
                  output+= "<b>"+name+"</b><br>has "+pp+" platinum, "+gp+" gold, "+ep+" elektrum, "+sp+" silver, and "+cp+" copper.<br>Converted, this character has "+total+" gp in total.<hr>";
              }
          });
          
          partytotal=Math.round(partytotal*100,0)/100;
          
          output+= "<b><u>Total: "+partytotal+"</u></b>}}";
          sendChat ("Cash master",output); 
          
          if (msg.content === "!gshare")
          {
              
              var cashshare=partytotal/partycounter;
              var newcounter=0;
              var pps=Math.floor(cashshare/10);
              var rest=cashshare-pps*10;
              var gps=Math.floor(rest);
              rest=(rest-gps)*2;
              var eps=Math.floor(rest);
              rest=(rest-eps)*5;
              var sps=Math.floor(rest);
              rest=(rest-sps)*10;
              var cps=Math.round(rest);
              rest=(rest-cps)*partycounter;
              
              sendChat ("Cash master","/w gm &{template:desc} {{desc=<b>Cashing out - it's payday!</b><hr>Everyone receives the equivalent of <b>"+cashshare+" gp:</b> "+pps+" platinum, "+gps+" gold, "+eps+" elektrum, "+sps+" silver, and "+cps+" copper.}}");

              _.each(msg.selected, function(obj) {
              var token, character;
              newcounter++;
              token = getObj('graphic', obj._id);
              if (token) {
                  character = getObj('character', token.get('represents'));
              }
              if (character) {
                  setatt(character.id,"pp",pps);
                  setatt(character.id,"gp",gps);
                  setatt(character.id,"ep",eps);
                  setatt(character.id,"sp",sps);
                  if (rest>0.999 && newcounter==partycounter) cps++;
                  setatt(character.id,"cp",cps);
              }
              
      });
                      
      }
    
});

});

function setatt(char_id, attr_name, newVal) {
    var attribute = findObjs({
		_type: "attribute",
		_characterid: char_id,
		_name: attr_name
	})[0];

	if (attribute == undefined) {
		createObj("attribute", {
		name: attr_name,
		current: newVal,
		characterid: char_id
		});
		} else {
	attribute.set("current", newVal.toString());
	}
}
