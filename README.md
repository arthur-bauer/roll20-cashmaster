# CashMaster

A currency management script for the D&D 5e OGL sheets on roll20.net.

## Usage

First, select one or several party members. 

Then use 

- `!cm` to get an
**overview** over the party's cash, 
- `!cmshare` to **share** the money equally
between party members, converting the amount into the best combination of gold, silver and copper,
- `!cmconvert` to **convert and share** the money equally between party members, converting the amount into the best combination of platinum, gold, elektrum, silver and copper,
- `!cmadd [amount][currency]` to add/substract money from the selected party members.

### Examples

1. `!cm` will show a cash overview.
2. `!cmshare` will collect all the money and share it evenly on the members, using gp, sp and cp only (pp and ep will be converted).
3. `!cmadd -1gp 10sp` will substract 1gp and add 10 sp at the same time.
