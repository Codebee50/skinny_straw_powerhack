# Presenting the NY grid congestion dashboard

This guide assumes you know nothing about electricity, this project, or charts. Read it top to bottom once and you should be able to present everything that is currently on screen, and answer the usual questions.

**What this guide covers:** the **Where (Minimum)** page in depth. The **When (Intermediate)** page now exists too; its segment is §5 of the final script, [DEMO_SCRIPT.md](DEMO_SCRIPT.md), and every card on it carries its own one-line answer. The zone map (top of the Where page) is §3 and **Moses South (Advanced)** is §6. Likely judge questions are in [QA_PREP.md](QA_PREP.md). **Use DEMO_SCRIPT.md as the talk track**; section 8 of this guide is an older, longer version.

---

## Contents

1. [The 30-second version](#1-the-30-second-version)
2. [Background in plain English](#2-background-in-plain-english)
3. [The data we used](#3-the-data-we-used)
4. [A tour of the app](#4-a-tour-of-the-app)
5. [The Where page, piece by piece](#5-the-where-page-piece-by-piece)
6. [What changes when you pick a year](#6-what-changes-when-you-pick-a-year)
7. [Numbers cheat sheet](#7-numbers-cheat-sheet)
8. [A 5-minute presentation script](#8-a-5-minute-presentation-script)
9. [Questions judges are likely to ask](#9-questions-judges-are-likely-to-ask)
10. [Things you must never say](#10-things-you-must-never-say)
11. [Before you go on stage](#11-before-you-go-on-stage)
12. [Glossary](#12-glossary)

---

## 1. The 30-second version

> New York's power grid is split into 11 zones. Electricity costs different amounts in each zone, partly because of **congestion**: the power lines into New York City and Long Island can't carry everything that's needed, so those areas sometimes pay more.
>
> Our dashboard shows **where** that happens. Using three years of official grid data (2023–2025), we found that **Long Island and New York City pay the most and carry the heaviest congestion.** Downstate, high congestion and high prices go together strongly. Upstate, they barely move together at all, and in some upstate zones congestion actually makes power *cheaper*.

If you remember nothing else, remember that paragraph.

---

## 2. Background in plain English

### 2.1 Who sets electricity prices in New York?

**NYISO** (New York Independent System Operator) runs the state's power grid. It doesn't own power plants or sell power to homes. It runs the **wholesale market**, where power plants sell electricity and utilities buy it, every few minutes, all day.

### 2.2 The 11 zones

NYISO splits New York into 11 zones, lettered **A to K**. They run roughly from the west and north of the state (A) down to Long Island (K):

| Zone | Name | Rough location | Region |
|---|---|---|---|
| A | West | Buffalo | Upstate |
| B | Genesee | Rochester | Upstate |
| C | Central | Syracuse | Upstate |
| D | North | Plattsburgh / North Country | Upstate |
| E | Mohawk Valley | Utica | Upstate |
| F | Capital | Albany | Upstate |
| G | Hudson Valley | Poughkeepsie | Lower Hudson Valley |
| H | Millwood | Mount Kisco (Westchester) | Lower Hudson Valley |
| I | Dunwoodie | Yonkers | Lower Hudson Valley |
| J | New York City | Manhattan and the boroughs | New York City |
| K | Long Island | Hauppauge | Long Island |

**The big picture to keep in your head:** a lot of New York's power is *made* upstate (hydro, nuclear, wind), and a lot of it is *used* downstate (NYC and Long Island). Power has to travel south over a limited number of transmission lines.

Whenever the app lists zones "in geographic order", it means **A → K**, which is roughly north/west to south/east.

### 2.3 What is "LBMP"? (the price)

**LBMP** stands for *Locational Based Marginal Price*. It's just **the wholesale price of electricity in a zone**. It's "locational" because each zone gets its own price.

It's measured in **$/MWh** (dollars per megawatt-hour):

- **1 MWh = 1,000 kWh.** Your home electricity bill counts kWh.
- A typical New York home uses very roughly 1 MWh every month or two.
- So "$50/MWh" means 1 MWh of electricity cost $50 **at wholesale**. That's 5 cents per kWh.

**Important:** this is the *wholesale* price that power plants and utilities trade at. It is **not** someone's electric bill, which also includes delivery charges, taxes and so on.

### 2.4 What is congestion? (the key idea)

**Analogy: a highway.**
Imagine cheap goods are made upstate and everyone downstate wants them. There's one highway south. On a normal day, trucks flow freely and the goods cost the same everywhere. On a busy day, the highway jams. Downstate can't get enough of the cheap upstate goods, so it has to buy from a more expensive local supplier. Now **downstate pays more and upstate has goods it can't ship out**, so upstate's price can actually drop.

Electricity works the same way. The "highway" is the transmission lines. When they're full, that's **congestion**.

NYISO's price in each zone is built from three pieces:

> **Price (LBMP) = energy + losses − congestion**

- **Energy:** the basic cost of electricity, the same everywhere at a given moment.
- **Losses:** a small cost for power lost as heat while it travels.
- **Congestion:** the effect of full power lines. **This is what our project is about.**

### 2.5 The sign rule (memorize this)

Because of the **minus sign** in that formula, the congestion numbers in our data read "backwards":

| Congestion number | What it means | Example |
|---|---|---|
| **Negative** (e.g. −$10) | Congestion **raised** the price here by $10 | Long Island, NYC |
| **Positive** (e.g. +$0.85) | Congestion **lowered** the price here | D · North, A · West (power stuck upstate) |
| **Zero** | Congestion had no effect | |

So **"heaviest congestion" = the most negative number.** The app reminds you of this on screen ("Negative = congestion raised the price"), but say it out loud early in your talk, because everything else depends on it.

---

## 3. The data we used

### 3.1 Where it comes from

Official NYISO data for **January 2023 to December 2025** (36 months). Every chart on the page has a caption saying so:

> *Source: NYISO real-time zonal LBMP & Moses South interface flow, Jan 2023 – Dec 2025*

(The "Moses South" part of that line refers to data for a later page. The Where page doesn't use it.)

### 3.2 Which file the Where page uses

Only one: the **monthly file**. For every zone and every month it gives:

- the **average price** that month (avg LBMP)
- the **average congestion** that month
- the **single most extreme 5-minute moment** that month (the min and max values)

11 zones × 36 months = **396 rows**. When you see "396" in the app, that's where it comes from.

### 3.3 How we average across months (a judge might ask)

To get "Long Island's average over three years", you can't simply add up 36 monthly numbers and divide by 36, because **months have different lengths.** January has 744 hours and February has 672. A plain average would let February count as much as January.

So every average across months is **weighted by the number of hours in that month**. Longer months count a bit more.

Does it matter? Slightly. Long Island's congestion is **−$10.44** done properly, versus −$10.51 the naive way. The difference is small, but it's the correct method, and our automated tests check that we use it.

### 3.4 One known data problem

In **December 2025**, zone **D · North** shows congestion of **exactly $0.00** for the whole month: average, minimum and maximum all zero. Real data is almost never exactly zero for a full month, so it's probably **missing data**. The app **flags it** (see section 5.7) and we don't draw conclusions from it.

---

## 4. A tour of the app

### 4.1 The top bar (on every page)

- **NY grid congestion** (left): the app name. Clicking it goes to the Where page.
- **Where (Minimum)**: the finished page and the subject of this guide.
- **When (Intermediate)**: when congestion hits, by month, season, hour, weekday and worst days (see DEMO_SCRIPT.md). **Moses South (Advanced)**: a zone map, Moses South flow over time, and how flow moves with congestion (see DEMO_SCRIPT.md).
- **Status dot** (far right):
  - **Green dot + "API connected"**: the data server is running. Good.
  - **Red dot + "API offline"**: the data server is down. The charts won't load. See section 11.
  - Clicking it opens a **status page** listing how many rows were loaded from each data file. That's handy for proving the data is real.

### 4.2 How the app works (one sentence for judges)

There are two parts. A **Python data server** (FastAPI) reads the NYISO files once at startup and does all the maths. A **web page** (Next.js) asks the server for results and draws the charts. Every number on screen is calculated from the data; **none of the sentences are typed in by hand.**

---

## 5. The Where page, piece by piece

The page answers one question, printed as its title:

> **Where does grid congestion raise electricity prices in New York?**

Going from top to bottom:

### 5.1 Header and year filter

- Under the title: **"Showing Jan 2023 – Dec 2025 · Source: …"**. This tells you which period the page is showing.
- On the right: four buttons, **All · 2023 · 2024 · 2025**.
  - **All** = all three years combined (the default).
  - A year = only that year's 12 months.
  - Clicking one reloads **everything on the page**: the cards, the charts, the table and the sentences. While it loads, the page fades slightly and "Updating…" appears.

### 5.2 The three number cards

| Card | What it says (All years) | How to read it |
|---|---|---|
| **Most expensive zone** | **$51.60/MWh**, K · Long Island | Long Island had the highest average wholesale price. |
| **Heaviest congestion** | **−$10.44/MWh**, K · Long Island | Negative means congestion *raised* the price. On average it added **$10.44** to every MWh on Long Island. |
| **Price ↔ congestion correlation, NYC & LI** | **−0.62**, "Strong: heavier congestion, higher prices" | In NYC and Long Island, months with more congestion clearly tend to be months with higher prices. |

**What "correlation" (r) means:** a number from **−1 to +1** that says how closely two things move together.

- Near **0**: no link.
- Near **±1**: they move together almost perfectly.
- In our app a **negative r** means "more congestion (a more negative number) goes with a higher price". The sign rule makes that the "expected" direction.

The app's wording uses these thresholds: under 0.1 = "no clear link", 0.1–0.3 = "weak", 0.3–0.5 = "moderate", 0.5 and up = "strong".

### 5.3 The big chart: "Price vs. congestion, every zone and month"

This is the centrepiece. Take your time on it.

**What one dot is:** one zone in one month. For example, "Long Island, February 2023" is one dot. With All selected there are **396 dots**; with a single year, **132**.

**The axes:**

- **Across the bottom (x-axis): average congestion cost ($/MWh).** Further **left** = more congestion pushing the price **up**.
- **Up the side (y-axis): average price ($/MWh).** Higher = more expensive.

**The background:**

- A **solid vertical line at $0** splits the chart in two.
- **Left of it is shaded light blue** and labelled **"← congestion raised price"**.
- **Right of it** is labelled **"congestion lowered price →"**.

**Colours and shapes (three zone groups):**

| Marker | Group | Zones |
|---|---|---|
| Blue **circle** | Upstate | A, B, C, D, E |
| Orange **square** | Capital & Hudson Valley | F, G, H, I |
| Green **triangle** | NYC & Long Island | J, K |

Each group has its own shape as well as its own colour, so the chart still works for colour-blind viewers or on a washed-out projector.

> Small detail: the tooltip calls F · Capital "Upstate", because that's NYISO's official region. For this chart we grouped F with the Hudson Valley zones because its numbers look like theirs, not like A–E: F's average congestion is −$5.18, close to G–I (−$3.22 to −$4.41) and far from A–E (−$0.91 to +$0.85). If asked, say exactly that.

**Hovering over a dot** shows a box with the zone, month, season, average price and average congestion. Use this live to name interesting dots.

**What to point out (All years):**

1. **Blue circles bunch around $0.** Upstate rarely feels congestion. Some sit **right** of zero: congestion made power *cheaper* there, because power was stuck upstate and couldn't get south.
2. **Green triangles and orange squares stretch far left**, and the far-left ones tend to sit **higher**. That's downstate: more congestion, higher prices.
3. **The top-left corner is January 2025.** The six most expensive zone-months in the whole dataset are all **January 2025**:
   - New York City: $135.05, congestion −$36.31
   - Long Island: $131.28, congestion −$31.49
   - Capital: $127.57, congestion −$31.19
4. **The dot furthest left is Long Island, February 2023** (congestion **−$43.24**, price $71.15). That's the single heaviest congestion month in the data.
5. **The blue "tower" at $0.** Upstate dots near $0 range from about $15 to about $95. Those are months where prices were high **without** much congestion (for example, E · Mohawk Valley in December 2025: $95.99 with congestion of only −$0.45). Point at this to show congestion is *not* the only thing that moves prices.
   - ⚠️ **Don't hover the blue dot at exactly $0.00 and about $95.** That's D · North, December 2025, the flagged data gap (section 3.4). Use E · Mohawk Valley as your example instead.

**The dashed diagonal line (the trend line).** It's a *line of best fit*: the straight line that sits closest to all the dots at once.

- Below the chart, the app says in words what the line means. For All years:
  > *Overall trend: each $1.00 more negative congestion goes with about **$1.57/MWh** higher price.*
- Behind it is the formula **price ≈ $37.73 − 1.57 × congestion**. $37.73 is the price the line predicts at zero congestion.
- **Why isn't it exactly $1?** Part of the link is built in: congestion is literally one piece of the price, so −$1 of congestion adds $1. The line ends up steeper or flatter than 1 depending on whether congested months were *also* expensive for other reasons (cold weather, high demand). Over all three years it's steeper (**1.57**). In 2023 alone it's a little flatter (**0.89**). In 2024 and 2025 it's much steeper (**2.44** and **2.35**).
- **Don't oversell it.** The line shows the direction of the pattern; it isn't a prediction. Over all years it explains roughly a fifth of the ups and downs in price.

**The table under the chart, "Correlation between price and congestion (Pearson r)":**

| Zone group | r (All years) | Zone-months | Reading |
|---|---|---|---|
| Upstate (A–E) | **0.01** | 180 | No clear link |
| Capital & Hudson Valley (F–I) | **−0.47** | 144 | Moderate |
| NYC & Long Island (J–K) | **−0.62** | 72 | Strong |
| All zones | **−0.45** | 396 | Moderate |

"Zone-months" is how many dots went into that row (for example, 5 upstate zones × 36 months = 180).

**The one-line takeaway from this table:** *the further downstate you go, the more tightly congestion and price move together.*

### 5.4 The two bar charts

These sit side by side (stacked on small screens).

**Left: "Average price by zone".** One bar per zone showing its average price over the selected period.

**Right: "Average congestion cost by zone".** One bar per zone showing its average congestion.

- A dark vertical line marks **$0**.
- Bars going **left** of $0 are negative: congestion **raised** the price.
- Bars going **right** are positive: congestion **lowered** the price. With All selected, that's A · West (+$0.78) and D · North (+$0.85).

**Highlighting (both charts):**

- The **top 3** bars are **dark blue** and labelled with their exact value.
- The rest are **grey**.
- For price, "top 3" = the 3 most expensive. For congestion, it's the 3 **most negative** (heaviest congestion).

**The ordering toggle (on each chart):**

- **Order A→K (geography)**: zones in map order, roughly north/west to south/east. Use this to show that price and congestion **grow as you move downstate**.
- **Order by value**: biggest first. Use this to show the ranking clearly.

**Hovering over a bar** shows the zone, region, average value, rank ("1 of 11") and, on the congestion chart, the **"Worst 5 min"**: the single most extreme 5-minute congestion value in that period and the month it happened. These are huge. For example, Long Island hit **−$5,147.04/MWh** for one 5-minute interval in **June 2025**. Explain it as **a momentary spike, not a monthly average.**

**What to say (All years):**

> Price: Long Island $51.60, New York City $47.05, Capital $45.20 are the top 3. The cheapest is A · West at $36.09, so Long Island's average price is $15.51 above West's.
>
> Congestion: Long Island −$10.44, New York City −$6.13, Capital −$5.18 are the top 3, and they're **the same three zones** as the price top 3.

### 5.5 "What the numbers show" (findings)

A numbered list of plain-English sentences. **The app writes these automatically from the numbers.** Change the year and the sentences change. They cover:

1. The 3 most expensive zones.
2. The gap between the most expensive and the cheapest zone.
3. The heaviest congestion zone and how much it added to the price.
4. Zones where congestion *lowered* the price.
5. Whether the 3 priciest zones are also the 3 most congested.
6. The overall correlation in words.
7. Which zone group has the strongest and the weakest link.
8. The single most extreme 5-minute congestion moment.

You can read these out almost word for word. They're designed to be presentable.

### 5.6 "What this data cannot tell us"

A dashed grey box with an ⓘ icon. It's deliberately honest about limits, and judges usually reward that:

1. **Which power line was the bottleneck.** We see the effect of congestion, not which line caused it.
2. **Cause and effect.** Congestion and high prices moving together doesn't *prove* congestion caused the high price. Weather, fuel prices and demand affect both.
3. **Total dollars paid.** We have prices per MWh, but not how much electricity each zone used, so we can't say "Long Island paid $X million extra".

### 5.7 Data note

Inside that same box, under **"Data note"**, the app shows any data problems in the selected period. Right now that's only:

> *D · North: congestion is exactly 0 for all of December 2025 … This may be a data gap, so that month is not interpreted.*

It appears for **All** and **2025**, and disappears for **2023** and **2024** because the problem isn't in those years.

### 5.8 Footer and source lines

- **Every chart** has a grey caption with the **source** and the **period shown**. The judges asked for this on every chart.
- The **bottom of the page** repeats the source and period, plus two method notes: the hour-weighted averaging and the sign rule.

---

## 6. What changes when you pick a year

### 6.1 Prices rose a lot over the three years

Average price across the 11 zones:

| Year | Average price |
|---|---|
| 2023 | about **$30**/MWh |
| 2024 | about **$36**/MWh |
| 2025 | about **$61**/MWh (roughly double 2023) |

Our data shows *that* prices rose, but **not why**. If asked, you can say analysts often point to natural-gas prices and weather, but that's outside our data, so we don't claim it.

### 6.2 Year by year

**2023**
- Most expensive: K · Long Island $41.38, F · Capital $34.84, J · NYC $33.71. Cheapest: D · North $23.23.
- Heaviest congestion: **K −$14.33** (the worst of any year), F −$8.73, J −$6.97.
- Correlation overall **−0.73** (strong). NYC & LI −0.79.
- Note: **Capital (F) is #2** in both price and congestion this year.
- Most extreme 5-minute moment: F · Capital, **−$2,928.14**, February 2023.

**2024 (the calmest year for congestion)**
- Most expensive: K $42.54, J $39.77, H · Millwood $37.84.
- Heaviest congestion: K −$6.32, J −$3.74, **H · Millwood −$2.09**.
- Correlation overall −0.65. **Strongest group is Capital & Hudson Valley (−0.83)**, the only year where it beats NYC & LI.
- Three upstate zones had congestion *lowering* prices: A, B and D.
- Most extreme 5-minute moment: K, −$4,000.00, April 2024.

**2025 (the most expensive year)**
- Most expensive: K $70.92, J $67.70, **I · Dunwoodie $64.75**.
- Heaviest congestion: K −$10.68, J −$7.68, I −$4.94.
- Correlation overall −0.64. NYC & LI **−0.82** (the strongest of any year).
- The D · North data note appears.
- Most extreme 5-minute moment: K, **−$5,147.04**, June 2025, the biggest in the whole dataset.

**What never changes:** **Long Island is #1 for both price and congestion in every year**, and **upstate (A–E) never shows a meaningful link** between congestion and price.

### 6.3 A pattern worth pointing out (if you have time)

Each single year shows a **stronger** correlation (−0.64 to −0.73) than all three years together (−0.45). Why? 2025 prices were about double 2023's across the board. When you mix the years, that big year-to-year jump adds a lot of up-and-down that has nothing to do with congestion, which blurs the pattern. **Looking one year at a time removes that noise.** This is a nice point to make by clicking from **All** to **2025**.

---

## 7. Numbers cheat sheet

All values are $/MWh unless stated. "Congestion" uses the sign rule (negative = raised the price).

| | All years | 2023 | 2024 | 2025 |
|---|---|---|---|---|
| #1 price | K $51.60 | K $41.38 | K $42.54 | K $70.92 |
| #2 price | J $47.05 | F $34.84 | J $39.77 | J $67.70 |
| #3 price | F $45.20 | J $33.71 | H $37.84 | I $64.75 |
| Cheapest | A $36.09 | D $23.23 | A $31.84 | A $51.96 |
| #1 congestion | K −$10.44 | K −$14.33 | K −$6.32 | K −$10.68 |
| #2 congestion | J −$6.13 | F −$8.73 | J −$3.74 | J −$7.68 |
| #3 congestion | F −$5.18 | J −$6.97 | H −$2.09 | I −$4.94 |
| r, all zones | −0.45 | −0.73 | −0.65 | −0.64 |
| r, Upstate A–E | 0.01 | −0.13 | −0.15 | −0.03 |
| r, F–I | −0.47 | −0.67 | −0.83 | −0.75 |
| r, NYC & LI J–K | −0.62 | −0.79 | −0.79 | −0.82 |
| Trend slope | 1.57 | 0.89 | 2.44 | 2.35 |
| Worst 5-min moment | K −$5,147.04 (Jun 2025) | F −$2,928.14 (Feb 2023) | K −$4,000.00 (Apr 2024) | K −$5,147.04 (Jun 2025) |

(Zone letters: A West, B Genesee, C Central, D North, E Mohawk Valley, F Capital, G Hudson Valley, H Millwood, I Dunwoodie, J New York City, K Long Island.)

---

## 8. A 5-minute presentation script

Things to **do** are in *italics*. Things to **say** are in quotes. Don't read it word for word; know the beats.

**0:00 — The problem (30 s)**
"New York makes a lot of its power upstate but uses a lot of it downstate. The power lines between them can fill up, like a highway in rush hour. That's called congestion. We asked: **where does congestion raise electricity prices in New York?**"

**0:30 — The data and one rule (40 s)**
*Point at the subtitle.* "We used official NYISO grid data, January 2023 to December 2025, for all 11 pricing zones, A in the west through K on Long Island."
"One rule you need: in this data, a **negative** congestion number means congestion **raised** the price. Positive means it lowered it."

**1:10 — The three cards (40 s)**
*Point at each card.*
"Long Island is the most expensive zone at $51.60 per megawatt-hour on average. It also has the heaviest congestion: on average, congestion added $10.44 to every megawatt-hour there. And in New York City and Long Island, price and congestion move together strongly, with a correlation of −0.62."

**1:50 — The scatter chart (90 s)**
"Every dot is one zone in one month: 396 in total. Left means congestion pushed the price up. Higher means more expensive."
*Point at the blue circles.* "Upstate sits right around zero. Some upstate zones are even to the right: congestion made their power cheaper, because it couldn't get out."
*Point at the green and orange.* "Downstate stretches to the left, and the further left, the higher the price."
*Hover over the top-left dot.* "This is New York City in January 2025: $135 a megawatt-hour, with congestion adding $36."
*Point at the dashed line.* "This trend line sums it up: each extra dollar of congestion goes with about $1.57 higher price."
*Point at the table.* "And the further downstate you go, the tighter the link: 0.01 upstate, −0.47 in the Hudson Valley, −0.62 in NYC and Long Island."

**3:20 — The bar charts (40 s)**
*Click "Order by value" on both.*
"The three most expensive zones, Long Island, New York City and Capital, are exactly the three most congested. And on the right, West and North are the two zones where congestion lowered the price on average."

**4:00 — Click a year (30 s)**
*Click 2025.* "Everything recalculates. In 2025 prices were roughly double 2023's, and the link between congestion and price in NYC and Long Island was the strongest of all three years, at −0.82. Long Island is number one for price and congestion in every single year."

**4:30 — Honesty slide (30 s)**
*Scroll to the dashed box.*
"Finally, what this data can't tell us. It doesn't say which power line was the bottleneck. It shows correlation, not cause: weather and fuel prices affect both. And without usage data we can't put a total dollar figure on it. We also flagged one likely data gap, D · North in December 2025, rather than interpreting it."
"Every sentence in our findings panel is generated from the data, not typed by us. Thank you."

---

## 9. Questions judges are likely to ask

**"What does negative congestion mean again?"**
NYISO's price formula subtracts congestion: price = energy + losses − congestion. So a negative congestion number *adds* to the price. Negative means congestion raised the price.

**"Why is the trend line's slope 1.57 and not 1?"**
$1 of it is built in, since congestion is part of the price. The extra 0.57 suggests congested months were also expensive months for other reasons, like cold weather or high demand. It's a correlation, not proof.

**"Does congestion *cause* the high prices?"**
We can't prove that from this data. They move together, but weather, fuel prices and demand affect both. Our app says so explicitly.

**"How much extra did Long Island pay in total?"**
We can't say. We have price per MWh but not how much electricity each zone used. That's one of our stated limits.

**"Which power line is the problem?"**
The data shows the *effect* of congestion in each zone, not which line caused it. That's also a stated limit.

**"How did you average across months?"**
Weighted by hours in each month, because months have different lengths. A plain average would give slightly different numbers. Our tests check this.

**"Why is the overall correlation weaker than each single year?"**
Prices roughly doubled from 2023 to 2025. Mixing years adds price swings unrelated to congestion, which blurs the link. Year by year, the link is clearer.

**"What are those huge numbers like −$5,147?"**
The single most extreme 5-minute interval in the period. These are brief spikes, very different from monthly averages, and we show them separately for that reason.

**"Why does D · North show zero in December 2025?"**
All its congestion values are exactly zero for that month, which is almost certainly missing data. We flag it instead of reading meaning into it.

**"Why is F · Capital grouped with the Hudson Valley when the tooltip says Upstate?"**
NYISO officially calls F Upstate. We grouped it with G–I for the scatter because its congestion looks like theirs (F −$5.18 vs G–I −$3.22 to −$4.41), not like A–E (−$0.91 to +$0.85). It's #3 for both price and congestion overall.

**"Is the data real?"**
Yes, it's official NYISO data. Click the status dot to show how many rows were loaded from each file (for example 396 monthly rows).

**"Did you write the findings yourselves?"**
No. The app generates every sentence from the computed numbers, which is why they change when you switch years.

---

## 10. Things you must never say

| Don't say | Say instead |
|---|---|
| "Congestion causes high prices." | "Congestion and high prices go together." |
| "Positive congestion is bad." | "Positive means congestion *lowered* the price there." |
| "Long Island paid $X million because of congestion." | "We can't total it; usage data isn't included." |
| "This line (Moses South / a named line) caused it." | "The data doesn't identify the line." |
| "D · North had no congestion in December 2025." | "That month looks like a data gap, so we flagged it." |
| "Upstate's correlation is 0.01, so congestion doesn't matter anywhere." | "Upstate shows no link; downstate shows a strong one." |
| "This is people's electricity bill." | "This is the wholesale price, not a household bill." |

---

## 11. Before you go on stage

**Start everything with one command** from the project folder:

```bash
npm run demo
```

It builds the site, starts the data server and the website, and prints **"Demo ready: http://localhost:3000"** when both are up (about 30 seconds). Open that address; it goes straight to the Where page. Press **Ctrl+C** in that terminal to stop both. (If Windows asks "Terminate batch job (Y/N)?", type **Y**.)

If it says a port is already in use, another copy is still running. Close the other terminal and try again.

**Checklist (2 minutes):**

1. The top-right dot is **green, "API connected"**. An amber **"Offline data"** chip is OK too: see below.
2. Click **All, 2023, 2024, 2025** once each so everything is warmed up, then go back to **All**.
3. Hover over one scatter dot and one bar to confirm the tooltips appear.
4. Set both bar charts back to **Order A→K** if you want to start from the map view.
5. Zoom the browser so the title and the three cards fill the screen at the start.

**If the chip turns amber, "Offline data":** the data server stopped, but **don't panic and don't stop talking.** The site automatically switched to a saved snapshot of exactly the same numbers, so every chart, year button and tooltip still works. Fix it afterwards: in a new terminal run `npm run backend`. The chip turns green again within 30 seconds.

**If the dot is red, "API offline":** both the server and the snapshot failed, which should never happen. Run `npm run export-fallback`, then restart with `npm run demo`.

**If something weird happens mid-talk:** switch to the 2024 button and back to All. That reloads all the data.

---

## 12. Glossary

| Term | Plain meaning |
|---|---|
| **NYISO** | The organisation that runs New York's power grid and wholesale electricity market. |
| **Zone (A–K)** | One of 11 pricing areas in New York. A is in the west; K is Long Island. |
| **LBMP** | The wholesale price of electricity in a zone. |
| **$/MWh** | Dollars per megawatt-hour. 1 MWh = 1,000 kWh. |
| **Congestion** | Power lines being full, so cheap power can't reach where it's needed. |
| **Congestion cost** | How much congestion changed a zone's price. Negative = raised it. |
| **Heaviest congestion** | The most negative congestion cost. |
| **Wholesale** | The market between power plants and utilities, not the household bill. |
| **Zone-month** | One zone in one month; one dot on the scatter chart. |
| **Hour-weighted average** | An average where longer months count more. |
| **Correlation (r)** | How closely two things move together, from −1 to +1. 0 = no link. |
| **Trend line** | The straight line that best fits all the dots, showing the general direction. |
| **5-minute extreme** | The single most extreme 5-minute price-component value in a month: a spike, not an average. |
| **Data gap** | Data that's probably missing or broken, which we flag instead of interpreting. |
| **Upstate / Downstate** | Upstate = zones A–F (the generating side). Downstate = G–K, especially NYC (J) and Long Island (K). |
