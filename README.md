# CubeTimerPro

CubeTimerPro is a web-based speedcubing timer that helps users practice, record solves, and track their progress. It includes realistic scramble generation, an interactive 3D cube, and detailed solve statistics, all running directly in the browser.

I built this project to challenge myself with JavaScript while creating something that speedcubers could actually use.

---

## Project Overview

This project combines several parts into one application:

- A precise solve timer
- Random scramble generation
- A 3D cube visualization
- Solve history and statistics
- Support for multiple cube sizes

Everything runs in the browser, so there is no installation or account required.

---

## Features

### Timer

- High-precision solve timer
- Keyboard controls
- Session tracking
- Reset functionality

### Cube Support

- 2×2
- 3×3
- 4×4
- 5×5

Each cube size uses an appropriate scramble length.

### Scramble Generator

The scramble generator creates random scrambles while avoiding invalid move sequences such as repeating the same face twice in a row.

### 3D Cube

The application includes an interactive cube built with Three.js.

Features include:

- Rotate the cube with your mouse
- Watch scrambles displayed on the cube
- Smooth animations
- Accurate cube movements

### Statistics

CubeTimerPro automatically calculates:

- Best solve
- Mean time
- Average of 5 (Ao5)
- Average of 12 (Ao12)
- Best Ao5
- Best Ao12
- Total solves

These statistics update after every solve.

---

## Technology Stack

- HTML5
- CSS3
- JavaScript (ES6)
- Three.js
- Chart.js

---

## Project Structure

```
CubeTimerPro
│
├── index.html
├── style.css
└── script.js
```

The project is organized into different sections for the timer, scramble generation, 3D cube rendering, statistics, and user interface.

---

## What I Learned

This project helped me learn about:

- Writing larger JavaScript programs
- Organizing code into logical sections
- Working with browser events
- Creating 3D graphics using Three.js
- Calculating statistics from user data
- Improving user interface design
- Using Git and GitHub to manage projects

One of the most interesting parts was combining several independent features into a single application that works smoothly.

---

## Challenges

Some of the challenges I worked through were:

- Generating realistic cube scrambles
- Displaying and rotating a 3D cube
- Keeping the timer accurate while updating the interface
- Calculating rolling averages like Ao5 and Ao12
- Making the application responsive on different screen sizes

Working through these problems helped me become a better programmer and taught me how to debug larger projects.

---

## Future Improvements

Some features I would like to add are:

- WCA inspection timer
- Additional cube events
- Local user profiles
- Export solve history
- Dark and light themes
- Progressive Web App (PWA) support
- Cloud synchronization
- More detailed performance charts

---

## Running the Project

Clone the repository:

```bash
git clone https://github.com/TheCuriousBuilder/CubeTimerPro.git
```

Then open `index.html` in your browser.

No additional installation is required.

---

## About Me

I'm a Grade 9 student who enjoys programming, mathematics, and solving challenging problems. I like building projects that help me learn new technologies while creating something useful.

CubeTimerPro is one of several projects I'm building as I continue learning software engineering and web development.

I welcome feedback and ideas for improving this project.
