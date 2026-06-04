# Life Impact Simulator

A personal decision-modelling tool. Define the parts of life that matter to you,
set how much you invest in different weekly habits, and see how a major decision —
in this case moving abroad — ripples across all of them. It compares three
scenarios side by side: **now**, **during the move**, and **after settling in**.

This is a thinking aid, not an oracle. The numbers are only as meaningful as the
weights and effects you put into the model.

---

## Run it locally

No build step, no server, no dependencies. Just open the file:

```
open index.html      # macOS
xdg-open index.html  # Linux
start index.html     # Windows
```

Or double-click `index.html` in a file browser. Your edits are saved automatically
in that browser (via `localStorage`).

If your browser blocks the local `model.js` script, serve the folder instead:

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Run the tests

```
node model.test.js
```

This checks the calibration (current = 50%), that editing sliders actually moves
the score, and that stress behaves correctly. Run it after any change to `model.js`.

## Put it on GitHub Pages

1. Create a new repository and push these files to it.
2. In the repo: **Settings → Pages → Build from a branch → `main` / root**.
3. Your simulator goes live at `https://<your-username>.github.io/<repo-name>/`.

## Open it in Claude Code

```
cd life-impact-simulator
claude
```

Then ask for changes in plain language, e.g. "add a fourth scenario" or "let me
edit the dimension weights from the UI." Claude Code can read `model.js`, make the
change, and run `node model.test.js` to confirm nothing broke.

---

## Project structure

| File | Purpose |
|------|---------|
| `index.html` | The standalone app: UI, styling, light/dark theme, persistence. |
| `model.js` | The scoring model. **Single source of truth** for all the math. |
| `model.test.js` | Node test suite that verifies the model. |
| `README.md` | This file. |

`index.html` and `model.test.js` both use `model.js`, so there's only one place
to change the logic.

---

## The model

### Dimensions and weights

Seven dimensions feed positively into emotional wellbeing. **Stress** is a penalty.
The weight is how strongly each one pulls on your emotional wellbeing.

| Dimension | Weight |
|-----------|:-----:|
| Relationship & intimacy | 3 |
| Physical health | 3 |
| Financial security | 2 |
| Social connection | 2 |
| Purpose & direction | 2 |
| Learning & growth | 1 |
| Cultural & linguistic belonging | 1 |
| Stress (penalty) | 2 |

### Actions and their effects

Each action affects dimensions with a direction (+ or −) and a strength (1–3).
Weekly habits scale by `hours ÷ max`; the move is a yes/no decision.

| Action | Type | Max | Effects |
|--------|------|:---:|---------|
| Move abroad | decision | — | Relationship +3, Purpose +3, Cultural +2, Financial −1, Social −1, Physical −1, Stress +3 |
| Time with partner | weekly | 40h | Relationship +3, Physical +2, Social +1 |
| Studying | weekly | 20h | Learning +3, Purpose +2, Financial +1 |
| Exercise | weekly | 14h | Physical +3, Social +1 |
| Social time with friends | weekly | 5h | Social +3, Cultural +2, Physical +1 |
| Cultural & language activities | weekly | 7h | Cultural +3, Social +2, Learning +1 |
| Work | weekly | 40h | Financial +3, Learning +2, Purpose +1, Physical −2, Stress +2 *(only above 30h)* |

### How a score is computed

1. **Dimension score** = (sum of `dir × strength × intensity` across all actions)
   ÷ (sum of all *positive* strengths for that dimension), clamped to 0–1.
   Intensity is `hours ÷ max` (capped at 1), or 1/0 for the decision.
2. **Stress score** = (active stress points) ÷ (max possible stress points). Work
   stress only starts accruing above 30 hours and reaches full strength at 40.
3. **Emotional wellbeing (raw)** =
   `(Σ dimensionScore × weight − stressScore × stressWeight) ÷ totalWeight`,
   where `totalWeight` = all dimension weights + stress weight = 16.
4. **Calibration.** A fixed factor scales raw wellbeing so the *default* current
   scenario reads 50%. The factor is computed once at load and frozen — that keeps
   50% a stable reference point, so editing a scenario moves its number instead of
   snapping back to 50%.

### Scenario defaults

| | Move | Partner | Study | Exercise | Social | Cultural | Work |
|--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Current | off | 3 | 7 | 5 | 5 | 3 | 40 |
| During move | on | 5 | 10 | 3 | 5 | 4 | 3 |
| After move | off | 30 | 18 | 10 | 1 | 4 | 10 |

To change any of these, edit `SCENARIO_DEFAULTS` in `model.js`.

---

## Ideas to build next

- Edit dimension weights and action effects from the UI instead of code.
- Add or remove dimensions and actions without touching the math.
- More scenarios than three; name them yourself.
- Share a scenario via a URL (encode the state in query params).
- Per-dimension baselines (a starting score before any actions), to capture parts
  of life that aren't zero just because you didn't invest hours this week.
- Export the comparison as an image or PDF.
