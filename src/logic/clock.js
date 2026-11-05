// In-game clock. Time is tracked as minutes since midnight.

export function parseTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(minutes) {
  const total = Math.floor(minutes);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export class GameClock {
  constructor({ startTime, firstBell, clockSpeed }) {
    this.start = parseTime(startTime);
    this.bell = parseTime(firstBell);
    // clockSpeed = in-game seconds that pass per real second.
    this.speed = clockSpeed;
    this.minutes = this.start;
  }

  tick(realMs) {
    this.minutes += ((realMs / 1000) * this.speed) / 60;
  }

  addMinutes(n) {
    this.minutes += n;
  }

  minutesUntilBell() {
    return this.bell - this.minutes;
  }

  isLate() {
    return this.minutes >= this.bell;
  }
}
