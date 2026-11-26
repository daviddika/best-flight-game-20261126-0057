// Skyward Vale — keyboard + mouse input. Arrows/WASD pitch & roll, W/S or
// Shift/Ctrl throttle, Space brakes/flaps, P pause, C camera, R reset, M mute.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pitch = 0;   // -1..1, +1 = pull up
    this.roll = 0;    // -1..1, +1 = roll right
    this.throttleDelta = 0;
    this.brake = false;
    this.flaps = false;
    this.mouseSteer = false;
    this.mouseX = 0; this.mouseY = 0;
    this.pressed = new Set(); // edge-triggered keys, consumed by the game
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('mousemove', (e) => {
      this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    });
    window.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouseSteer = true; });
    window.addEventListener('mouseup', () => { this.mouseSteer = false; });
  }

  wasPressed(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }

  update() {
    const k = this.keys;
    let pitch = 0, roll = 0;
    if (k.has('ArrowUp') || k.has('KeyS')) pitch -= 1;
    if (k.has('ArrowDown') || k.has('KeyW')) pitch += 1;
    // Note: W/S double as throttle below; pitch uses arrows primarily.
    // Re-map: arrows pitch/roll, A/D roll, W/S throttle.
    pitch = 0;
    if (k.has('ArrowUp')) pitch += 1;
    if (k.has('ArrowDown')) pitch -= 1;
    if (k.has('ArrowLeft') || k.has('KeyA')) roll -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) roll += 1;
    if (this.mouseSteer) {
      roll += this.mouseX * 0.9;
      pitch += -this.mouseY * 0.7;
    }
    this.pitch = Math.max(-1, Math.min(1, pitch));
    this.roll = Math.max(-1, Math.min(1, roll));
    let td = 0;
    if (k.has('KeyW') || k.has('ShiftLeft') || k.has('ShiftRight')) td += 0.55;
    if (k.has('KeyS') || k.has('ControlLeft') || k.has('ControlRight')) td -= 0.55;
    this.throttleDelta = td;
    this.brake = k.has('Space');
    this.flaps = k.has('KeyF');
  }
}
