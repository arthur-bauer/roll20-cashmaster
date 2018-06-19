/* global on log playerIsGM findObjs getObj getAttrByName sendChat globalconfig */

/*
CASHMASTER %%version%%

A currency management script for the D&D 5e OGL sheets on roll20.net.
Please use `!cm` for inline help and examples.

arthurbauer@me.com
*/

// How much each coing is worth of those below it.
// In order: pp, gp, ep, sp
const conversionRatio = [10, 2, 5, 10];

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

// Merge funds into the densest denomination possible.
// Account expects {pp, gp, ep, sp, cp}
const mergeMoney = (account) => {
  if (account == null) {
    return 'ERROR: Acount does not exist.';
  }
  if (account.length !== 5) {
    return 'ERROR: Account must be an array in the order of {pp, gp, ep, sp, cp}.';
  }

  for (let i = account.length - 1; i > 0; i -= 1) {
    const coinCount = account[i];
    const carry = Math.floor(coinCount / conversionRatio[i - 1]);
    const remainder = coinCount % conversionRatio[i - 1];
    account[i] = remainder; // eslint-disable-line no-param-reassign
    account[i - 1] += carry; // eslint-disable-line no-param-reassign
  }

  return account;
};

const toUsd = (total, usd = 110) => {
  //! toUsd
  let output = '';
  if (usd > 0) {
    output = `${total} gp <small><br>(~ ${(Math.round((total * usd) / 5) * 5)} USD)</small>`;
  } else {
    output = `${total} gp`;
  }
  return output;
};

const playerCoinStatus = (character, usd = 110) => {
  //! playerCoinStatus

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

  let output = `${name}: <b>$${toUsd(total, usd)}</b><br><small>`;
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
    if (msg.type !== 'api') return;
    if (msg.content.startsWith('!cm') !== true) return;
    log("CM Command: " + msg.content);
    if (msg.content.includes('-help') || msg.content === '!cm' || msg.content.includes('-h')) {
      //! help
      sendChat(scname, `/w gm %%README%%`); // eslint-disable-line quotes
    }

    if (msg.content.includes('-menu') || msg.content.includes('-tool')) {
      let menuContent = `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<h3>Cash Master</h3><hr>` +
        '<h4>Universal Commands</h4>[Toolbar](!cm -tool)' +
          '<br>[Status](!cm -status)' +
          '<br>[Transfer to PC](!cm -transfer &#34;?{Full Name of Recipient}&#34; ?{Currency to Transfer})' +
          '<br>[Transfer to NPC](!cm -giveNPC &#34;?{What are you doing and who is it going to?}&#34; ?{Currency to Transfer})';
      if(playerIsGM(msg.playerid)) {
        menuContent = menuContent +
        '<h4>GM-Only Commands</h4>'+
        '<b>Base Commands</b>'+
          '<br>[Readme](!cm -help)<br>[Party Overview](!cm -overview)'+
          '<br>[Party USD](!cm -overview --usd)'+
        '<br><b>Payment Commands</b>'+
          '<br>[Give Each Selected](!cm -add ?{Currency to Add})'+
          '<br>[Bill Each Selected](!cm -pay ?{Currency to Bill})'+
          '<br>[Split Among Selected](!cm -loot ?{Amount to Split})'+
        '<br><b>Conversion Commands</b>'+
          '<br>[Compress Coins of Selected](!cm -merge)'
      }
      menuContent = menuContent + '}}';
      sendChat(scname, menuContent);
      return;
    }

    if (msg.selected == null) {
      sendChat(scname, '/w gm **ERROR:** You need to select at least one character.');
      return;
    }

    // Coin Transfer between players
    if (msg.content.includes('-transfer')) {
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

      // Retrieve target name
      // Double quotes must be used because multiple players could have the same first name, last name, etc
      const startQuote = msg.content.indexOf('"');
      const endQuote = msg.content.lastIndexOf('"');
      if (startQuote >= endQuote) {
        sendChat(scname, '**ERROR:** You must specify a target by name within double quotes.');
        return;
      }
      const targetName = msg.content.substring(startQuote + 1, endQuote);

      // Retrieve target's id
      const list = findObjs({
        _type: 'character',
        name: targetName,
      });
      if (list.length === 0) {
        sendChat(scname, `**ERROR:** No character exists by the name ${targetName}.  Did you forget to include the surname?`);
        return;
      } else if (list.length > 1) {
        sendChat(scname, `**ERROR:** character name ${targetName} must be unique.`);
        return;
      }
      const targetId = list[0].id;

      output = '';
      let transactionOutput = '';
      let donorOutput = '';
      let targetOutput = '';

      if (msg.selected.length > 1) {
        sendChat(scname, '**ERROR:** Transfers can only have on sender.');
        return;
      }
      let donorName = '';
      msg.selected.forEach((obj) => {
        const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
        let donor;
        if (token) {
          donor = getObj('character', token.get('represents'));
        }
        if (donor) {
          // Check that the sender is not attempting to send money to themselves
          if (donor.id === targetId) {
            sendChat(scname, '**ERROR:** target character must not be selected character.');
            return;
          }

          // Verify donor has enough to perform transfer
          // Check if the player attempted to steal from another and populate the transaction data
          transactionOutput += '<br><b>Transaction Data</b>';
          if (ppa !== null) {
            const val = parseFloat(ppa[1]);
            transactionOutput += `<br> ${ppa[0]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} may not demand payment from ${targetName}.`);
              return;
            }
          }
          if (gpa !== null) {
            const val = parseFloat(gpa[1]);
            transactionOutput += `<br> ${gpa[0]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} may not demand payment from ${targetName}.`);
              return;
            }
          }
          if (epa !== null) {
            const val = parseFloat(epa[1]);
            transactionOutput += `<br> ${epa[0]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} may not demand payment from ${targetName}.`);
              return;
            }
          }
          if (spa !== null) {
            const val = parseFloat(spa[1]);
            transactionOutput += `<br> ${spa[0]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} may not demand payment from ${targetName}.`);
              return;
            }
          }
          if (cpa !== null) {
            const val = parseFloat(cpa[1]);
            transactionOutput += `<br> ${cpa[0]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `/w gm **ERROR:** ${msg.who} may not demand payment from ${targetName}.`);
              return;
            }
          }

          // Load donor's existing account
          donorName = getAttrByName(donor.id, 'character_name');
          const dpp = parseFloat(getattr(donor.id, 'pp')) || 0;
          const dgp = parseFloat(getattr(donor.id, 'gp')) || 0;
          const dep = parseFloat(getattr(donor.id, 'ep')) || 0;
          const dsp = parseFloat(getattr(donor.id, 'sp')) || 0;
          const dcp = parseFloat(getattr(donor.id, 'cp')) || 0;
          let donorAccount = [dpp, dgp, dep, dsp, dcp];

          if (ppa !== null) donorAccount = changeMoney(donorAccount, ppa[0]);
          if (gpa !== null) donorAccount = changeMoney(donorAccount, gpa[0]);
          if (epa !== null) donorAccount = changeMoney(donorAccount, epa[0]);
          if (spa !== null) donorAccount = changeMoney(donorAccount, spa[0]);
          if (cpa !== null) donorAccount = changeMoney(donorAccount, cpa[0]);

          // Verify donor has enough to perform transfer
          donorOutput += `<br><b>${donorName}</b> has `;
          if (donorAccount === 'ERROR: Not enough cash.') {
            donorOutput += 'not enough cash!';
          } else {
            // Update donor account and update output
            setattr(donor.id, 'pp', parseFloat(donorAccount[0]));
            setattr(donor.id, 'gp', parseFloat(donorAccount[1]));
            setattr(donor.id, 'ep', parseFloat(donorAccount[2]));
            setattr(donor.id, 'sp', parseFloat(donorAccount[3]));
            setattr(donor.id, 'cp', parseFloat(donorAccount[4]));
            donorOutput += `<br> ${donorAccount[0]}pp`;
            donorOutput += `<br> ${donorAccount[1]}gp`;
            donorOutput += `<br> ${donorAccount[2]}ep`;
            donorOutput += `<br> ${donorAccount[3]}sp`;
            donorOutput += `<br> ${donorAccount[4]}cp`;

            // targetFunds
            let tpp = parseFloat(getattr(targetId, 'pp')) || 0;
            let tgp = parseFloat(getattr(targetId, 'gp')) || 0;
            let tep = parseFloat(getattr(targetId, 'ep')) || 0;
            let tsp = parseFloat(getattr(targetId, 'sp')) || 0;
            let tcp = parseFloat(getattr(targetId, 'cp')) || 0;
            if (ppa !== null) tpp += parseFloat(ppa[1]);
            if (gpa !== null) tgp += parseFloat(gpa[1]);
            if (epa !== null) tep += parseFloat(epa[1]);
            if (spa !== null) tsp += parseFloat(spa[1]);
            if (cpa !== null) tcp += parseFloat(cpa[1]);

            setattr(targetId, 'pp', tpp);
            setattr(targetId, 'gp', tgp);
            setattr(targetId, 'ep', tep);
            setattr(targetId, 'sp', tsp);
            setattr(targetId, 'cp', tcp);
            targetOutput += `<br><b>${targetName}</b> has `;
            targetOutput += `<br> ${tpp}pp`;
            targetOutput += `<br> ${tgp}gp`;
            targetOutput += `<br> ${tep}ep`;
            targetOutput += `<br> ${tsp}sp`;
            targetOutput += `<br> ${tcp}cp`;
          }
        }
      });
      sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>GM Transfer Report</b><br>${donorName}>${targetName}</b><hr>${transactionOutput}${donorOutput}${targetOutput}}}`);
      sendChat(scname, `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<b>Sender Transfer Report</b><br>${donorName} > ${targetName}</b><hr>${output}${transactionOutput}${donorOutput}}}`);
      sendChat(scname, `/w ${targetName} &{template:${rt[0]}} {{${rt[1]}=<b>Recipient Transfer Report</b><br>${donorName} > ${targetName}</b><hr>${output}${transactionOutput}${targetOutput}}}`);
      return;
    }

    // Display coin count to player
    if (msg.content.includes('-status')) {
      output = '';

      msg.selected.forEach((obj) => {
        const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
        let character;
        if (token) {
          character = getObj('character', token.get('represents'));
        }
        if (character) {
          const coinStatus = playerCoinStatus(character);
          sendChat(scname, `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<b>Coin Purse Status</b></b><hr>${coinStatus[0]}}}`);
        }
      });
      return;
    }

    // Drop Currency or Give it to an NPC
    if (msg.content.includes('-dropWithReason') || msg.content.includes('-giveNPC')) {
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

      // Retrieve target name
      // Double quotes must be used because multiple players could have the same first name, last name, etc
      const startQuote = msg.content.indexOf('"');
      const endQuote = msg.content.lastIndexOf('"');
      if (startQuote >= endQuote) {
        sendChat(scname, '**ERROR:** You must specify a target by name within double quotes.');
        return;
      }
      const reason = msg.content.substring(startQuote + 1, endQuote);

      output = '';
      let transactionOutput = '';
      let donorOutput = '';
      let targetOutput = '';

      if (msg.selected.length > 1) {
        sendChat(scname, '**ERROR:** Transfers can only have on sender.');
        return;
      }
      let donorName = '';
      msg.selected.forEach((obj) => {
        const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
        let donor;
        if (token) {
          donor = getObj('character', token.get('represents'));
        }
        if (donor) {

          // Verify donor has enough to perform transfer
          // Check if the player attempted to steal from another and populate the transaction data
          transactionOutput += '<br><b>Transaction Data</b>';
          if (ppa !== null) {
            const val = parseFloat(ppa[1]);
            transactionOutput += `<br> ${ppa[0]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} tried to steal.`);
              return;
            }
          }
          if (gpa !== null) {
            const val = parseFloat(gpa[1]);
            transactionOutput += `<br> ${gpa[0]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} tried to steal.`);
              return;
            }
          }
          if (epa !== null) {
            const val = parseFloat(epa[1]);
            transactionOutput += `<br> ${epa[0]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} tried to steal.`);
              return;
            }
          }
          if (spa !== null) {
            const val = parseFloat(spa[1]);
            transactionOutput += `<br> ${spa[0]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} tried to steal.`);
              return;
            }
          }
          if (cpa !== null) {
            const val = parseFloat(cpa[1]);
            transactionOutput += `<br> ${cpa[0]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} tried to steal.`);
              return;
            }
          }

          // Load donor's existing account
          donorName = getAttrByName(donor.id, 'character_name');
          const dpp = parseFloat(getattr(donor.id, 'pp')) || 0;
          const dgp = parseFloat(getattr(donor.id, 'gp')) || 0;
          const dep = parseFloat(getattr(donor.id, 'ep')) || 0;
          const dsp = parseFloat(getattr(donor.id, 'sp')) || 0;
          const dcp = parseFloat(getattr(donor.id, 'cp')) || 0;
          let donorAccount = [dpp, dgp, dep, dsp, dcp];

          if (ppa !== null) donorAccount = changeMoney(donorAccount, ppa[0]);
          if (gpa !== null) donorAccount = changeMoney(donorAccount, gpa[0]);
          if (epa !== null) donorAccount = changeMoney(donorAccount, epa[0]);
          if (spa !== null) donorAccount = changeMoney(donorAccount, spa[0]);
          if (cpa !== null) donorAccount = changeMoney(donorAccount, cpa[0]);

          // Verify donor has enough to perform transfer
          donorOutput += `<br><b>${donorName}</b> has `;
          if (donorAccount === 'ERROR: Not enough cash.') {
            donorOutput += 'not enough cash!';
          } else {
            // Update donor account and update output
            setattr(donor.id, 'pp', parseFloat(donorAccount[0]));
            setattr(donor.id, 'gp', parseFloat(donorAccount[1]));
            setattr(donor.id, 'ep', parseFloat(donorAccount[2]));
            setattr(donor.id, 'sp', parseFloat(donorAccount[3]));
            setattr(donor.id, 'cp', parseFloat(donorAccount[4]));
            donorOutput += `<br> ${donorAccount[0]}pp`;
            donorOutput += `<br> ${donorAccount[1]}gp`;
            donorOutput += `<br> ${donorAccount[2]}ep`;
            donorOutput += `<br> ${donorAccount[3]}sp`;
            donorOutput += `<br> ${donorAccount[4]}cp`;
          }
        }
      });
      sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>GM Transfer Report</b><br>${donorName}</b><hr>${reason}<hr>${transactionOutput}${donorOutput}}}`);
      sendChat(scname, `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<b>Sender Transfer Report</b><br>${donorName}</b><hr>${reason}<hr>${output}${transactionOutput}${donorOutput}}}`);
      return;
    }


    // GM-Only Commands
    if (playerIsGM(msg.playerid)) {
      // Calculate pre-existing party total
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

      // Merge a player's coin into the densest possible
      if (msg.content.includes('-merge')) {
        output = '';

        msg.selected.forEach((obj) => {
          const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
          let character;
          if (token) {
            character = getObj('character', token.get('represents'));
          }
          if (character) {
            // Load player's existing account
            const characterName = getAttrByName(character.id, 'character_name');
            const playerAccount =
            [
              (parseFloat(getattr(character.id, 'pp')) || 0),
              (parseFloat(getattr(character.id, 'gp')) || 0),
              (parseFloat(getattr(character.id, 'ep')) || 0),
              (parseFloat(getattr(character.id, 'sp')) || 0),
              (parseFloat(getattr(character.id, 'cp')) || 0),
            ];

            const mergeResult = mergeMoney(playerAccount);
            if (mergeResult.length == null) {
              output += `<br><b>${characterName}</b> has `;
              output += mergeResult;
              output += `<br> ${playerAccount[0]}pp`;
              output += `<br> ${playerAccount[1]}gp`;
              output += `<br> ${playerAccount[2]}ep`;
              output += `<br> ${playerAccount[3]}sp`;
              output += `<br> ${playerAccount[4]}cp`;
              return;
            }

            // Udate donor account and update output
            setattr(character.id, 'pp', parseFloat(mergeResult[0]));
            setattr(character.id, 'gp', parseFloat(mergeResult[1]));
            setattr(character.id, 'ep', parseFloat(mergeResult[2]));
            setattr(character.id, 'sp', parseFloat(mergeResult[3]));
            setattr(character.id, 'cp', parseFloat(mergeResult[4]));

            output += `<br><b>${characterName}</b> has `;
            output += `<br> ${mergeResult[0]}pp`;
            output += `<br> ${mergeResult[1]}gp`;
            output += `<br> ${mergeResult[2]}ep`;
            output += `<br> ${mergeResult[3]}sp`;
            output += `<br> ${mergeResult[4]}cp`;
          }
          sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Coin Merge Report</b></b><hr>${output}}}`);
        });
      }

      // Reallocate existing resources of party as if all coin purses were thrown together and split evenly
      if (msg.content.includes('-share') || msg.content.includes('-best-share')) {
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

      // Add coin to target
      if (msg.content.includes('-add')) {
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
          sendChat(scname, `/w ${name} &{template:${rt[0]}} {{${rt[1]}=<b>GM has Disbursed Coin</b><hr>${output}}}`);
        });
        const s = msg.selected.length > 1 ? 's' : '';
        sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Disbursement to Player${s}</b><hr>${output}}}`);
      }

      // Subtract coin from target
      if (msg.content.includes('-pay') || msg.content.includes('-sub')) {
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
          sendChat(scname, `/w ${name} &{template:${rt[0]}} {{${rt[1]}=<b>GM has Removed Coin</b><hr>${output}}}`);
        });
        const s = msg.selected.length > 1 ? 's' : '';
        sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Bill Collection from Player${s}</b><hr>${output}}}`);
      }

      // Evenly distribute sum of coin to group of players
      if (msg.content.includes('-loot')) {
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
            sendChat(scname, `/w ${name} &{template:${rt[0]}} {{${rt[1]}=<b>Distributing Loot</b><hr>${output}}}`);
          }
        });
        sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Distributing Loot</b><hr>${output}}}`);
      }

      // Calculate party gold value
      if (msg.content.includes('-add') || msg.content.includes('-pay') || msg.content.includes('-share') || msg.content.includes('-best-share') || msg.content.includes('-loot') || msg.content.includes('-overview')) {
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
            output += playerCoinStatus(character, usd2)[0];
            partytotal += playerCoinStatus(character, usd2)[1];
          }
        });
        partytotal = Math.round(partytotal * 100, 0) / 100;

        output += `<b><u>Party total: ${toUsd(partytotal, usd2)}</u></b>}}`;
        sendChat(scname, output);
      }
    } else if (msg.content.includes('-add') || msg.content.includes('-pay') || msg.content.includes('-share') || msg.content.includes('-best-share') || msg.content.includes('-loot') || msg.content.includes('-merge') || msg.content.includes('-overview')) {
      sendChat(scname, `/w ${msg.who} **ERROR:** You do not have permission to use that action.`);
      sendChat(scname, `/w gm **WARNING:** ${msg.who} attempted to use a GM-Only command.`);
    }
  });
});
