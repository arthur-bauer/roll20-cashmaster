/* global on log playerIsGM findObjs getObj getAttrByName sendChat */

/*
CASHMASTER

A currency management script for the D&D 5e OGL sheets on roll20.net.
Please use `!cm` for inline help and examples.

arthurbauer@me.com
*/

on('ready', function () {
  const v = '%%version%%'; // version number
  const usd = 110; // conversion rate

  /*
  Change this if you want to have a rough estimation of a character's wealth in USD.
  After some research I believe a reasonable exchange ratio is roughly 1 gp = 110 USD
  Set it to 0 to disable it completely.
  */

  const scname = 'CashMaster'; // script name
  let selectedsheet = 'OGL'; // You can set this to "5E-Shaped" if you're using the Shaped sheet

  // detecting useroptions from one-click
  if (globalconfig && globalconfig.cashmaster && globalconfig.cashmaster.useroptions) {
    selectedsheet = globalconfig.cashmaster.useroptions.selectedsheet;
  }
  let rt = '';
  if (selectedsheet == 'OGL') {
    rt = ['desc', 'desc'];
  }
  else if (selectedsheet == '5E-Shaped') {
    rt = ['5e-shaped', 'freetext'];
  }

  log(scname + ' v' + v + ' online. Select one or more party members, then use `!cm --help` ');

  let pp;
  let gp;
  let ep;
  let sp;
  let cp;
  let total;
  let output;
  let ppa;
  let gpa;
  let epa;
  let spa;
  let cpa;
  let ppg;
  let gpg;
  let epg;
  let spg;
  let cpg;
  let name;
  let partycounter;
  let token;
  let character;

  on('chat:message', (msg) => {
    if (msg.type !== 'api' && !playerIsGM(msg.playerid)) return;
    if (msg.content.startsWith('!cm') !== true) return;
    if (msg.selected == null) {
      sendChat(scname, '/w gm **ERROR:** You need to select at least one character.');
      return;
    }

    let partytotal = 0;
    let partycounter = 0;
    const partymember = Object.entries(msg.selected).length;
    _.each(msg.selected, (obj) => {
      token = getObj('graphic', obj._id);
      if (token) {
        character = getObj('character', token.get('represents'));
      }
      if (character) {
        partycounter += 1;
        name = getAttrByName(character.id, 'character_name');
        pp = parseFloat(getattr(character.id, 'pp')) || 0;
        gp = parseFloat(getattr(character.id, 'gp')) || 0;
        ep = parseFloat(getattr(character.id, 'ep')) || 0;
        sp = parseFloat(getattr(character.id, 'sp')) || 0;
        cp = parseFloat(getattr(character.id, 'cp')) || 0;
        total = Math.round((pp * 10 + gp + ep * 0.5 + cp / 100 + sp / 10) * 10000) / 10000;
        partytotal = total + partytotal;
      }
    });

    partytotal = Math.round(partytotal * 100, 0) / 100;

    if (msg.content.includes('--help') || msg.content === '!cm') {
      sendChat(scname, '/w gm %%README%%');

    }

    if (msg.content.includes('--share') || msg.content.includes('--convert')) {
      output = '';
      const cashshare = partytotal / partycounter;
      let newcounter = 0;
      let pps = Math.floor(cashshare / 10);
      if (msg.content.includes('--share')) {
        pps = 0;
      }
      let rest = cashshare - pps * 10;
      const gps = Math.floor(rest);
      rest = (rest - gps) * 2;
      let eps = Math.floor(rest);
      if (msg.content.includes('--share')) {
        eps = 0;
      }
      rest = (rest - eps) * 5;
      const sps = Math.floor(rest);
      rest = (rest - sps) * 10;
      let cps = Math.round(rest);
      rest = (rest - cps) * partycounter;

      sendChat(scname, '/w gm &{template:' + rt[0] + '} {{' + rt[1] + '=<b>Let\'s share this!</b><hr>Everyone receives the equivalent of ' + cm_usd(cashshare) + ' gp: ' + pps + ' platinum, ' + gps + ' gold, ' + eps + ' electrum, ' + sps + ' silver, and ' + cps + ' copper.}}');

      _.each(msg.selected, function (obj) {
        let token;
        let character;
        newcounter += 1;
        token = getObj('graphic', obj._id);
        if (token) {
          character = getObj('character', token.get('represents'));
        }
        if (character) {
          setattr(character.id, 'pp', pps);
          setattr(character.id, 'gp', gps);
          setattr(character.id, 'ep', eps);
          setattr(character.id, 'sp', sps);
          // enough copper coins? If not, the last one in the group has to take the diff
          if (rest > 0.999 && newcounter == partycounter) {
            cps = cps + Math.round(rest);
          }
          if (rest < -0.999 && newcounter == partycounter) {
            cps = cps + Math.round(rest);
          }
          setattr(character.id, 'cp', cps);
        }

      });

    }
    if (msg.content.includes('--add')) {
      ppg = /([0-9 -]+)pp/;
      ppa = ppg.exec(msg.content);

      gpg = /([0-9 -]+)gp/;
      gpa = gpg.exec(msg.content);

      epg = /([0-9 -]+)ep/;
      epa = epg.exec(msg.content);

      spg = /([0-9 -]+)sp/;
      spa = spg.exec(msg.content);

      cpg = /([0-9 -]+)cp/;
      cpa = cpg.exec(msg.content);

      output = '';

      _.each(msg.selected, function (obj) {
        let token;
        let character;
        token = getObj('graphic', obj._id);
        if (token) {
          character = getObj('character', token.get('represents'));
        }
        if (character) {
          partycounter += 1;
          name = getAttrByName(character.id, 'character_name');
          pp = parseFloat(getattr(character.id, 'pp')) || 0;
          gp = parseFloat(getattr(character.id, 'gp')) || 0;
          ep = parseFloat(getattr(character.id, 'ep')) || 0;
          sp = parseFloat(getattr(character.id, 'sp')) || 0;
          cp = parseFloat(getattr(character.id, 'cp')) || 0;
          total = Math.round((pp * 10 + gp + ep * 0.5 + cp / 100 + sp / 10) * 10000) / 10000;
          partytotal = total + partytotal;
          output += '<br><b>' + name + '</b>';
          if (ppa) {
            setattr(character.id, 'pp', parseInt(pp) + parseInt(ppa[1]));
            output += '<br> ' + ppa[0];
          }
          if (gpa) {
            setattr(character.id, 'gp', parseInt(gp) + parseInt(gpa[1]));
            output += '<br> ' + gpa[0];
          }
          if (epa) {
            setattr(character.id, 'ep', parseInt(ep) + parseInt(epa[1]));
            output += '<br> ' + epa[0];
          }
          if (spa) {
            setattr(character.id, 'sp', parseInt(sp) + parseInt(spa[1]));
            output += '<br> ' + spa[0];
          }
          if (cpa) {
            setattr(character.id, 'cp', parseInt(cp) + parseInt(cpa[1]));
            output += '<br> ' + cpa[0];
          }
        }
      });
      sendChat(scname, '/w gm &{template:' + rt[0] + '} {{' + rt[1] + '=<b>Cashing out - it\'s payday!</b><hr>' + output + '}}');
    }

    if (msg.content.includes('--pay')) {
      ppg = /([0-9 -]+)pp/;
      ppa = ppg.exec(msg.content);

      gpg = /([0-9 -]+)gp/;
      gpa = gpg.exec(msg.content);

      epg = /([0-9 -]+)ep/;
      epa = epg.exec(msg.content);

      spg = /([0-9 -]+)sp/;
      spa = spg.exec(msg.content);

      cpg = /([0-9 -]+)cp/;
      cpa = cpg.exec(msg.content);

      output = '';

      _.each(msg.selected, function (obj) {
        let token;
        let character;
        token = getObj('graphic', obj._id);
        if (token) {
          character = getObj('character', token.get('represents'));
        }
        if (character) {
          partycounter += 1;
          name = getAttrByName(character.id, 'character_name');
          pp = parseFloat(getattr(character.id, 'pp')) || 0;
          gp = parseFloat(getattr(character.id, 'gp')) || 0;
          ep = parseFloat(getattr(character.id, 'ep')) || 0;
          sp = parseFloat(getattr(character.id, 'sp')) || 0;
          cp = parseFloat(getattr(character.id, 'cp')) || 0;

          // ! cmpay
          let startamount = [pp, gp, ep, sp, cp];
          if (ppa !== null) startamount = cm_changemoney(startamount, ppa[0]);
          if (gpa !== null) startamount = cm_changemoney(startamount, gpa[0]);
          if (epa !== null) startamount = cm_changemoney(startamount, epa[0]);
          if (spa !== null) startamount = cm_changemoney(startamount, spa[0]);
          if (cpa !== null) startamount = cm_changemoney(startamount, cpa[0]);

          output += '<br><b>' + name + '</b> has ';
          if (startamount === 'ERROR: Not enough cash.') output += 'not enough cash!';
          else {
            setattr(character.id, 'pp', parseInt(startamount[0]));
            output += '<br> ' + startamount[0] + 'pp';
            setattr(character.id, 'gp', parseInt(startamount[1]));
            output += '<br> ' + startamount[1] + 'gp';
            setattr(character.id, 'ep', parseInt(startamount[2]));
            output += '<br> ' + startamount[2] + 'ep';
            setattr(character.id, 'sp', parseInt(startamount[3]));
            output += '<br> ' + startamount[3] + 'sp';
            setattr(character.id, 'cp', parseInt(startamount[4]));
            output += '<br> ' + startamount[4] + 'cp';
          }
        }
      });
      sendChat(scname, '/w gm &{template:' + rt[0] + '} {{' + rt[1] + '=<b>Cashing out - it\'s payday!</b><hr>' + output + '}}');
    }

    if (msg.content.includes('--hoard')) {
      ppg = /([0-9 -]+)pp/;
      ppa = ppg.exec(msg.content);

      gpg = /([0-9 -]+)gp/;
      gpa = gpg.exec(msg.content);

      epg = /([0-9 -]+)ep/;
      epa = epg.exec(msg.content);

      spg = /([0-9 -]+)sp/;
      spa = spg.exec(msg.content);

      cpg = /([0-9 -]+)cp/;
      cpa = cpg.exec(msg.content);

      output = '';
      partycounter = 0;

      _.each(msg.selected, function (obj) {
        let token;
        let character;
        token = getObj('graphic', obj._id);
        if (token) {
          character = getObj('character', token.get('represents'));
        }
        if (character) {
          partycounter += 1;
          name = getAttrByName(character.id, 'character_name');
          pp = parseFloat(getattr(character.id, 'pp')) || 0;
          gp = parseFloat(getattr(character.id, 'gp')) || 0;
          ep = parseFloat(getattr(character.id, 'ep')) || 0;
          sp = parseFloat(getattr(character.id, 'sp')) || 0;
          cp = parseFloat(getattr(character.id, 'cp')) || 0;

          let ppt;
          let gpt;
          let ept;
          let spt;
          let cpt;

          if (ppa !== null) {
            ppt = cashsplit(ppa[1], partymember, partycounter);
          }
          if (gpa !== null) {
            gpt = cashsplit(gpa[1], partymember, partycounter);
          }
          if (epa !== null) {
            ept = cashsplit(epa[1], partymember, partycounter);
          }
          if (spa !== null) {
            spt = cashsplit(spa[1], partymember, partycounter);
          }
          if (cpa !== null) {
            cpt = cashsplit(cpa[1], partymember, partycounter);
          }

          output += '<br><b>' + name + '</b>';
          if (ppa) {
            setattr(character.id, 'pp', parseInt(pp) + parseInt(ppt));
            output += '<br> ' + ppt + 'pp';
          }
          if (gpa) {
            setattr(character.id, 'gp', parseInt(gp) + parseInt(gpt));
            output += '<br> ' + gpt + 'gp';
          }
          if (epa) {
            setattr(character.id, 'ep', parseInt(ep) + parseInt(ept));
            output += '<br> ' + ept + 'ep';
          }
          if (spa) {
            setattr(character.id, 'sp', parseInt(sp) + parseInt(spt));
            output += '<br> ' + spt + 'sp';
          }
          if (cpa) {
            setattr(character.id, 'cp', parseInt(cp) + parseInt(cpt));
            output += '<br> ' + cpt + 'cp';
          }
        }
      });
      sendChat(scname, '/w gm &{template:' + rt[0] + '} {{' + rt[1] + '=<b>You are splitting up the coins among you</b><hr>' + output + '}}');
    }

    if (msg.content.includes('--add') || msg.content.includes('--pay') || msg.content.includes('--share') || msg.content.includes('--convert') || msg.content.includes('--hoard') || msg.content.includes('--overview')) {
      let partytotal = 0;
      let output = '/w gm &{template:' + rt[0] + '} {{' + rt[1] + '=<b>Party\'s cash overview</b><hr>';
      let partycounter = 0;
      const partymember = Object.entries(msg.selected).length;
      _.each(msg.selected, function (obj) {
        let token;
        let character;
        token = getObj('graphic', obj._id);
        if (token) {
          character = getObj('character', token.get('represents'));
        }
        if (character) {
          partycounter += 1;
          name = getAttrByName(character.id, 'character_name');
          pp = parseFloat(getattr(character.id, 'pp')) || 0;
          gp = parseFloat(getattr(character.id, 'gp')) || 0;
          ep = parseFloat(getattr(character.id, 'ep')) || 0;
          sp = parseFloat(getattr(character.id, 'sp')) || 0;
          cp = parseFloat(getattr(character.id, 'cp')) || 0;
          total = Math.round((pp * 10 + gp + ep * 0.5 + cp / 100 + sp / 10) * 10000) / 10000;
          partytotal = total + partytotal;
          output += '<b>' + name + '</b><br>has ';
          if (pp !== 0) output += pp + ' platinum, ';
          if (gp !== 0) output += gp + ' gold, ';
          if (ep !== 0) output += ep + ' electrum, ';
          if (sp !== 0) output += sp + ' silver,  ';
          if (cp !== 0) output += cp + ' copper.';

          output += '<br>Converted, this character has ' + cm_usd(total) + ' gp';
          output += ' in total.<hr>';
        }
      });
      partytotal = Math.round(partytotal * 100, 0) / 100;

      output += '<b><u>Party total: ' + cm_usd(partytotal) + ' gp</u></b>}}';
      sendChat(scname, output);
    }
  });
});


function cashsplit(c, m, x) {
  let ct = 0;
  let cr = 0;
  if (c !== null) {
    ct = Math.floor(c / m);
    cr = c % m;
    if (cr >= x || (c < 0 && cr < 0 && -cr < x)) {
      ct += 1;
    }
  }
  return ct;
}

function getattr(cid, att) {
  let attr = findObjs({type: 'attribute', characterid: cid, name: att})[0];
  if (attr) {
    let cur = attr.get('current'); // .get()
    //  log(`${att}: ${cur}`);
    return cur;
  }
}

function setattr(cid, att, val) {
  let attr = findObjs({type: 'attribute', characterid: cid, name: att})[0];
  if (attr) {
    // log(`${att}: ${cur}->${val}`);
    attr.setWithWorker({current: parseInt(val)}); // .set()
  }
}

function cm_changemoney(startamount, addamount) {
  if (addamount !== null) {
    const currency = addamount.slice(-2);
    const amount2 = -parseInt(addamount.substr(0, addamount.length - 2));
    const origamount = startamount;
    let amount3 = 0;
    if (currency === 'cp') {
      amount3 = amount2 / 100;
    }
    if (currency === 'sp') {
      amount3 = amount2 / 10;
    }
    if (currency === 'ep') {
      amount3 = amount2 / 2;
    }
    if (currency === 'gp') {
      amount3 = amount2;
    }
    if (currency === 'pp') {
      amount3 = amount2 * 10;
    }
    if (startamount[0] * 10 + startamount[1] + startamount[2] / 2 + startamount[3] / 10 + startamount[4] / 100 >= -amount3) {
      startamount[4] += amount3 * 100;
      while (startamount[4] < 0) {
        startamount[4] += 10;
        startamount[3]--;
      } //cp
      while (startamount[3] < 0) {
        if (startamount[4] >= 10) {
          startamount[4] -= 10;
          startamount[3]++
        } else {
          startamount[3] += 5;
          startamount[2]--;
        }
      } //sp
      while (startamount[2] < 0) {
        if (startamount[3] >= 5) {
          startamount[3] -= 5;
          startamount[4]++
        } else {
          startamount[2] += 2;
          startamount[1]--;
        }
      }   //ep
      while (startamount[1] < 0) {
        if (startamount[2] >= 2) {
          startamount[2] -= 2;
          startamount[1]++
        } else {
          startamount[1] += 10;
          startamount[0]--;
        }
      } //gp
      while (startamount[0] < 0) {
        if (startamount[1] >= 10) {
          startamount[1] -= 10;
          startamount[0]++
        } else {
          startamount = origamount;
          return 'ERROR: Not enough cash.';
        }
      } //pp
      return startamount;
    }
    else return 'ERROR: Not enough cash.';
  }
}

function cm_usd(total, usd = 110) {
  let output = '';
  if (usd > 0) {
    output = `<span title="Equals roughly ${(Math.round((total * usd) / 5) * 5)} USD">${total}</span>`;
  } else {
    output = total;
  }
  return output;
}
