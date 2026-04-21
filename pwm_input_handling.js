let STABILITY_WINDOW = 15;
let STABILITY_THRESHOLD = 28;
let EXTREME_LOW = 5;
let EXTREME_HIGH = 95;

let ch = [
  {
    lightId: 0,
    callInProgress: false,
    lastSentValue: -1,
    recentReadings: [], recentIndex: 0, recentCount: 0,
    stabilityReadings: [], stabilityIndex: 0, stabilityCount: 0,
    lastStableBrightness: -1,
    isStable: false,
  },
  {
    lightId: 2,
    callInProgress: false,
    lastSentValue: -1,
    recentReadings: [], recentIndex: 0, recentCount: 0,
    stabilityReadings: [], stabilityIndex: 0, stabilityCount: 0,
    lastStableBrightness: -1,
    isStable: false,
  }
];

let minSeen = [999, 999];
let maxSeen = [-1, -1];

function mapBrightness(input) {
  if (input < 5.0)  return 0;
  if (input < 20.0) return 1;
  if (input < 40.0) return 10;
  if (input < 60.0) return 20;
  if (input < 80.0) return 35;
  if (input < 95.0) return 60;
  return 100;
}

function getRecentAverage(c) {
  if (c.recentCount === 0) return 0;
  let sum = 0;
  for (let i = 0; i < c.recentCount; i++) sum += c.recentReadings[i];
  return Math.round((sum / c.recentCount) * 10) / 10;
}

function getStabilityAverage(c) {
  if (c.stabilityCount === 0) return 0;
  let sum = 0;
  for (let i = 0; i < c.stabilityCount; i++) sum += c.stabilityReadings[i];
  return sum / c.stabilityCount;
}

function getStabilitySpread(c) {
  if (c.stabilityCount === 0) return 0;
  let min = 999;
  let max = -1;
  for (let i = 0; i < c.stabilityCount; i++) {
    if (c.stabilityReadings[i] < min) min = c.stabilityReadings[i];
    if (c.stabilityReadings[i] > max) max = c.stabilityReadings[i];
  }
  return max - min;
}

function isExtreme(value) {
  return value < EXTREME_LOW || value >= EXTREME_HIGH;
}

function applyBrightness(c, brightness) {
  if (c.callInProgress) return;
  if (brightness === c.lastSentValue) return;

  c.callInProgress = true;
  c.lastSentValue = brightness;
  Shelly.call("Light.Set", {
    id: c.lightId,
    on: brightness > 0,
    brightness: brightness > 0 ? brightness : 1
  }, function(res, error_code, error_msg) {
    c.callInProgress = false;
    if (error_code !== 0) {
      print("Ch", c.lightId, "error:", error_code, error_msg);
    } else {
      print("Ch", c.lightId, "brightness set to:", brightness);
    }
  });
}

function processChannel(inputId, c, value) {
  // Update min/max
  if (value < minSeen[inputId]) minSeen[inputId] = value;
  if (value > maxSeen[inputId]) maxSeen[inputId] = value;

  // Update recent readings
  c.recentReadings[c.recentIndex] = value;
  c.recentIndex = (c.recentIndex + 1) % 5;
  if (c.recentCount < 5) c.recentCount = c.recentCount + 1;

  // Update stability window
  c.stabilityReadings[c.stabilityIndex] = value;
  c.stabilityIndex = (c.stabilityIndex + 1) % STABILITY_WINDOW;
  if (c.stabilityCount < STABILITY_WINDOW) c.stabilityCount = c.stabilityCount + 1;

  let avg = getRecentAverage(c);
  let spread = getStabilitySpread(c);
  let stabilityAvg = getStabilityAverage(c);
  let brightness = mapBrightness(stabilityAvg);

//   print("Ch", inputId,
//         "| Input:", value,
//         "| Avg(5):", avg,
//         "| Spread:", Math.round(spread * 10) / 10,
//         "| Stable:", c.isStable,
//         "| Min:", minSeen[inputId],
//         "| Max:", maxSeen[inputId]);

  // Skip stability logic for extreme values
  if (isExtreme(value)) {
    let extremeBrightness = value < EXTREME_LOW ? 0 : 100;
    print("Ch", inputId, "extreme value, applying brightness:", extremeBrightness);
    c.isStable = true;
    c.stabilityCount = 0;
    c.lastStableBrightness = extremeBrightness;
    applyBrightness(c, extremeBrightness);
    return;
  }

  // Determine if input is stable
  let wasStable = c.isStable;
  c.isStable = c.stabilityCount >= STABILITY_WINDOW && spread <= STABILITY_THRESHOLD;

  if (c.isStable) {
    if (!wasStable) {
      print("Ch", inputId, "became stable at avg:",
            Math.round(stabilityAvg * 10) / 10, "brightness:", brightness);
      if (brightness !== c.lastStableBrightness) {
        c.lastStableBrightness = brightness;
        applyBrightness(c, brightness);
      }
    }
  } else {
    if (brightness !== c.lastSentValue) {
      print("Ch", inputId, "moving, brightness:", brightness);
      applyBrightness(c, brightness);
    }
  }
}

Shelly.addEventHandler(function(event) {
  if (event.name !== "input") return;
  if (event.info.event !== "analog_change") return;

  if (event.id === 0) {
    processChannel(0, ch[0], event.info.percent);
  } else if (event.id === 2) {
    processChannel(2, ch[1], event.info.percent);
  }
});

print("Dual input event handler registered");