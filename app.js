const canvas = document.querySelector('#world');
const context = canvas.getContext('2d');
const labels = {
  left: document.querySelector('#left-command'), right: document.querySelector('#right-command'),
  position: document.querySelector('#position'), heading: document.querySelector('#heading'),
  velocity: document.querySelector('#velocity'), clock: document.querySelector('#clock'),
};

const robot = { x: 0, y: 0, theta: 0, left: 0, right: 0, trail: [] };
const pressed = new Set();
const MAX_COMMAND = 6000;
const MAX_TRACK_SPEED = 0.48; // m/s: intentionally simple V1 model
const TRACK_SEPARATION = 0.086; // m, configurable in later hardware-calibrated release
let elapsed = 0;
let lastFrame = performance.now();

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function setCommandsFromKeys() {
  const up = pressed.has('ArrowUp'); const down = pressed.has('ArrowDown');
  const left = pressed.has('ArrowLeft'); const right = pressed.has('ArrowRight');
  if (up) [robot.left, robot.right] = [2700, 2700];
  else if (down) [robot.left, robot.right] = [-2200, -2200];
  else if (left) [robot.left, robot.right] = [-1800, 1800];
  else if (right) [robot.left, robot.right] = [1800, -1800];
  else [robot.left, robot.right] = [0, 0];
}

function step(dt) {
  setCommandsFromKeys();
  const leftVelocity = robot.left / MAX_COMMAND * MAX_TRACK_SPEED;
  const rightVelocity = robot.right / MAX_COMMAND * MAX_TRACK_SPEED;
  const linearVelocity = (leftVelocity + rightVelocity) / 2;
  const angularVelocity = (rightVelocity - leftVelocity) / TRACK_SEPARATION;
  robot.theta += angularVelocity * dt;
  robot.x += linearVelocity * Math.cos(robot.theta) * dt;
  robot.y += linearVelocity * Math.sin(robot.theta) * dt;
  robot.x = Math.max(-1.87, Math.min(1.87, robot.x));
  robot.y = Math.max(-1.87, Math.min(1.87, robot.y));
  if (Math.abs(linearVelocity) > 0.001 || Math.abs(angularVelocity) > 0.001) {
    const last = robot.trail.at(-1);
    if (!last || Math.hypot(last.x - robot.x, last.y - robot.y) > 0.012) robot.trail.push({ x: robot.x, y: robot.y });
    if (robot.trail.length > 600) robot.trail.shift();
  }
  elapsed += dt;
}

function mapToCanvas(x, y, width, height) {
  const scale = Math.min(width, height) / 4;
  return { x: width / 2 + x * scale, y: height / 2 - y * scale, scale };
}

function drawWorld() {
  const { width, height } = canvas.getBoundingClientRect();
  context.clearRect(0, 0, width, height);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#e1e5e3'); gradient.addColorStop(.5, '#b7bebc'); gradient.addColorStop(1, '#d8dcda');
  context.fillStyle = gradient; context.fillRect(0, 0, width, height);
  // Fixed low-contrast features are intentional: later camera exercises must find pose from pixels.
  context.fillStyle = 'rgba(67, 79, 73, .13)';
  for (let x = 0; x < width; x += 42) context.fillRect(x, 0, 1, height);
  for (let y = 0; y < height; y += 42) context.fillRect(0, y, width, 1);
  context.save(); context.translate(width * .20, height * .30); context.rotate(-.16);
  context.fillStyle = 'rgba(49, 91, 71, .32)'; context.font = `800 ${Math.min(width, height) * .13}px Manrope`;
  context.fillText('JOHN', 0, 0); context.fillText('DEERE', 0, Math.min(width, height) * .12);
  context.strokeStyle = 'rgba(49, 91, 71, .22)'; context.lineWidth = 3; context.strokeRect(-12, -Math.min(width, height) * .11, Math.min(width, height) * .41, Math.min(width, height) * .30); context.restore();
  const origin = mapToCanvas(0, 0, width, height);
  context.strokeStyle = 'rgba(21,33,29,.32)'; context.lineWidth = 1; context.beginPath(); context.moveTo(0, origin.y); context.lineTo(width, origin.y); context.moveTo(origin.x, 0); context.lineTo(origin.x, height); context.stroke();
  context.fillStyle = 'rgba(21,33,29,.6)'; context.font = '10px "DM Mono"'; context.fillText('0,0', origin.x + 7, origin.y - 7);
  if (robot.trail.length > 1) { context.strokeStyle = '#e98633'; context.lineWidth = 2; context.beginPath(); robot.trail.forEach((point, index) => { const p = mapToCanvas(point.x, point.y, width, height); index ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y); }); context.stroke(); }
  drawRobot(origin.scale, width, height);
}

function drawRobot(scale, width, height) {
  const p = mapToCanvas(robot.x, robot.y, width, height); const bodyLength = .118 * scale; const bodyWidth = .102 * scale;
  context.save(); context.translate(p.x, p.y); context.rotate(-robot.theta);
  context.shadowColor = 'rgba(0,0,0,.32)'; context.shadowBlur = 12; context.shadowOffsetY = 5;
  context.fillStyle = '#17201d'; context.fillRect(-bodyLength / 2, -bodyWidth / 2, bodyLength, bodyWidth); context.shadowColor = 'transparent';
  context.fillStyle = '#0a0d0c'; context.fillRect(-bodyLength / 2 + 3, -bodyWidth / 2 - 6, bodyLength - 6, 10); context.fillRect(-bodyLength / 2 + 3, bodyWidth / 2 - 4, bodyLength - 6, 10);
  context.fillStyle = '#315b47'; context.fillRect(-bodyLength * .30, -bodyWidth * .30, bodyLength * .60, bodyWidth * .60);
  context.fillStyle = '#b5c840'; context.fillRect(bodyLength * .18, -bodyWidth * .15, bodyLength * .12, bodyWidth * .30);
  context.strokeStyle = '#fff'; context.lineWidth = 2; context.beginPath(); context.moveTo(bodyLength * .44, 0); context.lineTo(bodyLength * .68, 0); context.stroke();
  context.restore();
}

function updateTelemetry() {
  const speed = ((robot.left + robot.right) / 2 / MAX_COMMAND * MAX_TRACK_SPEED);
  const heading = ((robot.theta * 180 / Math.PI) % 360 + 360) % 360;
  const command = value => `${value >= 0 ? '+' : ''}${String(value).padStart(4, '0')}`;
  labels.left.textContent = command(robot.left); labels.right.textContent = command(robot.right);
  labels.position.innerHTML = `x ${robot.x >= 0 ? '+' : ''}${robot.x.toFixed(2)} <small>m</small> · y ${robot.y >= 0 ? '+' : ''}${robot.y.toFixed(2)} <small>m</small>`;
  labels.heading.innerHTML = `${heading.toFixed(1).padStart(5, '0')}<small>°</small>`;
  labels.velocity.innerHTML = `${Math.abs(speed).toFixed(2)}<small> m/s</small>`;
  labels.clock.textContent = `t ${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${(elapsed % 60).toFixed(1).padStart(4, '0')}`;
}

function animate(now) { const dt = Math.min((now - lastFrame) / 1000, .04); lastFrame = now; step(dt); drawWorld(); updateTelemetry(); requestAnimationFrame(animate); }
document.addEventListener('keydown', event => { if (event.key.startsWith('Arrow')) { event.preventDefault(); pressed.add(event.key); } });
document.addEventListener('keyup', event => pressed.delete(event.key));
window.addEventListener('blur', () => pressed.clear());
document.querySelector('#reset').addEventListener('click', () => { Object.assign(robot, { x:0, y:0, theta:0, left:0, right:0, trail:[] }); elapsed = 0; });
window.addEventListener('resize', resizeCanvas); resizeCanvas(); requestAnimationFrame(animate);
