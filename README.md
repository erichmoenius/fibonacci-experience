# 🌌 The Fibonacci Experience

An exploratory, real-time 3D experience built with Three.js and Vite, shaped around a journey through six interconnected worlds—from cosmic space to molecular structures.

The project’s vision centers on curiosity, free exploration, and the traveler’s choice to continue.

[Explore the live prototype](https://prototype.thefridolin.com) · [Run locally](#local-development)

<p align="center">
  <img src="docs/images/blob_1.png" width="1000">
</p>

**Welcome, traveler.**

There are no objectives here.\
Nothing will chase you.\
Nothing requires your attention.

*Explore freely.*

Some places hold deeper experiences.\
If you feel drawn to one, approach it.

**Every world moves differently.**\
**Explore. Adapt.**

To return, press **Esc** or **Back**.

That's all.\
Nothing more.

**The journey will begin only by your choice.**

---

## 🌀 The Journey

The Fibonacci Experience is a journey through six worlds.

```text
1 — SPACE
    SpaceTheme
    Transporter → Core
         ↓
2 — SPIRAL GALAXY
    Galaxy / cosmic spiral
    Transporter → TBD
         ↓
3 — OUR WORLD
    Solar / planetary system
    Transporter → Planet Earth
         ↓
4 — ENVIRONMENT
    Earth itself — underwater, cities,
    landscapes, ecosystems…
    Transporter → TBD
         ↓
5 — HUMAN
    Art · Science · AI · consciousness / creativity
    Transporter → Blood
         ↓
6 — MOLECULAR WORLD
    Molecules → DNA helix → fundamental structures
    Transporter → Fibonacci
         ↓
    back to 1 or 2
```

The worlds offer pieces of a visual rebus, without prescribing how they fit together.

There is no fixed destination.

---

## ✨ The Idea

The experience is not a game and not a conventional website.

It is an interactive visual riddle. Relationships, recurring structures, and changes of scale emerge through exploration rather than explanation.

### Two equally valid ways to be here

The experience supports two equally valid modes of engagement:

- **Traveller** — explore freely, discover what is out there, and choose whether to accept a journey.
- **Observer / Listener** — stay in a world, play music, and spend time with its evolving audio-visual environment.

Neither mode is a waiting room for the other. Exploration remains voluntary, and choosing to stay is a complete experience in itself.

> **Every world must be worth staying in.**

Each world must remain beautiful in silence. Audio should reveal another layer of its character and behaviour—not merely make visible objects pulse to a beat.

> **Every world moves differently. Explore. Adapt.**

Movement is part of the riddle. Each world has its own physical logic; the Traveller observes, experiments, and adapts. Controls need not be exhaustively tutorialized when they can be discovered. Essential interactions should remain fair and discoverable, while deeper interactions may be left to find. **Esc** is the one universal interaction: it always brings the Traveller home.

> **Don't explain what can be discovered.**

The six worlds offer pieces of the rebus:

```text
Space
→ Galaxy
→ Planetary
→ Environment
→ Human
→ Molecular
→ Fibonacci
→ ?
```

Their recurring patterns invite connections, but no definitive interpretation is supplied.

There are no objectives to complete and no path that must be followed.

The traveler chooses where to go, what to approach, and when to continue.

Some places may reveal deeper experiences.

The journey exists only through the choice to explore it.

And at the end:

> **?**

---

## 🎵 Audio-Visual Symbiosis

Audio-visual symbiosis is a first-class design goal, not a generic audio-reactive-effects layer. The audio system can provide the same normalized musical signals across the experience, but each theme interprets them in its own visual vocabulary.

The intended relationship is distinct in each world:

- **Space / Blob** — *“I feel the music.”* The Blob remains the emotional, organic audio-reactive companion and the current reference implementation.
- **Galaxy / Cosmic Veils** — *“The universe resonates with it.”* This is future visual/audio roadmap work.
- **Planetary / Solar Activity** — *“The star releases it.”* This is future visual/audio roadmap work.

### Theme 2 — Galaxy: Cosmic Veils *(future direction)*

The Galaxy's surrounding volume is currently sparse beyond the spiral itself. A future direction is to introduce **2–4 enormous, faint, translucent 3D filament or sheet structures** at different depths around the galaxy. They should be subtle at a distance, while giving Travellers atmospheric forms to approach, discover, and fly through—and giving Observers / Listeners a large-scale material through which music can become visible.

Their audio response should remain restrained and spatial:

- **Bass** — broad, slow deformation or breathing.
- **Mids** — energy travelling through filament structures.
- **Highs** — delicate edge shimmer and fine detail.
- **Kick** — an occasional localized ripple through part of a veil.

Responses should prefer spatial propagation over every veil reacting globally at once. This helps the Galaxy feel vast while adding identity to the space around its central landmark.

### Theme 3 — Planetary: Solar Activity *(future direction)*

A future direction for the Planetary world is subtle solar activity: corona filaments, magnetic plasma arcs or prominences, and occasional evolving flares. Audio should reveal stellar energy through the Sun's own behaviour; the planets must not simply bounce or pulse to music.

These Theme 2 and Theme 3 phenomena describe future visual/audio roadmap work. They are not implemented features.

---

## ⚙ Technology

The Fibonacci Experience is built as a real-time interactive digital environment.

### Rendering

- Three.js
- WebGL
- GLSL
- Procedural animation
- Cinematic camera systems

### Interaction

- Mouse and touch interaction
- Free exploration and flight
- Cinematic transitions
- Theme-specific focal experiences

### Audio

- Web Audio API
- Live audio input
- Frequency analysis
- Audio-reactive visual systems

### Engine

- Modular Theme System
- State Management
- Interaction Systems
- Audio Systems
- Cinematic Camera / Director

### Development & Deployment

- Vite
- GitHub
- Vercel

---

## 🌌 Current Experience

**Space** is the first world of The Fibonacci Experience.

It establishes the visual and interaction language for the journey:

- Cosmic exploration
- Cinematic movement
- Interactive visual systems
- Audio-reactive environments
- The Core as the first focal experience

The remaining worlds form the larger masterplan.

---

## 🏗 Conceptual Architecture

```text
                    THE FIBONACCI EXPERIENCE

                           SPACE
                             │
                             ▼
                       SPIRAL GALAXY
                             │
                             ▼
                         OUR WORLD
                             │
                             ▼
                        ENVIRONMENT
                             │
                             ▼
                           HUMAN
                             │
                             ▼
                    MOLECULAR WORLD
                             │
                             ▼
                        FIBONACCI
                         ↙       ↘
                        1         2
```

The recurring structure is part of the experience; what it suggests remains open to the Traveller.

---

## Local development

Install [Node.js](https://nodejs.org/) and npm using a version compatible with Vite 7, then clone the repository:

```sh
git clone https://github.com/erichmoenius/fibonacci-experience.git
cd fibonacci-experience
npm install
npm run dev
```

Open the local URL printed by Vite in your terminal.

### Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Create a production build. |
| `npm run preview` | Serve the production build locally for review. |

To check a production build locally:

```sh
npm run build
npm run preview
```

Run the build before starting the preview server. The preview command is for local review; deployment is a separate step.

---

## 🚀 Live Experience

**Prototype**

👉 https://prototype.thefridolin.com

---

## 👤 Creator

**Erich Moenius**

Creative Technology · Interactive Experiences · Real-Time Graphics

🌐 https://thefridolin.com
