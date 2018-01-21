# CashMaster

A currency management script for the D&D 5e OGL and 5e Shaped sheets on Roll20.net.

Please use `!cm` for inline help and examples.

## Setup

Make sure you use the correct sheet setting (`OGL` or `5E-Shaped`).

## Usage

First, select one or several party members. 

Then use 

- `!cm --overview` to get an **overview** over the party's cash, 
- `!cm --share` to **convert and share** the money equally
between party members, converting the amount into the best combination of gold, silver and copper (this should be used in smaller stores),
- `!cm --convert` to **convert and share** the money equally between party members, converting the amount into the best combination of platinum, gold, electrum, silver and copper (this should only be used in larger stores that have a fair amount of cash),
- `!cm --add [amount][currency]` to **add** an equal amount of money from each selected party member,
- `!cm --hoard [amount][currency]` to **share** a certain amount of coins between the party members, like a found treasue. Note that in this case, no conversion between the different coin types is made - if a party of 5 shares 4 pp, then 4 party members receive one pp each, and the last member won't get anything.
- `!cm --pay [amount][currency]` to **pay** a certain amount of coins. The script will even try to take all higher and one lower coin type to get the full amount. E.g. to pay 1gp when the character has no gold, the script will use 1pp (and return 9gp), or it will take 2ep. 

**Note:** You can add several coin values at once, e.g. `!cm --hoard 50gp 150sp 2000cp`


### Examples

1. `!cm --overview` will show a cash overview.
2. `!cm --share` will collect all the money and share it evenly on the members, using gp, sp and cp only (pp and ep will be converted). Can also be used for one character to 'exchange' money.
3. `!cm --convert` - same as `!cm --share`, but will also use platinum and electrum.
4. `!cm --add 50gp` will add 50 gp to every selected character.
5. `!cm --hoard 50gp` will (more or less evenly) distribute 50 gp among the party members.
6. `!cm --pay 10gp` will subtract 10gp from each selected character. It will try to exchange the other coin types (e.g. it will use 1pp if the player doesn't have 10gp).

