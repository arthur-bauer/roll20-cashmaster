
/*

CASHMASTER
v0.1
arthurbauer@me.com

*/



on('ready', function () {
          'use strict';

		  var v="0.1";
      
		  log("Cashmaster v"+v+" online. Use !cm for overview, !cmshare for splitting and !cmadd for adding cash!");
      
         on('chat:message', function(msg) {
          if (msg.type !== "api" && !playerIsGM(msg.playerid)) return;
          if (msg.content !== '!cm' && msg.content !== "!cmshare" && msg.content.startsWith("!cmadd")!== true) return;
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
                  output+= "<b>"+name+"</b><br>has "+pp+" platinum, "+gp+" gold, "+ep+" elektrum, "+sp+" silver, and "+cp+" copper.<br>Converted, this character has <span title='Equals roughly "+(total*25)+"USD'>"+total+" gp</span> in total.<hr>";
              }
          });
          
          partytotal=Math.round(partytotal*100,0)/100;
          
          output+= "<b><u>Party total: "+partytotal+"</u></b>}}";
          sendChat ("Cash master",output); 
          
          if (msg.content === "!cmshare")
          {
              output="";
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
              
              sendChat ("Cash master","/w gm &{template:desc} {{desc=<b>Let's share this!</b><hr>Everyone receives the equivalent of <b>"+cashshare+" gp:</b> "+pps+" platinum, "+gps+" gold, "+eps+" elektrum, "+sps+" silver, and "+cps+" copper.}}");

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
    
    
          if (msg.content.startsWith("!cmadd")== true)
          {
              
              var ppg=/([0-9 -]+)pp/;
              var ppa=ppg.exec(msg.content);

              var gpg=/([0-9 -]+)gp/;
              var gpa=gpg.exec(msg.content);

              var epg=/([0-9 -]+)ep/;
              var epa=epg.exec(msg.content);

              var spg=/([0-9 -]+)sp/;
              var spa=spg.exec(msg.content);

              var cpg=/([0-9 -]+)cp/;
              var cpa=cpg.exec(msg.content);

			  output="";

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
				  output+="<br><b>"+name+"</b>";
                  if (ppa) {setatt(character.id,"pp",parseInt(pp)+parseInt(ppa[1])); output+="<br> "+ppa[0];}
                  if (gpa) {setatt(character.id,"gp",parseInt(gp)+parseInt(gpa[1])); output+="<br> "+gpa[0];}
                  if (epa) {setatt(character.id,"ep",parseInt(ep)+parseInt(epa[1])); output+="<br> "+epa[0];}
                  if (spa) {setatt(character.id,"sp",parseInt(sp)+parseInt(spa[1])); output+="<br> "+spa[0];}
                  if (cpa) {setatt(character.id,"cp",parseInt(cp)+parseInt(cpa[1])); output+="<br> "+cpa[0];}
                  
                  
              }
              
		      });
              sendChat ("Cash master","/w gm &{template:desc} {{desc=<b>Cashing out - it's payday!</b><hr>Every selected character receives<br>"+output+"}}");
                      
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
