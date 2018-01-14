# CashMaster

A currency management script for the D&D 5e OGL sheets on roll20.net.

Please use `!cmhelp` for inline help and examples.

## Usage

First, select one or several party members. 

Then use 

- `!cm` to get an
**overview** over the party's cash, 
- `!cmshare` to **convert and share** the money equally
between party members, converting the amount into the best combination of gold, silver and copper (this should be used in smaller stores),
- `!cmconvert` to **convert and share** the money equally between party members, converting the amount into the best combination of platinum, gold, electrum, silver and copper (this should only be used in larger stores that have a fair amount of cash),
- `!cmadd [amount][currency]` to **add** an equal amount of money from each selected party member,
- `!cmhoard [amount][currency]` to **share** a certain amount of coins between the party members, like a found treasue. Note that in this case, no conversion between the different coin types is made - if a party of 5 shares 4 pp, then 4 party members receive one pp each, and the last member won't get anything.
- `!cmpay [amount][currency]` to **pay** a certain amount of coins. The script will even try to take all higher and one lower coin type to get the full amount. E.g. to pay 1gp when the character has no gold, the script will use 1pp (and return 9gp), or it will take 2ep. 

**Note:** You can add several coin values at once, e.g. `!cmhoard 50gp 150sp 2000cp`


### Examples

1. `!cm` will show a cash overview.
2. `!cmshare` will collect all the money and share it evenly on the members, using gp, sp and cp only (pp and ep will be converted). Can also be used for one character to 'exchange' money.
3. `!cmconvert` - same as `!cmshare`, but will also use platinum and electrum.
4. `!cmadd 50gp` will add 50 gp to every selected character.
5. `!cmhoard 50gp` will (more or less evenly) distribute 50 gp among the party members.
6. `!cmpay 10gp` will subtract 10gp from each selected character. It will try to exchange the other coin types (e.g. it will use 1pp if the player doesn't have 10gp).
