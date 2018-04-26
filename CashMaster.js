/* global on log playerIsGM findObjs getObj getAttrByName sendChat globalconfig */

/*
CASHMASTER %%version%%

A currency management script for the D&D 5e OGL sheets on roll20.net.
Please use `!cm` for inline help and examples.

arthurbauer@me.com
*/

const cashsplit = (c, m, x) => {
  //! cashsplit
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
};

const getattr = (cid, att) => {
  //! getattr
  const attr = findObjs({
    type: 'attribute',
    characterid: cid,
    name: att,
  })[0];
  if (attr) {
    return attr.get('current');
  }
  return '';
};

const setattr = (cid, att, val) => {
  //! setattr
  const attr = findObjs({
    type: 'attribute',
    characterid: cid,
    name: att,
  })[0];
  if (typeof attr === 'undefined' || attr == null) {
    const attr = createObj('attribute', { name: att, characterid: cid, current: parseFloat(val) }); // eslint-disable-line no-unused-vars, no-undef, no-shadow
  } else {
    attr.setWithWorker({
      current: parseFloat(val),
    }); // .set()
  }
};

const changeMoney = (startamount, addamount) => {
  //! changeMoney
  if (addamount !== null) {
    let total = startamount;

    const currency = addamount.slice(-2);
    const amount2 = -parseFloat(addamount.substr(0, addamount.length - 2));
    const origamount = total;
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
    if (
      (total[0] * 10) +
      total[1] +
      (total[2] / 2) +
      (total[3] / 10) +
      (total[4] / 100)
      >= -amount3
    ) {
      total[4] += amount3 * 100;
      while (total[4] < 0) {
        total[4] += 10;
        total[3] -= 1;
      } // cp
      while (total[3] < 0) {
        if (total[4] >= 10) {
          total[4] -= 10;
          total[3] += 1;
        } else {
          total[3] += 5;
          total[2] -= 1;
        }
      } // sp
      while (total[2] < 0) {
        if (total[3] >= 5) {
          total[3] -= 5;
          total[2] += 1;
        } else {
          total[2] += 2;
          total[1] -= 1;
        }
      } // ep
      while (total[1] < 0) {
        if (total[2] >= 2) {
          total[2] -= 2;
          total[1] += 1;
        } else {
          total[1] += 10;
          total[0] -= 1;
        }
      } // gp
      while (total[0] < 0) {
        if (total[1] >= 10) {
          total[1] -= 10;
          total[0] += 1;
        } else {
          total = origamount;
          return 'ERROR: Not enough cash.';
        }
      } // pp
      return total;
    }
    return 'ERROR: Not enough cash.';
  }
  return 0;
};

const toUsd = (total, usd = 110) => {
  //! toUsd
  let output = '';
  if (usd > 0) {
    output = `${total} gp <small>(~ ${(Math.round((total * usd) / 5) * 5)} USD)</small>`;
  } else {
    output = `${total} gp`;
  }
  return output;
};

const myoutput = (character, usd = 110) => {
  //! myoutput

  const name = getAttrByName(character.id, 'character_name');
  const pp = parseFloat(getattr(character.id, 'pp')) || 0;
  const gp = parseFloat(getattr(character.id, 'gp')) || 0;
  const ep = parseFloat(getattr(character.id, 'ep')) || 0;
  const sp = parseFloat(getattr(character.id, 'sp')) || 0;
  const cp = parseFloat(getattr(character.id, 'cp')) || 0;
  const total = Math.round((
    (pp * 10) +
  (ep * 0.5) +
  gp +
  (sp / 10) +
  (cp / 100)
  ) * 10000) / 10000;
  const weight = (pp + gp + ep + sp + cp) / 50;

  let output = `${name}: <b>${toUsd(total, usd)}</b><br><small>`;
  if (pp) output += `<em style='color:blue;'>${pp} pp</em>, `;
  if (gp) output += `<em style='color:orange;'>${gp} gp</em>, `;
  if (ep) output += `<em style='color:silver;'>${ep} ep</em>, `;
  if (sp) output += `<em style='color:grey;'>${sp} sp</em>, `;
  if (cp) output += `<em style='color:brown;'>${cp} cp</em>`;

  output += `<br>(${weight} lbs)</small><br><br>`;
  return [output, total];
};


on('ready', () => {
  const v = '%%version%%'; // version number
  const usd = 110;
  /*
  Change this if you want to have a rough estimation of a character’s wealth in USD.
  After some research I believe a reasonable exchange ratio is roughly 1 gp = 110 USD
  Set it to 0 to disable it completely.
  */

  const scname = 'CashMaster'; // script name
  let selectedsheet = 'OGL'; // You can set this to "5E-Shaped" if you're using the Shaped sheet

  // detecting useroptions from one-click
  if (globalconfig && globalconfig.cashmaster && globalconfig.cashmaster.useroptions) {
    selectedsheet = globalconfig.cashmaster.useroptions.selectedsheet; // eslint-disable-line prefer-destructuring
  }
  let rt = '';
  if (selectedsheet === 'OGL') {
    rt = ['desc', 'desc'];
  } else if (selectedsheet === '5E-Shaped') {
    rt = ['5e-shaped', 'text'];
  } else {
    rt = ['default', `name=${scname} }}{{note`];
  }


  log(`${scname} v${v} online. Select one or more party members, then use \`!cm -help\``);

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
  let usd2;

  on('chat:message', (msg) => {
    if (msg.type !== 'api' || !playerIsGM(msg.playerid)) return;
    if (msg.content.startsWith('!cm') !== true) return;
    if (msg.selected == null) {
      sendChat(scname, '/w gm **ERROR:** You need to select at least one character.');
      return;
    }

    let partytotal = 0;
    let partycounter = 0;
    const partymember = Object.entries(msg.selected).length;
    msg.selected.forEach((obj) => {
      const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
      let character;
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
        total = Math.round((
          (pp * 10) +
          (ep * 0.5) +
          gp +
          (sp / 10) +
          (cp / 100)
        ) * 10000) / 10000;
        partytotal = total + partytotal;
      }
    });

    partytotal = Math.round(partytotal * 100, 0) / 100;

    if (msg.content.includes('-help') || msg.content === '!cm' || msg.content.includes('-h')) {
      //! help
      sendChat(scname, `/w gm %%README%%`); // eslint-disable-line quotes
    }

    if (msg.content.includes('-share') || msg.content.includes('-best-share') || msg.content.includes('-s') || msg.content.includes('-bs')) {
      //! share and convert
      output = '';
      const cashshare = partytotal / partycounter;
      let newcounter = 0;
      let pps = Math.floor(cashshare / 10);
      if (msg.content.includes('-share') || msg.content.includes('-s')) {
        pps = 0;
      }
      let rest = cashshare - (pps * 10);
      const gps = Math.floor(rest);
      rest = (rest - gps) * 2;
      let eps = Math.floor(rest);
      if (msg.content.includes('-share') || msg.content.includes('-s')) {
        eps = 0;
      }
      rest = (rest - eps) * 5;
      const sps = Math.floor(rest);
      rest = (rest - sps) * 10;
      let cps = Math.round(rest);
      rest = (rest - cps) * partycounter;

      sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Let’s share this!</b><hr>Everyone receives the equivalent of ${toUsd(cashshare)} gp: ${pps} platinum, ${gps} gold, ${eps} electrum, ${sps} silver, and ${cps} copper.}}`);

      msg.selected.forEach((obj) => {
        const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
        let character;
        newcounter += 1;
        if (token) {
          character = getObj('character', token.get('represents'));
        }
        if (character) {
          setattr(character.id, 'pp', pps);
          setattr(character.id, 'gp', gps);
          setattr(character.id, 'ep', eps);
          setattr(character.id, 'sp', sps);
          // enough copper coins? If not, the last one in the group has to take the diff
          if ((rest > 0.999 || rest < -0.999) && newcounter === partycounter) {
            cps += Math.round(rest);
          }
          setattr(character.id, 'cp', cps);
        }
      });
    }

    if (msg.content.includes('-add') || msg.content.includes('-a')) {
      //! add
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

      msg.selected.forEach((obj) => {
        const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
        let character;
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
          total = Math.round((
            (pp * 10) +
            (ep * 0.5) +
            gp +
            (sp / 10) +
            (cp / 100)
          ) * 10000) / 10000;
          partytotal = total + partytotal;
          output += `<br><b>${name}</b>`;
          if (ppa) {
            setattr(character.id, 'pp', parseFloat(pp) + parseFloat(ppa[1]));
            output += `<br> ${ppa[0]}`;
          }
          if (gpa) {
            setattr(character.id, 'gp', parseFloat(gp) + parseFloat(gpa[1]));
            output += `<br> ${gpa[0]}`;
          }
          if (epa) {
            setattr(character.id, 'ep', parseFloat(ep) + parseFloat(epa[1]));
            output += `<br> ${epa[0]}`;
          }
          if (spa) {
            setattr(character.id, 'sp', parseFloat(sp) + parseFloat(spa[1]));
            output += `<br> ${spa[0]}`;
          }
          if (cpa) {
            setattr(character.id, 'cp', parseFloat(cp) + parseFloat(cpa[1]));
            output += `<br> ${cpa[0]}`;
          }
        }
      });
      sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Cashing out - it’s payday!</b><hr>${output}}}`);
    }

    if (msg.content.includes('-pay') || msg.content.includes('-p')) {
      //! pay
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

      msg.selected.forEach((obj) => {
        const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
        let character;
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

          let startamount = [pp, gp, ep, sp, cp];
          if (ppa !== null) startamount = changeMoney(startamount, ppa[0]);
          if (gpa !== null) startamount = changeMoney(startamount, gpa[0]);
          if (epa !== null) startamount = changeMoney(startamount, epa[0]);
          if (spa !== null) startamount = changeMoney(startamount, spa[0]);
          if (cpa !== null) startamount = changeMoney(startamount, cpa[0]);

          output += `<br><b>${name}</b> has `;
          if (startamount === 'ERROR: Not enough cash.') output += 'not enough cash!';
          else {
            setattr(character.id, 'pp', parseFloat(startamount[0]));
            output += `<br> ${startamount[0]}pp`;
            setattr(character.id, 'gp', parseFloat(startamount[1]));
            output += `<br> ${startamount[1]}gp`;
            setattr(character.id, 'ep', parseFloat(startamount[2]));
            output += `<br> ${startamount[2]}ep`;
            setattr(character.id, 'sp', parseFloat(startamount[3]));
            output += `<br> ${startamount[3]}sp`;
            setattr(character.id, 'cp', parseFloat(startamount[4]));
            output += `<br> ${startamount[4]}cp`;
          }
        }
      });
      sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Cashing out - it’s payday!</b><hr>${output}}}`);
    }

    if (msg.content.includes('-loot') || msg.content.includes('-l')) {
      //! loot
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

      msg.selected.forEach((obj) => {
        const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
        let character;
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

          output += `<br><b>${name}</b>`;
          if (ppa) {
            setattr(character.id, 'pp', parseFloat(pp) + parseFloat(ppt));
            output += `<br> ${ppt}pp`;
          }
          if (gpa) {
            setattr(character.id, 'gp', parseFloat(gp) + parseFloat(gpt));
            output += `<br> ${gpt}gp`;
          }
          if (epa) {
            setattr(character.id, 'ep', parseFloat(ep) + parseFloat(ept));
            output += `<br> ${ept}ep`;
          }
          if (spa) {
            setattr(character.id, 'sp', parseFloat(sp) + parseFloat(spt));
            output += `<br> ${spt}sp`;
          }
          if (cpa) {
            setattr(character.id, 'cp', parseFloat(cp) + parseFloat(cpt));
            output += `<br> ${cpt}cp`;
          }
        }
      });
      sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>You are splitting up the coins among you</b><hr>${output}}}`);
    }

    if (msg.content.includes('-add') || msg.content.includes('-pay') || msg.content.includes('-share') || msg.content.includes('-best-share') || msg.content.includes('-loot') || msg.content.includes('-overview') || msg.content.includes('-a') || msg.content.includes('-p') || msg.content.includes('-s') || msg.content.includes('-bs') || msg.content.includes('-l') || msg.content.includes('-o')) {
      //! overview
      partytotal = 0;
      partycounter = 0;
      if (!msg.content.includes('--usd')) usd2 = 0;
      else usd2 = usd;
      output = `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Party’s cash overview</b><br><br>`;
      msg.selected.forEach((obj) => {
        const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
        let character;
        if (token) {
          character = getObj('character', token.get('represents'));
        }
        if (character) {
          output += myoutput(character, usd2)[0];
          partytotal += myoutput(character, usd2)[1];
        }
      });
      partytotal = Math.round(partytotal * 100, 0) / 100;

      output += `<b><u>Party total: ${toUsd(partytotal, usd2)}</u></b>}}`;
      sendChat(scname, output);
    }
  });
});
