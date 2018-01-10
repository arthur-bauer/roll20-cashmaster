# CashMaster

A currency management script for the D&D 5e OGL sheets on roll20.net.

Please use `!cmhelp` for inline help and examples.

## Usage

First, select one or several party members. 

Then use 

- `!cm` to get an
**overview** over the party's cash, 
- `!cmshare` to **share** the money equally
between party members, converting the amount into the best combination of gold, silver and copper,
- `!cmconvert` to **convert and share** the money equally between party members, converting the amount into the best combination of platinum, gold, electrum, silver and copper,
- `!cmadd [amount][currency]` to add/substract money from the selected party members.

### Examples

1. `!cm` will show a cash overview.
2. `!cmshare` will collect all the money and share it evenly on the members, using gp, sp and cp only (pp and ep will be converted). Can also be used for one character to "exchange" money.
3. `!cmconvert` - same as `!cmshare`, but will also use platinum and electrum.
4. `!cmadd 50gp` will add 50 gp to every selected character.

**Note:** If you substract more coins than a character has, the coin value will become negative. Use `!cmshare` on that one character to balance the coins (see examples below).

### Advanced uses

1. **Changing multiple values at once:** `!cmadd -1gp 10sp` will substract 1 gp and add 10 sp at the same time.
2. **Paying services:** `!cmadd -6cp` will substract 6cp. Use `!cmshare` afterwards to balance the amount of coins (e.g. it will substract 1 sp and add 4 cp if the character didn't have copper pieces before).