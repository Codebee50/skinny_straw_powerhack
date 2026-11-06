# Judge Q&A prep

Ten likely questions with short answers. Every number below comes from the app's API (Jan 2023 – Dec 2025) and is checked by the backend test suite. **Golden rule:** say what the data shows, then what it can't show. "We don't know, and here's why" is a strong answer.

---

### 1. Why is zone D (North) positive?

Positive congestion means congestion **lowered** the price there. D · North averages **+$0.85/MWh**. The North Country has more power than its lines can always carry south. When those lines are full, power is "stuck" upstream, so the local price drops. Two caveats:
- D is **exactly $0 on 665 of 1,096 days**: most of the time congestion has no effect there at all. It's positive on 353 days and negative on 78.
- **December 2025 is all zeros**, which we flag as a likely data gap and don't interpret.

### 2. Why weight by hours?

Months have different lengths: February has 672 hours, January 744. Averaging 36 monthly averages equally would let a short month count as much as a long one. So every multi-month average weights each month by its hours. It's small but real: Long Island comes out at **−$10.44** done properly versus −$10.51 the naive way. Automated tests check that the weighting is applied.

### 3. Does this prove Smart Path Connect worked?

**No.** Three reasons:
- **The interface isn't just the project.** Moses South carries **all** southbound North Country flow, not only Smart Path Connect.
- **The data has no project timeline.** There's nothing in it about when parts of the project came into service, so we can't line changes up with it.
- **Correlation, not cause.** Everything here is correlation; weather, fuel prices, demand and outages change at the same time.

What we *can* say is how the flow itself changed: see the next question.

### 4. Why did Moses South flow turn negative in 2025?

**The data shows the change but not the cause.** Average flow went from **582 MW southbound (2023)** to **195 MW southbound (2024)** to **188 MW northbound (2025)**. Days with net southbound flow fell from **88% to 58% to 31%**. Explaining *why* would need data we don't have: North Country generation output, demand, outages and maintenance, and grid changes. Any of those could contribute; we won't guess which.

### 5. How would this scale?

- **Today:** about 55,000 rows across 7 CSV files. They're loaded **once** at startup and every endpoint answers in tens of milliseconds.
- **More years or zones:** add the files; the analysis functions are pure pandas and don't change.
- **Much bigger data** (5-minute data, all NYISO nodes): switch from CSV to Parquet or a database such as DuckDB, precompute the aggregates, and cache responses.
- **Live updates:** NYISO publishes data daily, so a scheduled job could pull new data. The frontend wouldn't change, because it only talks to the API.
- **Offline copy:** `npm run export-fallback` regenerates the saved snapshots in one command.

### 6. What did the AI do vs. what did you do?

*[Adjust to your team's actual split before presenting.]*
- **AI:** helped us understand the electricity-market domain, scaffolded the project, and generated code and first drafts of docs.
- **Team:** chose the questions and wrote the domain rules: the sign convention, hour-weighting, and what we must not claim. We set **hand-checked expected values** (for example Long Island's −$10.44, the −0.45 overall correlation, the yearly Moses South flows) and made them automated tests. **117 backend tests** must pass before anything is shown. We reviewed every finding and wrote the "cannot conclude" lists.

### 7. So does congestion *cause* the higher prices?

We can't prove that. Downstate, congestion and price move together strongly (**r = −0.62** for NYC and Long Island), and congestion is literally one component of the price. But high-demand, high-fuel-cost months drive both. We also can't put a **dollar total** on it, because zone electricity usage isn't in the data.

### 8. Why are Long Island and New York City the most congested?

The data shows *that* they are, not *why*. Long Island is #1 for both price (**$51.60**) and congestion (**−$10.44**) in every year, with NYC #2 overall. That's consistent with dense demand served through a limited number of import paths. But the data **can't tell us which line** was the bottleneck.

### 9. How did you handle missing or bad data?

**We report gaps and never fill them:**
- **Missing hours:** the hourly congestion file is missing 28 hours and the hourly flow file 8. Three of each are daylight-saving "spring forward" hours that never existed.
- **Flow vs congestion matching:** matching the two hourly files leaves **26,271** hours; 25 flow hours and 5 congestion hours with no partner are dropped.
- **D · North, December 2025:** exactly zero for the whole month, so the app flags it wherever D appears.

### 10. Why is the overall correlation (−0.45) weaker than in any single year (−0.64 to −0.73)?

Prices roughly **doubled** from 2023 (about **$30/MWh** across zones) to 2025 (about **$61/MWh**). Pooling the years mixes in big price swings that have nothing to do with congestion, which blurs the link. Looked at one year at a time, it's clearer. Hourly links are weaker than daily ones for a similar reason: hour-to-hour noise.

---

**If you're stuck:** "Good question. Our data shows *X*. It can't show *Y*, which is on our 'cannot conclude' list." Then point at the dashed box on screen.
