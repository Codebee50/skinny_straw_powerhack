# Final 3-minute demo script

**Team:** [TEAM NAME] · **Presenters:** [TEAM MEMBER 1] (§1–3) · [TEAM MEMBER 2] (§4–5) · [TEAM MEMBER 3] (§6–8)

**Setup (before you're called):** run `npm run demo`, open http://localhost:3000, turn on **Presentation mode** (nav, top right). Check the nav says **API connected**; amber **Offline data** is fine too, because the numbers are identical. Start on **Where**, year **All**, map on **Congestion**, bar charts on **Order A→K**. No internet at the venue? The map keeps its circles on a plain background, or click **Simple map**.
All numbers come from the live API (`/api/minimum`, `/api/intermediate`, `/api/advanced`), Jan 2023 – Dec 2025.

---

### 1. Question (0:00–0:10) · [TEAM MEMBER 1]

"New York makes much of its power upstate but uses most of it downstate. **Where, and when, does grid congestion raise electricity prices?**"

### 2. Data (0:10–0:25)

"We used NYISO's official wholesale data for all 11 pricing zones, January 2023 to December 2025: 396 zone-months, plus daily and hourly files. One rule: a **negative** congestion number means congestion **raised** the price."

### 3. Map: where (0:25–0:50)

*Point at the overview map.*
"Each circle is a zone; red means congestion pushed the price up, blue means down, bigger means a bigger effect. Long Island is darkest at **−$10.44** per megawatt-hour, then New York City, **−$6.13**; Capital and the Hudson Valley sit in between. Upstate, West and North are blue: there, congestion *lowered* prices, because power gets stuck."

### 4. Scatter and rankings: how much (0:50–1:30) · [TEAM MEMBER 2]

*Scroll to the scatter.* "Each dot is one zone in one month. Left means more congestion; up means a higher price."
[CLICK] *Hover the top-left green triangle:* "New York City, January 2025: **$135.05**, with congestion adding **$36.31**."
"Overall, heavier congestion goes with higher prices, **r = −0.45**: roughly **$1.57** more per extra dollar of congestion. Downstate the link is strong, **−0.62**; upstate there's none, **0.01**."
[CLICK] *"Order by value" on both bar charts.* "And the three most expensive zones, Long Island at **$51.60**, New York City at **$47.05**, Capital at **$45.20**, are exactly the three most congested."

### 5. When (1:30–2:00)

[CLICK] *Nav → **When**, scroll to the heatmap.*
"Now *when*. Each cell is one zone in one season; darker red means congestion pushed prices up harder. **Winter is the worst season in every region.** Long Island averages **−$16.71** in winter against **−$4.50** in fall, nearly four times as much. New York City follows the same pattern: **−$12.07** in winter, **−$2.29** in fall."

### 6. Moses South (2:00–2:30) · [TEAM MEMBER 3]

[CLICK] *Nav → **Moses South**, scroll to the flow chart.*
"Moses South carries power south out of the North Country, including, but not only, the Smart Path Connect corridor. Its average flow went from **582 MW southbound** in 2023 to **188 MW northbound** in 2025; southbound days fell from **88% to 31%**."
*Scroll to the scatter plots.* "Does flow move with congestion? Only weakly: **−0.33** for New York City, **−0.32** for Capital, and nearly zero, **0.13**, for North."

### 7. What we cannot conclude (2:30–2:50)

*Scroll to the dashed box.*
"Honest limits: this is **correlation, not cause**; weather, fuel and demand move everything at once. We can't name **which line** was the bottleneck, total the **dollars paid**, or credit any change to **one project**. And we flagged a likely data gap, D · North in December 2025."

### 8. Why it matters (2:50–3:00)

"Congestion shows where New York needs transmission: **into New York City and Long Island, and out of the North Country**. Thank you."

---

*If the API drops mid-demo, the nav badge turns amber ("Offline data") and every default view keeps working from the saved snapshot. Keep going. Only non-default selections, like another zone in a dropdown, need live data. See [QA_PREP.md](QA_PREP.md) for judge questions.*
