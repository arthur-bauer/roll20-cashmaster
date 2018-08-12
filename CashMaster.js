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
      tx.Id = state.CashMaster.MaxTransactionId++; // eslint-disable-line no-param-reassign, no-plusplus
    });
  }
};

const transactionHistoryLength = 20;

const recordTransaction = (type, initiator, playerEffects) => {
  const id = state.CashMaster.MaxTransactionId++; // eslint-disable-line no-param-reassign, no-plusplus
  const timestamp = new Date().toUTCString();

  log('Add Transaction');
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

const getDelta = (finalState, initialState) => [
  finalState[0] - initialState[0],
  finalState[1] - initialState[1],
  finalState[2] - initialState[2],
  finalState[3] - initialState[3],
  finalState[4] - initialState[4],
];

const getPlayerEffect = (playerName, delta) => ({
  PlayerName: playerName,
  Delta: delta,
});

const getInverseOperation = delta => [
  -delta[0],
  -delta[1],
  -delta[2],
  -delta[3],
  -delta[4],
];

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
      (total[0] * 10)
      + total[1]
      + (total[2] / 2)
      + (total[3] / 10)
      + (total[4] / 100)
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

const formatCurrency = (pp, gp, ep, sp, cp) => {
  const currencyStringArray = [];
  if (pp && pp !== 0) currencyStringArray.push(`<em style='color:blue;'>${pp}pp</em>`);
  if (gp && gp !== 0) currencyStringArray.push(`<em style='color:orange;'>${gp}gp</em>`);
  if (ep && ep !== 0) currencyStringArray.push(`<em style='color:silver;'>${ep}ep</em>`);
  if (sp && sp !== 0) currencyStringArray.push(`<em style='color:grey;'>${sp}sp</em>`);
  if (cp && cp !== 0) currencyStringArray.push(`<em style='color:brown;'>${cp}cp</em>`);
  return currencyStringArray.join(', ');
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
    (pp * 10)
  + (ep * 0.5)
  + gp
  + (sp / 10)
  + (cp / 100)
  ) * 10000) / 10000;
  const weight = (pp + gp + ep + sp + cp) / 50;

  let output = `${name}: <b>$${toUsd(total, usd)}</b><br><small>`;
  output += formatCurrency(pp, gp, ep, sp, cp);

  output += `<br>(${weight} lbs)</small><br><br>`;
  return [output, total];
};

const getNonZeroCurrency = (accountArray) => {
  const currencyStringArray = [];
  if (accountArray[0] && accountArray[0] !== 0) currencyStringArray.push(`${accountArray[0]}pp`);
  if (accountArray[1] && accountArray[1] !== 0) currencyStringArray.push(`${accountArray[1]}gp`);
  if (accountArray[2] && accountArray[2] !== 0) currencyStringArray.push(`${accountArray[2]}ep`);
  if (accountArray[3] && accountArray[3] !== 0) currencyStringArray.push(`${accountArray[3]}sp`);
  if (accountArray[4] && accountArray[4] !== 0) currencyStringArray.push(`${accountArray[4]}cp`);
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

const getCharByAny = (nameOrId) => {
  let character = null;

  // Try to directly load the character ID
  character = getObj('character', nameOrId);
  if (character) {
    return character;
  }

  // Try to load indirectly from the token ID
  const token = getObj('graphic', nameOrId);
  if (token) {
    character = getObj('character', token.get('represents'));
    if (character) {
      return character;
    }
  }

  // Try loading through char name
  const list = findObjs({
    _type: 'character',
    name: nameOrId,
  });
  if (list.length === 1) {
    return list[0];
  }

  // Default to null
  return null;
};

const getStringInQuotes = (string, quietMode = false) => {
  const scname = 'CashMaster';
  const startQuote = string.indexOf('"');
  const endQuote = string.lastIndexOf('"');
  if (startQuote >= endQuote) {
    if (!quietMode) {
      sendChat(scname, `**ERROR:** You must specify a target by name within double quotes in the phrase ${string}`);
    }
    return null;
  }
  return string.substring(startQuote + 1, endQuote);
};

const getDefaultCharNameFromPlayer = (playerid) => {
  const defaultName = state.CashMaster.DefaultCharacterNames[playerid];
  if (!defaultName) {
    return null;
  }
  return defaultName;
};

class ParseException {
  constructor(message) {
    this.message = message;
    this.name = 'Parse Exception';
    this.toString = () => `${this.name}: ${this.message}`;
  }
}

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

  log(`${scname} v${v} online. For assistance, use \`!cm -help\``);

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
  let pcName;

  const populateCoinContents = (input) => {
    ppg = /([\s|,|^|"|'])((-?\d{1,16} ?)(pp|PP|Pp|pP))(\s|,|$|"|')/;
    ppa = ppg.exec(input);

    gpg = /([\s|,|^|"|'])((-?\d{1,16} ?)(gp|GP|Gp|gP))(\s|,|$|"|')/;
    gpa = gpg.exec(input);

    epg = /([\s|,|^|"|'])((-?\d{1,16} ?)(ep|EP|Ep|eP))(\s|,|$|"|')/;
    epa = epg.exec(input);

    spg = /([\s|,|^|"|'])((-?\d{1,16} ?)(sp|SP|Sp|sP))(\s|,|$|"|')/;
    spa = spg.exec(input);

    cpg = /([\s|,|^|"|'])((-?\d{1,16} ?)(cp|CP|Cp|cP))(\s|,|$|"|')/;
    cpa = cpg.exec(input);
  };

  const parseSubcommand = (msg, subcommand, argTokens) => {
    const subjectList = [];
    let targetList = [];
    let currencySpecified = false;
    const allowStringTarget = argTokens.includes('-dropWithReason') || argTokens.includes('-giveNPC');

    // Wrapping in try/catch because of the forEach.  This allows us to easily escape to report errors to the user immediately.
    try {
      // Advanced Mode
      const tagList = subcommand.split(' -');
      tagList.forEach((param) => {
        if (param.startsWith('S ')) {
          const subjectNameList = getStringInQuotes(param);
          const subjectNames = subjectNameList.split(',');
          subjectNames.forEach((subjectName) => {
            if (subjectName.length === 0) {
              throw new ParseException('Empty string subject provided!');
            }
            const subject = getCharByAny(subjectName);
            if (subject == null) {
              throw new ParseException('Provided Subject name does not exist!');
            }
            subjectList.push(subject);
          });
        } else if (param.startsWith('T ')) {
          const targetNameList = getStringInQuotes(param);
          const targetNames = targetNameList.split(',');
          targetNames.forEach((targetName) => {
            if (allowStringTarget) {
              targetList.push(targetName);
            } else {
              if (targetName.length === 0) {
                throw new ParseException('Empty string target provided!');
              }
              const target = getCharByAny(targetName);
              if (target == null) {
                throw new ParseException('Provided Target name does not exist!');
              }
              targetList.push(target);
            }
          });
        } else if (param.startsWith('C ')) {
          const currencyString = getStringInQuotes(param);
          if (currencyString === null) {
            return;
          }
          populateCoinContents(currencyString);
          currencySpecified = true;
        }
      });

      // Simple Mode
      if (subjectList.length === 0) {
        // Prevent double-parsing
        targetList = [];

        const ambiguousNameList = getStringInQuotes(subcommand, true);
        let ambiguousNames = [];
        if (ambiguousNameList !== null) {
          ambiguousNames = ambiguousNameList.split(',');
        }

        const defaultName = getDefaultCharNameFromPlayer(msg.playerid);

        // In the event the user has no default and token selected (or have specified -noToken), assume subject
        if (defaultName === null && (msg.selected === null || argTokens.includes('-noToken') || argTokens.includes('-nt'))) {
          ambiguousNames.forEach((subjectName) => {
            const subject = getCharByAny(subjectName);
            if (subject == null) {
              throw new ParseException('Provided Subject name does not exist!');
            }
            subjectList.push(subject);
          });
        } else {
          // Otherwise, assume selected are subject and quoted are targets
          ambiguousNames.forEach((targetName) => {
            if (allowStringTarget) {
              targetList.push(targetName);
            } else {
              const target = getCharByAny(targetName);
              if (target == null) {
                throw new ParseException('Provided Target name does not exist!');
              }
              targetList.push(target);
            }
          });

          // Load from selection
          if (msg.selected != null) {
            msg.selected.forEach((selection) => {
              log(`Selection: ${selection}`);
              const token = getObj('graphic', selection._id); // eslint-disable-line no-underscore-dangle
              let subject = null;
              if (token) {
                subject = getObj('character', token.get('represents'));
              }
              if (subject === null) {
                sendChat(scname, '**ERROR:** sender does not exist.');
                return null;
              }
              subjectList.push(subject);
              return null;
            });
          }

          // Load from default
          if (subjectList.length === 0) {
            if (defaultName === null) {
              return null;
            }
            const subject = getCharByAny(defaultName);
            if (subject === null) {
              return null;
            }
            subjectList.push(subject);
          }
        }
      }

      // If given no particular subset to parse, parse the whole subcommand
      // WARNING: This could cause unexpected behavior when using object id mode
      if (!currencySpecified) {
        populateCoinContents(subcommand);
      }
    } catch (e) {
      sendChat(scname, `/w ${msg.who} **ERROR:** ${e}`);
      sendChat(scname, `/w gm **ERROR:** ${msg.who} received: ${e}`);
      return null;
    }

    log(`Subjects: ${subjectList}`);
    log(`Targets: ${targetList}`);
    return {
      Subjects: subjectList,
      Targets: targetList,
    };
  };

  const printTransactionHistory = (sender) => {
    let historyContent = `/w ${sender} &{template:${rt[0]}} {{${rt[1]}=<h3>Cash Master</h3><hr>`;
    state.CashMaster.TransactionHistory.forEach((transaction) => {
      let playerEffects = '<ul>';
      const operationList = [];
      transaction.PlayerEffects.forEach((effect) => {
        const formattedCurrency = formatCurrency(
          effect.Delta[0],
          effect.Delta[1],
          effect.Delta[2],
          effect.Delta[3],
          effect.Delta[4] // eslint-disable-line comma-dangle
        );
        if (transaction.Reverted) {
          playerEffects += `<li><strike>${effect.PlayerName}:${formattedCurrency}</strike></li>`;
        } else {
          playerEffects += `<li>${effect.PlayerName}:${formattedCurrency}</li>`;
        }
        operationList.push(`-add -noToken &#34;${effect.PlayerName}&#34; ${getNonZeroCurrency(getInverseOperation(effect.Delta))}`);
      });
      playerEffects += '</ul>';

      historyContent += `<br><h4>${transaction.Type}</h4><br>${transaction.Time}<br>Initiated by ${transaction.Initiator}<br><b>Player Effects</b>${playerEffects}<br>`;

      // If it hasn't been reverted yet, display revert button.  Otherwise, strikethrough.
      if (!transaction.Reverted) {
        operationList.push(`-revert ${transaction.Id}`);
        const revertOperation = `!cm ${operationList.join(';')}`;
        historyContent += `[Revert Transaction](${revertOperation})<br>`;
      }
    });
    historyContent += '}}';
    sendChat(scname, historyContent);
  };

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

      // Display the CashMaster Menu
      if (argTokens.includes('-menu') || argTokens.includes('-toolbar') || argTokens.includes('-tool')) {
        let menuContent = `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<h3>Cash Master</h3><hr>`
          + '<h4>Universal Commands</h4>'
            + '<br><b>Tools</b>'
              + '<br>[Toolbar](!cm -tool)'
            + '<br>[Status](!cm -status)'
            + '<br><b>Operations</b>'
            + `<br>[Transfer to PC](!cm -transfer &#34;?{Recipient${getRecipientOptions()}}&#34; ?{Currency to Transfer})`
            + '<br>[Transfer to NPC](!cm -giveNPC &#34;?{List recipient name and reason}&#34; ?{Currency to Transfer})'
            + `<br>[Invoice Player](!cm -invoice &#34;?{Invoicee${getRecipientOptions()}}&#34; ?{Currency to Request})`
            + '<br><b>Utilities</b>'
              + '<br>[Set Default Character](!cm -sc ?{Will you set a new default character|Yes})'
              + '<br>[Remove Default Character](!cm -rc ?{Will you remove your default character|Yes})';
        if (playerIsGM(msg.playerid)) {
          menuContent = `${menuContent
          }<h4>GM-Only Commands</h4>`
          + '<b>Base Commands</b>'
            + '<br>[Readme](!cm -help)<br>[Party Overview](!cm -overview)'
            + '<br>[Selected USD](!cm -overview --usd)'
          + '<br><b>Accounting Commands</b>'
            + '<br>[Credit Each Selected](!cm -add ?{Currency to Add})'
            + '<br>[Bill Each Selected](!cm -sub ?{Currency to Bill})'
            + '<br>[Split Among Selected](!cm -loot ?{Amount to Split})'
            + '<br>[Transaction History](!cm -th)'
          + '<br><b>Admin Commands</b>'
            + '<br>[Compress Coins of Selected](!cm -merge)'
            + '<br>[Reallocate Coins](!cm -s ?{Will you REALLOCATE party funds evenly|Yes})'
            + '<br>[Set Party to Selected](!cm -sp ?{Will you SET the party to selected|Yes})';
        }
        menuContent += '}}';
        sendChat(scname, menuContent);
        return;
      }

      // Selectionless GM commands
      if (playerIsGM(msg.playerid)) {
        if (argTokens.includes('-transactionHistory') || argTokens.includes('-th')) {
          const sender = msg.who;
          printTransactionHistory(sender);
          return;
        }

        if (argTokens.includes('-revert') || argTokens.includes('-r')) {
          const id = parseFloat(argTokens[1]);
          const tx = state.CashMaster.TransactionHistory.find(element => element.Id === id);
          tx.Reverted = true;
          const sender = msg.who;
          printTransactionHistory(sender);
          return;
        }
      }

      // From this point forward, there must at minimum be a Subject (possibly targets as well).
      const parsedSubcommand = parseSubcommand(msg, subcommand, argTokens);
      if (parsedSubcommand === null) {
        log('Invalid Input.  Validate that a subject is provided and input is not malformed.');
        sendChat(scname, `/w gm **ERROR:** Invalid Input.  Validate that a subject is provided and input is not malformed.  In response to ${msg.who}'s command ${subcommand}`);
        return;
      }
      const subjects = parsedSubcommand.Subjects;
      const targets = parsedSubcommand.Targets;
      if (subjects === null) {
        log('Invalid Input (null subjects).  Aborting.');
        sendChat(scname, `/w gm **ERROR:** No subject provided by ${msg.who} in command ${subcommand}`);
        return;
      }
      if (subjects.length === 0) {
        log('Invalid Input (no subjects).  Aborting.');
        sendChat(scname, `/w gm **ERROR:** No subject provided by ${msg.who} in command ${subcommand}.`);
        return;
      }

      // Coin Transfer between players
      if (argTokens.includes('-transfer') || argTokens.includes('-t')) {
        subjects.forEach((subject) => {
          targets.forEach((target) => {
            output = '';
            let transactionOutput = '';
            let subjectOutput = '';
            let targetOutput = '';

            const subjectName = getAttrByName(subject.id, 'character_name');
            const targetName = getAttrByName(target.id, 'character_name');

            // Check that the sender is not attempting to send money to themselves
            if (subject.id === target.id) {
              sendChat(scname, '**ERROR:** target character must not be selected character.');
              return;
            }

            // Verify subject has enough to perform transfer
            // Check if the player attempted to steal from another and populate the transaction data
            transactionOutput += '<br><b>Transaction Data</b>';
            if (ppa !== null) {
              const val = parseFloat(ppa[3]);
              transactionOutput += `<br> <em style='color:blue;'>${ppa[2]}</em>`;
              if (val < 0 && !playerIsGM(msg.playerid)) {
                sendChat(scname, `**ERROR:** ${msg.who} may not demand payment from ${targetName}.`);
                return;
              }
            }
            if (gpa !== null) {
              const val = parseFloat(gpa[3]);
              transactionOutput += `<br> <em style='color:orange;'>${gpa[2]}</em>`;
              if (val < 0 && !playerIsGM(msg.playerid)) {
                sendChat(scname, `**ERROR:** ${msg.who} may not demand payment from ${targetName}.`);
                return;
              }
            }
            if (epa !== null) {
              const val = parseFloat(epa[3]);
              transactionOutput += `<br> <em style='color:silver;'>${epa[2]}</em>`;
              if (val < 0 && !playerIsGM(msg.playerid)) {
                sendChat(scname, `**ERROR:** ${msg.who} may not demand payment from ${targetName}.`);
                return;
              }
            }
            if (spa !== null) {
              const val = parseFloat(spa[3]);
              transactionOutput += `<br> <em style='color:grey;'>${spa[2]}</em>`;
              if (val < 0 && !playerIsGM(msg.playerid)) {
                sendChat(scname, `**ERROR:** ${msg.who} may not demand payment from ${targetName}.`);
                return;
              }
            }
            if (cpa !== null) {
              const val = parseFloat(cpa[3]);
              transactionOutput += `<br> <em style='color:brown;'>${cpa[2]}</em>`;
              if (val < 0 && !playerIsGM(msg.playerid)) {
                sendChat(scname, `/w gm **ERROR:** ${msg.who} may not demand payment from ${targetName}.`);
                return;
              }
            }

            // Load subject's existing account
            const dpp = parseFloat(getattr(subject.id, 'pp')) || 0;
            const dgp = parseFloat(getattr(subject.id, 'gp')) || 0;
            const dep = parseFloat(getattr(subject.id, 'ep')) || 0;
            const dsp = parseFloat(getattr(subject.id, 'sp')) || 0;
            const dcp = parseFloat(getattr(subject.id, 'cp')) || 0;
            let subjectAccount = [dpp, dgp, dep, dsp, dcp];
            const subjectInitial = [dpp, dgp, dep, dsp, dcp];

            if (ppa !== null) subjectAccount = changeMoney(subjectAccount, ppa[2]);
            if (gpa !== null) subjectAccount = changeMoney(subjectAccount, gpa[2]);
            if (epa !== null) subjectAccount = changeMoney(subjectAccount, epa[2]);
            if (spa !== null) subjectAccount = changeMoney(subjectAccount, spa[2]);
            if (cpa !== null) subjectAccount = changeMoney(subjectAccount, cpa[2]);

            // Verify subject has enough to perform transfer
            subjectOutput += `<br><b>${subjectName}</b> has `;
            if (subjectAccount === 'ERROR: Not enough cash.') {
              subjectOutput += 'not enough cash!';
            } else {
              const subjectEffect = getPlayerEffect(subjectName, getDelta(subjectAccount, subjectInitial));

              // Update subject account and update output
              setattr(subject.id, 'pp', parseFloat(subjectAccount[0]));
              setattr(subject.id, 'gp', parseFloat(subjectAccount[1]));
              setattr(subject.id, 'ep', parseFloat(subjectAccount[2]));
              setattr(subject.id, 'sp', parseFloat(subjectAccount[3]));
              setattr(subject.id, 'cp', parseFloat(subjectAccount[4]));
              subjectOutput += `<br> <em style='color:blue;'>${subjectAccount[0]}pp</em>`;
              subjectOutput += `<br> <em style='color:orange;'>${subjectAccount[1]}gp</em>`;
              subjectOutput += `<br> <em style='color:silver;'>${subjectAccount[2]}ep</em>`;
              subjectOutput += `<br> <em style='color:grey;'>${subjectAccount[3]}sp</em>`;
              subjectOutput += `<br> <em style='color:brown;'>${subjectAccount[4]}cp</em>`;

              // targetFunds
              let tpp = parseFloat(getattr(target.id, 'pp')) || 0;
              let tgp = parseFloat(getattr(target.id, 'gp')) || 0;
              let tep = parseFloat(getattr(target.id, 'ep')) || 0;
              let tsp = parseFloat(getattr(target.id, 'sp')) || 0;
              let tcp = parseFloat(getattr(target.id, 'cp')) || 0;
              const targetInitial = [tpp, tgp, tep, tsp, tcp];
              if (ppa !== null) tpp += parseFloat(ppa[3]);
              if (gpa !== null) tgp += parseFloat(gpa[3]);
              if (epa !== null) tep += parseFloat(epa[3]);
              if (spa !== null) tsp += parseFloat(spa[3]);
              if (cpa !== null) tcp += parseFloat(cpa[3]);
              const targetFinal = [tpp, tgp, tep, tsp, tcp];
              const targetEffect = getPlayerEffect(targetName, getDelta(targetFinal, targetInitial));

              setattr(target.id, 'pp', tpp);
              setattr(target.id, 'gp', tgp);
              setattr(target.id, 'ep', tep);
              setattr(target.id, 'sp', tsp);
              setattr(target.id, 'cp', tcp);
              targetOutput += `<br><b>${targetName}</b> has `;
              targetOutput += `<br> <em style='color:blue;'>${tpp}pp</em>`;
              targetOutput += `<br> <em style='color:orange;'>${tgp}gp</em>`;
              targetOutput += `<br> <em style='color:silver;'>${tep}ep</em>`;
              targetOutput += `<br> <em style='color:grey;'>${tsp}sp</em>`;
              targetOutput += `<br> <em style='color:brown;'>${tcp}cp</em>`;

              recordTransaction('Transfer to PC', msg.who, [subjectEffect, targetEffect]);
            }
            sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>GM Transfer Report</b><br>${subjectName}>${targetName}</b><hr>${transactionOutput}${subjectOutput}${targetOutput}}}`);
            sendChat(scname, `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<b>Sender Transfer Report</b><br>${subjectName} > ${targetName}</b><hr>${output}${transactionOutput}${subjectOutput}}}`);
            sendChat(scname, `/w ${targetName} &{template:${rt[0]}} {{${rt[1]}=<b>Recipient Transfer Report</b><br>${subjectName} > ${targetName}</b><hr>${output}${transactionOutput}${targetOutput}}}`);
          });
        });
        return;
      }

      // Invoice between players
      if (argTokens.includes('-invoice') || argTokens.includes('-i')) {
        subjects.forEach((subject) => {
          targets.forEach((target) => {
            output = '';
            let transactionOutput = '';
            let targetOutput = '';
            let invoiceAmount = '';
            const subjectName = getAttrByName(subject.id, 'character_name');
            const targetName = getAttrByName(target.id, 'character_name');

            // Check that the sender is not attempting to send money to themselves
            if (subject.id === target.id) {
              sendChat(scname, '**ERROR:** target character must not be selected character.');
              return;
            }

            // Verify subject has enough to perform transfer
            // Check if the player attempted to reverse-invoice themselves
            transactionOutput += '<br><b>Requested Funds:</b>';
            if (ppa !== null) {
              const val = parseFloat(ppa[3]);
              transactionOutput += `<br> ${ppa[2]}`;
              invoiceAmount += ` ${ppa[2]}`;
              if (val < 0 && !playerIsGM(msg.playerid)) {
                sendChat(scname, `**ERROR:** ${msg.who} may not reverse-invoice themselves.`);
                return;
              }
            }
            if (gpa !== null) {
              const val = parseFloat(gpa[3]);
              transactionOutput += `<br> ${gpa[2]}`;
              invoiceAmount += ` ${gpa[2]}`;
              if (val < 0 && !playerIsGM(msg.playerid)) {
                sendChat(scname, `**ERROR:** ${msg.who} may not reverse-invoice themselves.`);
                return;
              }
            }
            if (epa !== null) {
              const val = parseFloat(epa[3]);
              transactionOutput += `<br> ${epa[2]}`;
              invoiceAmount += ` ${epa[2]}`;
              if (val < 0 && !playerIsGM(msg.playerid)) {
                sendChat(scname, `**ERROR:** ${msg.who} may not reverse-invoice themselves.`);
                return;
              }
            }
            if (spa !== null) {
              const val = parseFloat(spa[3]);
              transactionOutput += `<br> ${spa[2]}`;
              invoiceAmount += ` ${spa[2]}`;
              if (val < 0 && !playerIsGM(msg.playerid)) {
                sendChat(scname, `**ERROR:** ${msg.who} may not reverse-invoice themselves.`);
                return;
              }
            }
            if (cpa !== null) {
              const val = parseFloat(cpa[3]);
              transactionOutput += `<br> ${cpa[2]}`;
              invoiceAmount += ` ${cpa[2]}`;
              if (val < 0 && !playerIsGM(msg.playerid)) {
                sendChat(scname, `/w gm **ERROR:** ${msg.who} may not reverse-invoice themselves.`);
                return;
              }
            }

            // Load target's existing account
            const tpp = parseFloat(getattr(target.id, 'pp')) || 0;
            const tgp = parseFloat(getattr(target.id, 'gp')) || 0;
            const tep = parseFloat(getattr(target.id, 'ep')) || 0;
            const tsp = parseFloat(getattr(target.id, 'sp')) || 0;
            const tcp = parseFloat(getattr(target.id, 'cp')) || 0;

            targetOutput += `<hr><b>Current Funds of ${targetName}</b>`;
            targetOutput += `<br> ${tpp}pp`;
            targetOutput += `<br> ${tgp}gp`;
            targetOutput += `<br> ${tep}ep`;
            targetOutput += `<br> ${tsp}sp`;
            targetOutput += `<br> ${tcp}cp`;
            sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>GM Invoice Report</b><br>${subjectName}>${targetName}</b><hr>${transactionOutput}${targetOutput}}}`);
            sendChat(scname, `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<b>Invoice Sent to ${targetName}</b><hr>${transactionOutput}}}`);
            sendChat(scname, `/w ${targetName} &{template:${rt[0]}} {{${rt[1]}=<b>Invoice Received from ${subjectName}</b><hr>${transactionOutput}${targetOutput}<hr>[Pay](!cm -transfer -S &#34;${targetName}&#34; -T &#34;${subjectName}&#34; -C &#34;${invoiceAmount}&#34;)}}`);
          });
        });
        return;
      }

      // Display coin count to player
      if (argTokens.includes('-status') || argTokens.includes('-ss')) {
        subjects.forEach((subject) => {
          const coinStatus = playerCoinStatus(subject);
          sendChat(scname, `/w ${msg.who} &{template:${rt[0]}} {{${rt[1]}=<b>Coin Purse Status</b></b><hr>${coinStatus[0]}}}`);
        });
        return;
      }

      // Drop Currency or Give it to an NPC
      if (argTokens.includes('-dropWithReason') || argTokens.includes('-giveNPC')) {
        subjects.forEach((subject) => {
          output = '';
          let transactionOutput = '';
          let subjectOutput = '';
          const subjectName = getAttrByName(subject.id, 'character_name');
          const reason = targets[0];
          // Verify subject has enough to perform transfer
          // Check if the player attempted to steal from another and populate the transaction data
          transactionOutput += '<br><b>Transaction Data</b>';
          if (ppa !== null) {
            const val = parseFloat(ppa[3]);
            transactionOutput += `<br> ${ppa[2]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} tried to steal.`);
              return;
            }
          }
          if (gpa !== null) {
            const val = parseFloat(gpa[3]);
            transactionOutput += `<br> ${gpa[2]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} tried to steal.`);
              return;
            }
          }
          if (epa !== null) {
            const val = parseFloat(epa[3]);
            transactionOutput += `<br> ${epa[2]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} tried to steal.`);
              return;
            }
          }
          if (spa !== null) {
            const val = parseFloat(spa[3]);
            transactionOutput += `<br> ${spa[2]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} tried to steal.`);
              return;
            }
          }
          if (cpa !== null) {
            const val = parseFloat(cpa[3]);
            transactionOutput += `<br> ${cpa[2]}`;
            if (val < 0 && !playerIsGM(msg.playerid)) {
              sendChat(scname, `**ERROR:** ${msg.who} tried to steal.`);
              return;
            }
          }

          // Load subject's existing account
          const dpp = parseFloat(getattr(subject.id, 'pp')) || 0;
          const dgp = parseFloat(getattr(subject.id, 'gp')) || 0;
          const dep = parseFloat(getattr(subject.id, 'ep')) || 0;
          const dsp = parseFloat(getattr(subject.id, 'sp')) || 0;
          const dcp = parseFloat(getattr(subject.id, 'cp')) || 0;
          const subjectInitial = [dpp, dgp, dep, dsp, dcp];
          let subjectAccount = [dpp, dgp, dep, dsp, dcp];

          if (ppa !== null) subjectAccount = changeMoney(subjectAccount, ppa[2]);
          if (gpa !== null) subjectAccount = changeMoney(subjectAccount, gpa[2]);
          if (epa !== null) subjectAccount = changeMoney(subjectAccount, epa[2]);
          if (spa !== null) subjectAccount = changeMoney(subjectAccount, spa[2]);
          if (cpa !== null) subjectAccount = changeMoney(subjectAccount, cpa[2]);

          // Verify subject has enough to perform transfer
          subjectOutput += `<br><b>${subjectName}</b> has `;
          if (subjectAccount === 'ERROR: Not enough cash.') {
            subjectOutput += 'not enough cash!';
          } else {
            const subjectEffect = getPlayerEffect(subjectName, getDelta(subjectAccount, subjectInitial));

            // Update subject account and update output
            setattr(subject.id, 'pp', parseFloat(subjectAccount[0]));
            setattr(subject.id, 'gp', parseFloat(subjectAccount[1]));
            setattr(subject.id, 'ep', parseFloat(subjectAccount[2]));
            setattr(subject.id, 'sp', parseFloat(subjectAccount[3]));
            setattr(subject.id, 'cp', parseFloat(subjectAccount[4]));
            subjectOutput += `<br> ${subjectAccount[0]}pp`;
            subjectOutput += `<br> ${subjectAccount[1]}gp`;
            subjectOutput += `<br> ${subjectAccount[2]}ep`;
            subjectOutput += `<br> ${subjectAccount[3]}sp`;
            subjectOutput += `<br> ${subjectAccount[4]}cp`;

            recordTransaction('Transfer to NPC', msg.who, [subjectEffect]);
          }

          sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>GM Transfer Report</b><br>${subjectName}</b><hr>${reason}<hr>${transactionOutput}${subjectOutput}}}`);
          sendChat(scname, `/w ${subjectName} &{template:${rt[0]}} {{${rt[1]}=<b>Sender Transfer Report</b><br>${subjectName}</b><hr>${reason}<hr>${output}${transactionOutput}${subjectOutput}}}`);
        });
        return;
      }

      // Set the default character for a given player
      if (argTokens.includes('-setDefaultCharacterName') || argTokens.includes('-sc')) {
        let setNewCharacter = false;
        if (msg.selected) {
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
        }
        if (!setNewCharacter) {
          sendChat(scname, `/w ${msg.who} **ERROR:** You did not have a named character token selected.`);
        }
      }

      // Set the default character for a given player
      if (argTokens.includes('-removeDefaultCharacterName') || argTokens.includes('-rc')) {
        if (state.CashMaster.DefaultCharacterNames[msg.playerid]) {
          delete state.CashMaster.DefaultCharacterNames[msg.playerid];
          sendChat(scname, `/w gm Erased Default Character for ${msg.who}`);
          sendChat(scname, `/w ${msg.who} Erased Default Character`);
        } else {
          sendChat(scname, `/w ${msg.who} You do not have a default character assigned.`);
        }
      }

      // GM-Only Commands
      if (playerIsGM(msg.playerid)) {
        // Calculate pre-existing party total
        let partytotal = 0;
        let partycounter = 0;
        let partymember = null;
        let partyGoldOperation = false;

        // Create party gold output string
        if (subjects) {
          partymember = subjects.length;
          subjects.forEach((subject) => {
            partycounter += 1;
            name = getAttrByName(subject.id, 'character_name');
            pp = parseFloat(getattr(subject.id, 'pp')) || 0;
            gp = parseFloat(getattr(subject.id, 'gp')) || 0;
            ep = parseFloat(getattr(subject.id, 'ep')) || 0;
            sp = parseFloat(getattr(subject.id, 'sp')) || 0;
            cp = parseFloat(getattr(subject.id, 'cp')) || 0;
            total = Math.round((
              (pp * 10)
              + (ep * 0.5)
              + gp
              + (sp / 10)
              + (cp / 100)
            ) * 10000) / 10000;
            partytotal = total + partytotal;
          });
          partytotal = Math.round(partytotal * 100, 0) / 100;
        }

        // Merge a player's coin into the densest possible
        if (argTokens.includes('-merge') || argTokens.includes('-m')) {
          output = '';
          const transactionEffects = [];
          subjects.forEach((subject) => {
            // Load player's existing account
            const subjectName = getAttrByName(subject.id, 'character_name');
            const playerAccount = [
              (parseFloat(getattr(subject.id, 'pp')) || 0),
              (parseFloat(getattr(subject.id, 'gp')) || 0),
              (parseFloat(getattr(subject.id, 'ep')) || 0),
              (parseFloat(getattr(subject.id, 'sp')) || 0),
              (parseFloat(getattr(subject.id, 'cp')) || 0),
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
              output += `<br><b>${subjectName}</b> has `;
              output += mergeResult;
              output += `<br> ${playerAccount[0]}pp`;
              output += `<br> ${playerAccount[1]}gp`;
              output += `<br> ${playerAccount[2]}ep`;
              output += `<br> ${playerAccount[3]}sp`;
              output += `<br> ${playerAccount[4]}cp`;
              return;
            }

            // Update subject account and update output
            setattr(subject.id, 'pp', parseFloat(mergeResult[0]));
            setattr(subject.id, 'gp', parseFloat(mergeResult[1]));
            setattr(subject.id, 'ep', parseFloat(mergeResult[2]));
            setattr(subject.id, 'sp', parseFloat(mergeResult[3]));
            setattr(subject.id, 'cp', parseFloat(mergeResult[4]));

            output += `<br><b>${subjectName}</b> has `;
            output += `<br> ${mergeResult[0]}pp`;
            output += `<br> ${mergeResult[1]}gp`;
            output += `<br> ${mergeResult[2]}ep`;
            output += `<br> ${mergeResult[3]}sp`;
            output += `<br> ${mergeResult[4]}cp`;

            transactionEffects.push(getPlayerEffect(subjectName, getDelta(mergeResult, playerInitial)));
            recordTransaction('Merge', msg.who, transactionEffects);
          });
          sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Coin Merge Report</b></b><hr>${output}}}`);
          partyGoldOperation = true;
        }

        // Reallocate existing resources of party as if all coin purses were thrown together and split evenly
        if (argTokens.includes('-share') || argTokens.includes('-best-share') || argTokens.includes('-s') || argTokens.includes('-bs')) {
          output = '';
          const cashshare = partytotal / partycounter;
          const newcounter = 0;
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

          const transactionEffects = [];
          subjects.forEach((subject) => {
            const subjectName = getAttrByName(subject.id, 'character_name');
            const ipp = parseFloat(getattr(subject.id, 'pp')) || 0;
            const igp = parseFloat(getattr(subject.id, 'gp')) || 0;
            const iep = parseFloat(getattr(subject.id, 'ep')) || 0;
            const isp = parseFloat(getattr(subject.id, 'sp')) || 0;
            const icp = parseFloat(getattr(subject.id, 'cp')) || 0;
            const playerInitial = [ipp, igp, iep, isp, icp];

            setattr(subject.id, 'pp', pps);
            setattr(subject.id, 'gp', gps);
            setattr(subject.id, 'ep', eps);
            setattr(subject.id, 'sp', sps);
            // enough copper coins? If not, the last one in the group has to take the diff
            if ((rest > 0.999 || rest < -0.999) && newcounter === partycounter) {
              cps += Math.round(rest);
            }
            setattr(subject.id, 'cp', cps);
            transactionEffects.push(getPlayerEffect(subjectName, getDelta([pps, gps, eps, sps, cps], playerInitial)));
            partyGoldOperation = true;
          });
          recordTransaction('Reallocate Currency', msg.who, transactionEffects);
        }

        // Add coin to target
        if (argTokens.includes('-add') || argTokens.includes('-a') || argTokens.includes('-credit')) {
          output = '';

          // Perform operations on each target
          const transactionEffects = [];

          subjects.forEach((subject) => {
            const subjectName = getAttrByName(subject.id, 'character_name');

            pp = parseFloat(getattr(subject.id, 'pp')) || 0;
            gp = parseFloat(getattr(subject.id, 'gp')) || 0;
            ep = parseFloat(getattr(subject.id, 'ep')) || 0;
            sp = parseFloat(getattr(subject.id, 'sp')) || 0;
            cp = parseFloat(getattr(subject.id, 'cp')) || 0;
            const subjectInitial = [pp, gp, ep, sp, cp];
            const subjectFinal = [pp, gp, ep, sp, cp];

            total = Math.round((
              (pp * 10)
              + (ep * 0.5)
              + gp
              + (sp / 10)
              + (cp / 100)
            ) * 10000) / 10000;
            partytotal = total + partytotal;

            output += `<br><b>${subjectName}</b>`;
            if (ppa) {
              setattr(subject.id, 'pp', parseFloat(pp) + parseFloat(ppa[3]));
              output += `<br> ${ppa[2]}`;
              subjectFinal[0] += parseFloat(ppa[3]);
            }
            if (gpa) {
              setattr(subject.id, 'gp', parseFloat(gp) + parseFloat(gpa[3]));
              output += `<br> ${gpa[2]}`;
              subjectFinal[1] += parseFloat(gpa[3]);
            }
            if (epa) {
              setattr(subject.id, 'ep', parseFloat(ep) + parseFloat(epa[3]));
              output += `<br> ${epa[2]}`;
              subjectFinal[2] += parseFloat(epa[3]);
            }
            if (spa) {
              setattr(subject.id, 'sp', parseFloat(sp) + parseFloat(spa[3]));
              output += `<br> ${spa[2]}`;
              subjectFinal[3] += parseFloat(spa[3]);
            }
            if (cpa) {
              setattr(subject.id, 'cp', parseFloat(cp) + parseFloat(cpa[3]));
              output += `<br> ${cpa[2]}`;
              subjectFinal[4] += parseFloat(cpa[3]);
            }
            transactionEffects.push(getPlayerEffect(subjectName, getDelta(subjectFinal, subjectInitial)));
            sendChat(scname, `/w ${subjectName} &{template:${rt[0]}} {{${rt[1]}=<b>GM has Disbursed Coin</b><hr>${output}}}`);
          });

          const type = msg.content.includes('-revert ') ? 'Revert Transaction' : 'Add';
          recordTransaction(type, msg.who, transactionEffects);
          const s = subjects.length > 1 ? 's' : '';
          sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Disbursement to Player${s}</b><hr>${output}}}`);
        }

        // Subtract coin from target
        if (argTokens.includes('-pay') || argTokens.includes('-p') || argTokens.includes('-subtract') || argTokens.includes('-sub') || argTokens.includes('-bill')) {
          output = '';
          const transactionEffects = [];

          subjects.forEach((subject) => {
            partycounter += 1;
            const subjectName = getAttrByName(subject.id, 'character_name');
            pp = parseFloat(getattr(subject.id, 'pp')) || 0;
            gp = parseFloat(getattr(subject.id, 'gp')) || 0;
            ep = parseFloat(getattr(subject.id, 'ep')) || 0;
            sp = parseFloat(getattr(subject.id, 'sp')) || 0;
            cp = parseFloat(getattr(subject.id, 'cp')) || 0;
            const targetInitial = [pp, gp, ep, sp, cp];
            let targetFinal = [pp, gp, ep, sp, cp];
            if (ppa !== null) targetFinal = changeMoney(targetFinal, ppa[2]);
            if (gpa !== null) targetFinal = changeMoney(targetFinal, gpa[2]);
            if (epa !== null) targetFinal = changeMoney(targetFinal, epa[2]);
            if (spa !== null) targetFinal = changeMoney(targetFinal, spa[2]);
            if (cpa !== null) targetFinal = changeMoney(targetFinal, cpa[2]);

            output += `<br><b>${subjectName}</b> has `;
            if (targetFinal === 'ERROR: Not enough cash.') output += 'not enough cash!';
            else {
              setattr(subject.id, 'pp', parseFloat(targetFinal[0]));
              output += `<br> ${targetFinal[0]}pp`;
              setattr(subject.id, 'gp', parseFloat(targetFinal[1]));
              output += `<br> ${targetFinal[1]}gp`;
              setattr(subject.id, 'ep', parseFloat(targetFinal[2]));
              output += `<br> ${targetFinal[2]}ep`;
              setattr(subject.id, 'sp', parseFloat(targetFinal[3]));
              output += `<br> ${targetFinal[3]}sp`;
              setattr(subject.id, 'cp', parseFloat(targetFinal[4]));
              output += `<br> ${targetFinal[4]}cp`;

              transactionEffects.push(getPlayerEffect(subjectName, getDelta(targetFinal, targetInitial)));
            }
            sendChat(scname, `/w ${subjectName} &{template:${rt[0]}} {{${rt[1]}=<b>GM has Removed Coin</b><hr>${output}}}`);
          });
          recordTransaction('Subtract', msg.who, transactionEffects);
          const s = msg.selected.length > 1 ? 's' : '';
          sendChat(scname, `/w gm &{template:${rt[0]}} {{${rt[1]}=<b>Bill Collection from Player${s}</b><hr>${output}}}`);
          partyGoldOperation = true;
        }

        // Evenly distribute sum of coin to group of players
        if (argTokens.includes('-loot') || argTokens.includes('-l')) {
          populateCoinContents(subcommand);

          output = '';
          partycounter = 0;
          const transactionEffects = [];
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
              const targetInitial = [pp, gp, ep, sp, cp];
              const targetFinal = [pp, gp, ep, sp, cp];

              let ppt;
              let gpt;
              let ept;
              let spt;
              let cpt;

              if (ppa !== null) {
                ppt = cashsplit(ppa[3], partymember, partycounter);
              }
              if (gpa !== null) {
                gpt = cashsplit(gpa[3], partymember, partycounter);
              }
              if (epa !== null) {
                ept = cashsplit(epa[3], partymember, partycounter);
              }
              if (spa !== null) {
                spt = cashsplit(spa[3], partymember, partycounter);
              }
              if (cpa !== null) {
                cpt = cashsplit(cpa[3], partymember, partycounter);
              }

              output += `<br><b>${name}</b>`;
              if (ppa) {
                targetFinal[0] = parseFloat(pp) + parseFloat(ppt);
                setattr(character.id, 'pp', targetFinal[0]);
                output += `<br> ${ppt}pp`;
              }
              if (gpa) {
                targetFinal[1] = parseFloat(gp) + parseFloat(gpt);
                setattr(character.id, 'gp', targetFinal[1]);
                output += `<br> ${gpt}gp`;
              }
              if (epa) {
                targetFinal[2] = parseFloat(ep) + parseFloat(ept);
                setattr(character.id, 'ep', targetFinal[2]);
                output += `<br> ${ept}ep`;
              }
              if (spa) {
                targetFinal[3] = parseFloat(sp) + parseFloat(spt);
                setattr(character.id, 'sp', targetFinal[3]);
                output += `<br> ${spt}sp`;
              }
              if (cpa) {
                targetFinal[4] = parseFloat(cp) + parseFloat(cpt);
                setattr(character.id, 'cp', targetFinal[4]);
                output += `<br> ${cpt}cp`;
              }
              sendChat(scname, `/w ${name} &{template:${rt[0]}} {{${rt[1]}=<b>Distributing Loot</b><hr>${output}}}`);
              transactionEffects.push(getPlayerEffect(name, getDelta(targetFinal, targetInitial)));
            }
          });
          recordTransaction('Distribute Loot', msg.who, transactionEffects);
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
          subjects.forEach((subject) => {
            output += playerCoinStatus(subject, usd2)[0];
            partytotal += playerCoinStatus(subject, usd2)[1];
          });
          partytotal = Math.round(partytotal * 100, 0) / 100;

          output += `<b><u>Party total: ${toUsd(partytotal, usd2)}</u></b>}}`;
          sendChat(scname, output);
        }
      }
    });
  });
});
