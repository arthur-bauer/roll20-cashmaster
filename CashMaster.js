/* global on log playerIsGM findObjs getObj getAttrByName sendChat globalconfig state */

/*
CASHMASTER %%version%%

A currency management script for the D&D 5e OGL sheets on roll20.net.
Please use `!cm` for inline help and examples.

arthurbauer@me.com
*/

const initCM = () => {
  // Initialize State object
  if (!state.CashMaster) {
    log('Initializing CashMaster');
    state.CashMaster = {
      Party: [],
      DefaultCharacterNames: {},
      TransactionHistory: [],
      MaxTransactionId: 0,
    };
  }
  if (!state.CashMaster.Party) {
    log('Initializing CashMaster.Party');
    state.CashMaster.Party = [];
  }
  if (!state.CashMaster.DefaultCharacterNames) {
    log('Initializing CashMaster.DefaultCharacterNames');
    state.CashMaster.DefaultCharacterNames = {};
  }
  if (!state.CashMaster.TransactionHistory) {
    log('Initializing CashMaster.TransactionHistory');
    state.CashMaster.TransactionHistory = [];
  }
  if (!state.CashMaster.MaxTransactionId) {
    state.CashMaster.MaxTransactionId = 0;
    state.CashMaster.TransactionHistory.forEach((tx) => {
      tx.Id = state.CashMaster.MaxTransactionId++;
    });
  }
};

const transactionHistoryLength = 20;

const recordTransaction = (type, initiator, playerEffects) => {
  let id = state.CashMaster.MaxTransactionId++;
  let timestamp = new Date().toUTCString();

  log("Add Transaction");
  log(`  Id: ${id}`);
  log(`  Type: ${type}`);
  log(`  Initiator: ${initiator}`);
  log(`  Player Effects: ${playerEffects}`);
  log(`  Timestamp: ${timestamp}`);

  state.CashMaster.TransactionHistory.push({
    Id: id,
    Type: type,
    Initiator: initiator,
    PlayerEffects: playerEffects,
    Time: timestamp,
    Reverted: false,
  });

  // Only track a finite number of transactions so we don't clog up state
  if (state.CashMaster.TransactionHistory.length > transactionHistoryLength) {
    state.CashMaster.TransactionHistory.shift();
  }
};

const getDelta = (finalState, initialState) => {
  return [
    finalState[0] - initialState[0],
    finalState[1] - initialState[1],
    finalState[2] - initialState[2],
    finalState[3] - initialState[3],
    finalState[4] - initialState[4],
  ];
};

const getPlayerEffect = (playerName, delta) => {
  return {
    PlayerName: playerName,
    Delta: delta,
  };
};

const getInverseOperation = (delta) => {
  return [
    -delta[0],
    -delta[1],
    -delta[2],
    -delta[3],
    -delta[4],
  ];
};

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
  output += formatCurrency(pp, gp, ep, sp, cp);

  output += `<br>(${weight} lbs)</small><br><br>`;
  return [output, total];
};

const formatCurrency = (pp, gp, ep, sp, cp) => {
  let currencyStringArray = [];
  if (pp && pp != 0) currencyStringArray.push(`<em style='color:blue;'>${pp}pp</em>`);
  if (gp && gp != 0) currencyStringArray.push(`<em style='color:orange;'>${gp}gp</em>`);
  if (ep && ep != 0) currencyStringArray.push(`<em style='color:silver;'>${ep}ep</em>`);
  if (sp && sp != 0) currencyStringArray.push(`<em style='color:grey;'>${sp}sp</em>`);
  if (cp && cp != 0) currencyStringArray.push(`<em style='color:brown;'>${cp}cp</em>`);
  return currencyStringArray.join(', ');
};

const getNonZeroCurrency = (accountArray) => {
  let currencyStringArray = [];
  if (accountArray[0] && accountArray[0] != 0) currencyStringArray.push(`${accountArray[0]}pp`);
  if (accountArray[1] && accountArray[1] != 0) currencyStringArray.push(`${accountArray[1]}gp`);
  if (accountArray[2] && accountArray[2] != 0) currencyStringArray.push(`${accountArray[2]}ep`);
  if (accountArray[3] && accountArray[3] != 0) currencyStringArray.push(`${accountArray[3]}sp`);
  if (accountArray[4] && accountArray[4] != 0) currencyStringArray.push(`${accountArray[4]}cp`);
  return currencyStringArray.join(' ');
};

const getRecipientOptions = () => {
  if (state.CashMaster) {
    const existingOptions = state.CashMaster.Party.join('|');

    // If ones already exist, append "|Other, ?{Type Full Name}"
    if (existingOptions.length > 0) {
      return `|${existingOptions}|Other,?{Type Full Name&amp;#125;`;
    }
    return '';
  }
  return null;
};

const getCharByName = (characterName) => {
  let scname;
  const list = findObjs({
    _type: 'character',
    name: characterName,
  });
  if (list.length === 0) {
    sendChat(scname, `**ERROR:** No character exists by the name ${characterName}.  Did you forget to include the surname?`);
    return null;
  } else if (list.length > 1) {
    sendChat(scname, `**ERROR:** character name ${characterName} must be unique.`);
    return null;
  }
  return list[0];
};

const getStringInQuotes = (string) => {
  let scname;
  const startQuote = string.indexOf('"');
  const endQuote = string.lastIndexOf('"');
  if (startQuote >= endQuote) {
    sendChat(scname, '**ERROR:** You must specify a target by name within double quotes.');
    return null;
  }
  return string.substring(startQuote + 1, endQuote);
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
  let donor;
  let pcName;

  const populateCoinContents = (input) => {
    ppg = /([0-9 -]+)pp/;
    ppa = ppg.exec(input);

    gpg = /([0-9 -]+)gp/;
    gpa = gpg.exec(input);

    epg = /([0-9 -]+)ep/;
    epa = epg.exec(input);

    spg = /([0-9 -]+)sp/;
    spa = spg.exec(input);

    cpg = /([0-9 -]+)cp/;
    cpa = cpg.exec(input);
  };

  const printTransactionHistory = (sender) => {
    let historyContent = `/w ${sender} &{template:${rt[0]}} {{${rt[1]}=<h3>Cash Master</h3><hr>`;
    state.CashMaster.TransactionHistory.forEach((transaction) => {
      let playerEffects = '<ul>';
      let operationList = [];
      transaction.PlayerEffects.forEach((effect) => {
        let formattedCurrency = formatCurrency(
          effect.Delta[0],
          effect.Delta[1],
          effect.Delta[2],
          effect.Delta[3],
          effect.Delta[4]
        );
        if(transaction.Reverted) {
          playerEffects += `<li><strike>${effect.PlayerName}:${formattedCurrency}</strike></li>`;
        } else {
          playerEffects += `<li>${effect.PlayerName}:${formattedCurrency}</li>`;
        }
        operationList.push(`-add -noToken &#34;${effect.PlayerName}&#34; ${getNonZeroCurrency(getInverseOperation(effect.Delta))}`);
      });
      playerEffects += `</ul>`;

      historyContent += `<br><h4>${transaction.Type}</h4><br>${transaction.Time}<br>Initiated by ${transaction.Initiator}<br><b>Player Effects</b>${playerEffects}<br>`;

      // If it hasn't been reverted yet, display revert button.  Otherwise, strikethrough.
      if(!transaction.Reverted) {
        operationList.push(`-revert ${transaction.Id}`);
        let revertOperation = `!cm ${operationList.join(';')}`;
        historyContent += `[Revert Transaction](${revertOperation})<br>`;
      }
    });
    historyContent += '}}';
    sendChat(scname, historyContent);
  }

  on('chat:message', (msg) => {
    const subcommands = msg.content.split(';');
    if (msg.type !== 'api') return;
    if (msg.content.startsWith('!cm') !== true) return;

    // Initialize State object
    initCM();

    // Log the received command
    log(`CM Command: ${msg.content}`);
    // Execute each operation
    subcommands.forEach((subcommand) => {
      log(`CM Subcommand: ${subcommand}`);
      const argTokens = subcommand.split(/\s+/);

      // Operations that do not require a selection
      if (subcommand === '!cm' || argTokens.includes('-help') || argTokens.includes('-h')) {
        //! help
        sendChat(scname, `/w gm %%README%%`); // eslint-disable-line quotes
      }

      if (argTokens.includes('-menu') || argTokens.includes('-toolbar') || argTokens.includes('-tool')) {
        let menuContent = `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<h3>Cash Master</h3><hr>` +
          '<h4>Universal Commands</h4>[Toolbar](!cm -tool)' +
            '<br>[Status](!cm -status)' +
            `<br>[Transfer to PC](!cm -transfer &#34;?{Recipient${getRecipientOptions()}}&#34; ?{Currency to Transfer})` +
            '<br>[Transfer to NPC](!cm -giveNPC &#34;?{List recipient name and reason}&#34; ?{Currency to Transfer})' +
            `<br>[Invoice Player](!cm -invoice &#34;?{Invoicee${getRecipientOptions()}}&#34; ?{Currency to Request})` +
            '<br>[Set Default Character](!cm -sc ?{Will you set a new default character|Yes})';
        if (playerIsGM(msg.playerid)) {
          menuContent = `${menuContent
          }<h4>GM-Only Commands</h4>` +
          '<b>Base Commands</b>' +
            '<br>[Readme](!cm -help)<br>[Party Overview](!cm -overview)' +
            '<br>[Selected USD](!cm -overview --usd)' +
          '<br><b>Accounting Commands</b>' +
            '<br>[Credit Each Selected](!cm -add ?{Currency to Add})' +
            '<br>[Bill Each Selected](!cm -sub ?{Currency to Bill})' +
            '<br>[Split Among Selected](!cm -loot ?{Amount to Split})' +
            '<br>[Transaction History](!cm -th)' +
          '<br><b>Admin Commands</b>' +
            '<br>[Compress Coins of Selected](!cm -merge)' +
            '<br>[Reallocate Coins](!cm -s ?{Will you REALLOCATE party funds evenly|Yes})' +
            '<br>[Set Party to Selected](!cm -sp ?{Will you SET the party to selected|Yes})';
        }
        menuContent += '}}';
        sendChat(scname, menuContent);
        return;
      }

      // Selectionless GM commands
      if (playerIsGM(msg.playerid)) {
        if (argTokens.includes('-transactionHistory') || argTokens.includes('-th')) {
          let sender = msg.who;
          printTransactionHistory(sender);
          return;
        }

        if (argTokens.includes('-revert') || argTokens.includes('-r')) {
          let id = parseFloat(argTokens [1]);
          let tx = state.CashMaster.TransactionHistory.find(function(element) {
            return element.Id == id;
          });
          tx.Reverted = true;
          let sender = msg.who;
          printTransactionHistory(sender);
          return;
        }
      }

      // null here means it is not being used or it does not exist
      let defaultCharacterName = null;

      // If the command has specified that no tokens are to be allowed (such as reversion), deselect all.
      if (msg.selected != null && (argTokens.includes('-noToken') || argTokens.includes('-nt'))) {
        msg.selected = null;
      }

      // Hereafter, operations all require a selection, so set a default name if one exists
      if (msg.selected == null) {
        // For single-user operations, if double quotes exist in the subcommand, we can interpret that as a textual declaration of sender
        if (playerIsGM(msg.playerid) && (argTokens.includes('-add') || argTokens.includes('-a'))) {
          defaultCharacterName = getStringInQuotes(subcommand);
        }
        // Attempt to load a default character from the sender
        else {
          defaultCharacterName = state.CashMaster.DefaultCharacterNames[msg.playerid];
        }

        // If we still can't ascertain who is supposed to be affected by this operation, report error.
        if (!defaultCharacterName) {
          if (!playerIsGM(msg.playerid)) {
            sendChat(scname, `/w ${msg.who} **ERROR:** You need to select at least one character.`);
          }
          sendChat(scname, `/w gm **ERROR:** ${msg.who} needs to select at least one character.`);
          return;
        }
      }

      // Coin Transfer between players
      if (argTokens.includes('-transfer') || argTokens.includes('-t')) {
        populateCoinContents(subcommand);

        // Retrieve target name
        // Double quotes must be used because multiple players could have the same first name, last name, etc
        const targetName = getStringInQuotes(subcommand);
        if (targetName == null) {
          return;
        }

        // Retrieve target's id
        const targetChar = getCharByName(targetName);
        if (targetChar == null) {
          return;
        }
        const targetId = targetChar.id;
        output = '';
        let transactionOutput = '';
        let donorOutput = '';
        let targetOutput = '';

        let donorName = '';
        if (defaultCharacterName == null) {
          if (msg.selected.length > 1) {
            sendChat(scname, '**ERROR:** Transfers can only have one sender.');
            return;
          }
          const obj = msg.selected[0];
          const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
          if (token) {
            donor = getObj('character', token.get('represents'));
          }
          if (!donor) {
            sendChat(scname, '**ERROR:** sender does not exist.');
            return;
          }
        } else {
          donorName = defaultCharacterName;
          donor = getCharByName(defaultCharacterName);
        }

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
        let donorInitial = [dpp, dgp, dep, dsp, dcp];

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
          let donorEffect = getPlayerEffect(donorName, getDelta(donorAccount, donorInitial));

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
          let targetInitial = [tpp, tgp, tep, tsp, tcp];
          if (ppa !== null) tpp += parseFloat(ppa[1]);
          if (gpa !== null) tgp += parseFloat(gpa[1]);
          if (epa !== null) tep += parseFloat(epa[1]);
          if (spa !== null) tsp += parseFloat(spa[1]);
          if (cpa !== null) tcp += parseFloat(cpa[1]);
          let targetFinal = [tpp, tgp, tep, tsp, tcp];
          let targetEffect = getPlayerEffect(targetName, getDelta(targetFinal, targetInitial));

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

          recordTransaction("Transfer to PC", msg.who, [donorEffect, targetEffect]);
        }
        sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>GM Transfer Report</b><br>${donorName}>${targetName}</b><hr>${transactionOutput}${donorOutput}${targetOutput}}}`);
        sendChat(scname, `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<b>Sender Transfer Report</b><br>${donorName} > ${targetName}</b><hr>${output}${transactionOutput}${donorOutput}}}`);
        sendChat(scname, `/w ${targetName} &{template:${rt[0]}} {{${rt[1]}=<b>Recipient Transfer Report</b><br>${donorName} > ${targetName}</b><hr>${output}${transactionOutput}${targetOutput}}}`);
        return;
      }

      // Invoice between players
      if (argTokens.includes('-invoice') || argTokens.includes('-i')) {
        ppg = /([0-9 -]+)pp/;
        ppa = ppg.exec(subcommand);

        gpg = /([0-9 -]+)gp/;
        gpa = gpg.exec(subcommand);

        epg = /([0-9 -]+)ep/;
        epa = epg.exec(subcommand);

        spg = /([0-9 -]+)sp/;
        spa = spg.exec(subcommand);

        cpg = /([0-9 -]+)cp/;
        cpa = cpg.exec(subcommand);

        // Retrieve target name
        const targetName = getStringInQuotes(subcommand);
        if (targetName == null) {
          return;
        }

        // Retrieve target's id
        const targetChar = getCharByName(targetName);
        if (targetChar == null) {
          return;
        }
        const targetId = targetChar.id;

        output = '';
        let transactionOutput = '';
        let targetOutput = '';

        let invoicer;
        let invoicerName = '';
        let invoiceAmount = '';
        if (defaultCharacterName == null) {
          if (msg.selected.length > 1) {
            sendChat(scname, '**ERROR:** Transfers can only have one sender.');
            return;
          }
          const obj = msg.selected[0];
          const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
          if (token) {
            invoicer = getObj('character', token.get('represents'));
            invoicerName = getAttrByName(invoicer.id, 'character_name');
          }
          if (!invoicer) {
            sendChat(scname, '**ERROR:** sender does not exist.');
            return;
          }
        } else {
          invoicerName = defaultCharacterName;
          invoicer = getCharByName(defaultCharacterName);
        }

        // Check that the sender is not attempting to send money to themselves
        if (invoicer.id === targetId) {
          sendChat(scname, '**ERROR:** target character must not be selected character.');
          return;
        }

        // Verify invoicer has enough to perform transfer
        // Check if the player attempted to steal from another and populate the transaction data
        transactionOutput += '<br><b>Requested Funds:</b>';
        if (ppa !== null) {
          const val = parseFloat(ppa[1]);
          transactionOutput += `<br> ${ppa[0]}`;
          invoiceAmount += ` ${ppa[0]}`;
          if (val < 0 && !playerIsGM(msg.playerid)) {
            sendChat(scname, `**ERROR:** ${msg.who} may not reverse-invoice themselves.`);
            return;
          }
        }
        if (gpa !== null) {
          const val = parseFloat(gpa[1]);
          transactionOutput += `<br> ${gpa[0]}`;
          invoiceAmount += ` ${gpa[0]}`;
          if (val < 0 && !playerIsGM(msg.playerid)) {
            sendChat(scname, `**ERROR:** ${msg.who} may not reverse-invoice themselves.`);
            return;
          }
        }
        if (epa !== null) {
          const val = parseFloat(epa[1]);
          transactionOutput += `<br> ${epa[0]}`;
          invoiceAmount += ` ${epa[0]}`;
          if (val < 0 && !playerIsGM(msg.playerid)) {
            sendChat(scname, `**ERROR:** ${msg.who} may not reverse-invoice themselves.`);
            return;
          }
        }
        if (spa !== null) {
          const val = parseFloat(spa[1]);
          transactionOutput += `<br> ${spa[0]}`;
          invoiceAmount += ` ${spa[0]}`;
          if (val < 0 && !playerIsGM(msg.playerid)) {
            sendChat(scname, `**ERROR:** ${msg.who} may not reverse-invoice themselves.`);
            return;
          }
        }
        if (cpa !== null) {
          const val = parseFloat(cpa[1]);
          transactionOutput += `<br> ${cpa[0]}`;
          invoiceAmount += ` ${cpa[0]}`;
          if (val < 0 && !playerIsGM(msg.playerid)) {
            sendChat(scname, `/w gm **ERROR:** ${msg.who} may not reverse-invoice themselves.`);
            return;
          }
        }

        // Load target's existing account
        const tpp = parseFloat(getattr(targetId, 'pp')) || 0;
        const tgp = parseFloat(getattr(targetId, 'gp')) || 0;
        const tep = parseFloat(getattr(targetId, 'ep')) || 0;
        const tsp = parseFloat(getattr(targetId, 'sp')) || 0;
        const tcp = parseFloat(getattr(targetId, 'cp')) || 0;

        targetOutput += `<hr><b>Current Funds of ${targetName}</b>`;
        targetOutput += `<br> ${tpp}pp`;
        targetOutput += `<br> ${tgp}gp`;
        targetOutput += `<br> ${tep}ep`;
        targetOutput += `<br> ${tsp}sp`;
        targetOutput += `<br> ${tcp}cp`;
        sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>GM Invoice Report</b><br>${invoicerName}>${targetName}</b><hr>${transactionOutput}${targetOutput}}}`);
        sendChat(scname, `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<b>Invoice Sent to ${targetName}</b><hr>${transactionOutput}}}`);
        sendChat(scname, `/w ${targetName} &{template:${rt[0]}} {{${rt[1]}=<b>Invoice Received from ${invoicerName}</b><hr>${transactionOutput}${targetOutput}<hr>[Pay](!cm -transfer &#34;${invoicerName}&#34;${invoiceAmount})}}`);
        return;
      }

      // Display coin count to player
      if (argTokens.includes('-status') || argTokens.includes('-ss')) {
        output = '';
        if (defaultCharacterName == null) {
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
        } else {
          const character = getCharByName(defaultCharacterName);
          if (character) {
            const coinStatus = playerCoinStatus(character);
            sendChat(scname, `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<b>Coin Purse Status</b></b><hr>${coinStatus[0]}}}`);
          }
        }
        return;
      }

      // Drop Currency or Give it to an NPC
      if (argTokens.includes('-dropWithReason') || argTokens.includes('-giveNPC')) {
        populateCoinContents(subcommand);

        // Retrieve target name
        const reason = getStringInQuotes(subcommand);

        output = '';
        let transactionOutput = '';
        let donorOutput = '';
        const targetOutput = ''; // eslint-disable-line no-unused-vars
        let donorName = '';

        if (defaultCharacterName == null) {
          if (msg.selected.length > 1) {
            sendChat(scname, '**ERROR:** Transfers can only have one sender.');
            return;
          }
          const obj = msg.selected[0];
          const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
          if (token) {
            donor = getObj('character', token.get('represents'));
          }
          if (!donor) {
            sendChat(scname, '**ERROR:** sender does not exist.');
            return;
          }
        } else {
          donorName = defaultCharacterName;
          donor = getCharByName(defaultCharacterName);
        }

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
        let donorInitial = [dpp, dgp, dep, dsp, dcp];
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
          let donorEffect = getPlayerEffect(donorName, getDelta(donorAccount, donorInitial));

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

          recordTransaction("Transfer to NPC", msg.who, [donorEffect]);
        }

        sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>GM Transfer Report</b><br>${donorName}</b><hr>${reason}<hr>${transactionOutput}${donorOutput}}}`);
        sendChat(scname, `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<b>Sender Transfer Report</b><br>${donorName}</b><hr>${reason}<hr>${output}${transactionOutput}${donorOutput}}}`);
        return;
      }

      // Set the default character for a given player
      if (argTokens.includes('-setdefaultCharacterName') || argTokens.includes('-sc')) {
        let setNewCharacter = false;
        const pcToken = msg.selected[0];
        const token = getObj('graphic', pcToken._id); // eslint-disable-line no-underscore-dangle
        if (token) {
          const pc = getObj('character', token.get('represents'));
          if (pc) {
            pcName = getAttrByName(pc.id, 'character_name');
            if (pcName) {
              const mapLog = `Mapping Speaker ${msg.playerid} to PC ${pcName}`;
              log(mapLog);
              state.CashMaster.DefaultCharacterNames[msg.playerid] = pcName;
              sendChat(scname, `/w gm ${mapLog}`);
              sendChat(scname, `/w ${msg.who} Updated Default Character to ${pcName}`);
              setNewCharacter = true;
            }
          }
        }
        if (!setNewCharacter) {
          sendChat(scname, `/w ${msg.who} **ERROR:** You did not have a named character token selected.`);
        }
      }

      // GM-Only Commands
      if (playerIsGM(msg.playerid)) {
        // Calculate pre-existing party total
        let partytotal = 0;
        let partycounter = 0;
        let partymember = null;
        let partyGoldOperation = false;

        if(msg.selected) {
          partymember = Object.entries(msg.selected).length;
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
        }

        // Merge a player's coin into the densest possible
        if (argTokens.includes('-merge') || argTokens.includes('-m')) {
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
              const playerInitial = [
                playerAccount[0],
                playerAccount[1],
                playerAccount[2],
                playerAccount[3],
                playerAccount[4],
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

              // Update donor account and update output
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

              recordTransaction("Merge", msg.who, [getPlayerEffect(characterName, getDelta(mergeResult, playerInitial))]);
            }
            sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Coin Merge Report</b></b><hr>${output}}}`);
            partyGoldOperation = true;
          });
        }

        // Reallocate existing resources of party as if all coin purses were thrown together and split evenly
        if (argTokens.includes('-share') || argTokens.includes('-best-share') || argTokens.includes('-s') || argTokens.includes('-bs')) {
          //! share and convert
          output = '';
          const cashshare = partytotal / partycounter;
          let newcounter = 0;
          let pps = Math.floor(cashshare / 10);
          if (argTokens.includes('-share') || argTokens.includes('-s')) {
            pps = 0;
          }
          let rest = cashshare - (pps * 10);
          const gps = Math.floor(rest);
          rest = (rest - gps) * 2;
          let eps = Math.floor(rest);
          if (argTokens.includes('-share') || argTokens.includes('-s')) {
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
              partyGoldOperation = true;
            }
          });
        }

        // Add coin to target
        if (argTokens.includes('-add') || argTokens.includes('-a')) {
          populateCoinContents(subcommand);

          output = '';

          let targetList = [];
          if(msg.selected) {
            msg.selected.forEach((obj) => {
              const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
              let character;
              if (token) {
                character = getObj('character', token.get('represents'));
              }
              if (character) {
                partycounter += 1;
                name = getAttrByName(character.id, 'character_name');
                targetList.push({
                  Character: character,
                  CharacterName: name,
                });
              }
            });
            partyGoldOperation = true;
          }

          if (defaultCharacterName != null) {
            targetList.push({
              Character: getCharByName(defaultCharacterName),
              CharacterName: defaultCharacterName,
            });
          }

          // Perform operations on each target
          targetList.forEach((target) => {
            let character = target.Character;
            let name = target.CharacterName;

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
            sendChat(scname, `/w ${name} &{template:${rt[0]}} {{${rt[1]}=<b>GM has Disbursed Coin</b><hr>${output}}}`);
          });

          const s = targetList.length > 1 ? 's' : '';
          sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Disbursement to Player${s}</b><hr>${output}}}`);
        }

        // Subtract coin from target
        if (argTokens.includes('-pay') || argTokens.includes('-p') || argTokens.includes('-subtract') || argTokens.includes('-sub')) {
          //! pay
          ppg = /([0-9 -]+)pp/;
          ppa = ppg.exec(subcommand);

          gpg = /([0-9 -]+)gp/;
          gpa = gpg.exec(subcommand);

          epg = /([0-9 -]+)ep/;
          epa = epg.exec(subcommand);

          spg = /([0-9 -]+)sp/;
          spa = spg.exec(subcommand);

          cpg = /([0-9 -]+)cp/;
          cpa = cpg.exec(subcommand);

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
          partyGoldOperation = true;
        }

        // Evenly distribute sum of coin to group of players
        if (argTokens.includes('-loot') || argTokens.includes('-l')) {
          //! loot
          ppg = /([0-9 -]+)pp/;
          ppa = ppg.exec(subcommand);

          gpg = /([0-9 -]+)gp/;
          gpa = gpg.exec(subcommand);

          epg = /([0-9 -]+)ep/;
          epa = epg.exec(subcommand);

          spg = /([0-9 -]+)sp/;
          spa = spg.exec(subcommand);

          cpg = /([0-9 -]+)cp/;
          cpa = cpg.exec(subcommand);

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
          partyGoldOperation = true;
        }

        // Set Party to selected
        if (argTokens.includes('-setParty') || argTokens.includes('-sp')) {
          const partyList = [];
          if (!argTokens.includes('-clear')) {
            msg.selected.forEach((obj) => {
              const token = getObj('graphic', obj._id); // eslint-disable-line no-underscore-dangle
              let pc;
              if (token) {
                pc = getObj('character', token.get('represents'));
                if (pc) {
                  pcName = getAttrByName(pc.id, 'character_name');
                  if (pcName) {
                    partyList.push(pcName);
                  }
                }
              }
            });
          }

          log(`Party List: ${partyList}`);
          state.CashMaster.Party = partyList;
          sendChat(scname, `/w gm **Party:${partyList.length}**<br>${partyList}`);
        }

        // Calculate party gold value
        if (partyGoldOperation || argTokens.includes('-overview') || argTokens.includes('-o')) {
          //! overview
          partytotal = 0;
          partycounter = 0;
          if (!argTokens.includes('--usd')) usd2 = 0;
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
      }
    });
  });
});
