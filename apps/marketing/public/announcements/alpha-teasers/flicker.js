/* Flicker grids from apps/web/src/lib/flickerGrids.ts, cropped to the 5×5
   the transcript actually paints. */
(() => {
  const to5 = (on7) => {
    const on = new Set(on7);
    const cells = [];
    for (let row = 1; row <= 5; row += 1) {
      for (let col = 1; col <= 5; col += 1) {
        cells.push(on.has(row * 7 + col));
      }
    }
    return cells;
  };

  const GRIDS = {
    chooChoo: [
      [16],
      [16, 17, 23],
      [16, 17, 18, 23, 24, 30],
      [16, 17, 18, 23, 24, 25, 30, 31, 32],
      [18, 24, 25, 30, 31, 32],
      [25, 31, 32],
      [32],
      [],
    ],
    syncing: [
      [2, 3, 4, 10],
      [3, 9, 10, 11, 17],
      [3, 10, 16, 17, 18, 24],
      [10, 17, 23, 24, 25, 31],
      [17, 24, 30, 31, 32, 38],
      [24, 31, 37, 38, 39, 45],
      [31, 38, 44, 45, 46],
      [38, 45],
      [],
      [38, 44, 45, 46],
      [31, 37, 38, 39, 45],
      [24, 30, 31, 32, 38, 45],
      [17, 23, 24, 25, 31, 38],
      [10, 16, 17, 18, 24, 31],
      [3, 9, 10, 11, 17, 24],
      [2, 3, 4, 10, 17],
      [3, 10],
      [],
    ],
    searching: [
      [9, 15, 16, 17, 23],
      [10, 16, 17, 18, 24],
      [11, 17, 18, 19, 25],
      [18, 24, 25, 26, 32],
      [25, 31, 32, 33, 39],
      [24, 30, 31, 32, 38],
      [23, 29, 30, 31, 37],
      [8, 9, 10, 15, 17, 22, 23, 24],
      [8, 9, 10, 15, 17, 22, 23, 24],
      [8, 9, 10, 15, 17, 22, 23, 24],
    ],
    busy: [
      [15, 19, 22, 23, 26, 29, 33],
      [15, 19, 22, 26, 29, 31, 33],
      [15, 22, 26, 29, 33, 39, 40],
      [15, 22, 26, 29, 31, 33, 40],
      [8, 15, 22, 23, 26, 33, 40],
      [8, 15, 17, 19, 22, 26, 33],
      [8, 11, 12, 15, 19, 22, 26],
      [12, 15, 17, 19, 22, 26, 29],
    ],
  };

  window.ModestoFlicker = {
    frames(name) {
      return GRIDS[name].map(to5);
    },
    mount(host, name) {
      const frames = this.frames(name);
      const cells = Array.from({ length: 25 }, () => {
        const cell = document.createElement("i");
        cell.className = "cell";
        host.append(cell);
        return cell;
      });
      return (time) => {
        const frame = frames[Math.floor(time * 10) % frames.length];
        cells.forEach((cell, index) => cell.classList.toggle("on", frame[index]));
      };
    },
    tick(tl, paint, duration) {
      const clock = { t: 0 };
      tl.fromTo(
        clock,
        { t: 0 },
        {
          t: duration,
          duration,
          ease: "none",
          immediateRender: true,
          onUpdate() {
            paint(clock.t);
          },
        },
        0,
      );
    },
  };
})();
